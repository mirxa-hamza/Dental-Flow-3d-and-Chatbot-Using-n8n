'use client';
/**
 * Voice messages: records from the microphone, then turns the recording into
 * a small WAV file (16 kHz, mono) that the speech model understands, whatever
 * the browser recorded in (Chrome: WebM, Safari: MP4). Nothing is uploaded
 * until the visitor taps send; the recording is never kept.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_SECONDS = 45;
const MIN_SECONDS = 0.8;
type Done = { base64: string; seconds: number; url: string };
type Status = 'idle' | 'recording' | 'processing';

async function toWav16k(blob: Blob): Promise<string> {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  // decode; if the live audio context refuses (it can, after several
  // recordings), try again with an offline one
  let decoded: AudioBuffer;
  try {
    const ctx = new AC();
    try { decoded = await ctx.decodeAudioData(await blob.arrayBuffer()); } finally { void ctx.close().catch(() => undefined); }
  } catch {
    decoded = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(await blob.arrayBuffer());
  }
  const rate = 16000;
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  // a quiet recording is brought up to a clear level (never louder than full scale)
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
  const gain = peak > 0.02 && peak < 0.7 ? 0.7 / peak : 1;
  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  w(36, 'data'); view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i] * gain)) * 0x7fff, true);
  const bytes = new Uint8Array(view.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function useVoice(onDone: (d: Done) => void, messages: { denied: string; unsupported: string; short: string; failed: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const sendIt = useRef(false);
  const busy = useRef(false);
  const timers = useRef<{ tick?: ReturnType<typeof setInterval>; raf?: number; ctx?: AudioContext }>({});
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const cleanup = useCallback(() => {
    const t = timers.current;
    if (t.tick) clearInterval(t.tick);
    if (t.raf) cancelAnimationFrame(t.raf);
    if (t.ctx) void t.ctx.close().catch(() => undefined);
    timers.current = {};
    stream.current?.getTracks().forEach(tr => tr.stop());
    stream.current = null;
    setLevel(0);
  }, []);
  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback((send: boolean) => {
    sendIt.current = send;
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (busy.current) return;                     // still recording or preparing the last one
    setError('');
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError(messages.unsupported); return; }
    let s: MediaStream;
    try { s = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch { setError(messages.denied); return; }
    stream.current = s;
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(m => MediaRecorder.isTypeSupported?.(m));
    let r: MediaRecorder;
    try { r = new MediaRecorder(s, type ? { mimeType: type } : undefined); }
    catch { cleanup(); setError(messages.unsupported); return; }
    busy.current = true;
    rec.current = r;
    chunks.current = [];
    r.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = async () => {
      const secs = (performance.now() - started.current) / 1000;
      cleanup();
      const done = () => { busy.current = false; setStatus('idle'); };
      if (!sendIt.current) { done(); return; }
      if (secs < MIN_SECONDS || !chunks.current.length) { done(); setError(messages.short); return; }
      setStatus('processing');
      const blob = new Blob(chunks.current, { type: r.mimeType || type || 'audio/webm' });
      try {
        const base64 = await toWav16k(blob);
        doneRef.current({ base64, seconds: Math.round(secs), url: URL.createObjectURL(blob) });
      } catch { setError(messages.failed); }
      done();
    };
    // a live level meter, so the visitor can see they are being heard
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(an);
      const data = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
        timers.current.raf = requestAnimationFrame(loop);
      };
      timers.current.ctx = ctx;
      timers.current.raf = requestAnimationFrame(loop);
    } catch { /* the meter is optional */ }
    started.current = performance.now();
    setSeconds(0);
    timers.current.tick = setInterval(() => {
      const secs = (performance.now() - started.current) / 1000;
      setSeconds(Math.floor(secs));
      if (secs >= MAX_SECONDS) stop(true);
    }, 250);
    r.onerror = () => { cleanup(); busy.current = false; setStatus('idle'); setError(messages.failed); };
    try { r.start(250); } catch { cleanup(); busy.current = false; setError(messages.unsupported); return; }
    setStatus('recording');
  }, [cleanup, messages.denied, messages.failed, messages.short, messages.unsupported, stop]);

  return { status, seconds, level, error, setError, start, send: () => stop(true), cancel: () => stop(false) };
}
