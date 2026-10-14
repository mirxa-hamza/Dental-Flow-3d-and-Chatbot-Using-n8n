'use client';
/**
 * MODEL LAB (/en/model-lab, only while the site runs on your computer).
 * Try the built-in molar or drop in any .glb tooth model, turn it upright,
 * pick a finish, see it in the hero and in the scroll section, then copy the
 * settings into content/clinic.ts. Nothing is uploaded: the file stays in
 * your browser.
 */
import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMotionValue } from 'motion/react';
import { HeroScene, StoryScene } from './three/SceneLoader';
import { BUILT_IN_MOLAR, type ToothFinish, type ToothLook } from './three/look';

class Boundary extends Component<{ children: ReactNode; onError: (m: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error) { this.props.onError(e.message || 'unknown error'); }
  render() { return this.state.failed ? null : this.props.children; }
}

const FINISHES: { id: ToothFinish; label: string; hint: string }[] = [
  { id: 'clinic', label: 'Clinic white', hint: 'Our polished enamel. Best for most models.' },
  { id: 'own', label: 'Model’s own colours', hint: 'Keeps the textures the model came with.' },
  { id: 'glass', label: 'Glass', hint: 'Clear, with soft rainbow edges.' },
];
const STAGES = ['Check-ups', 'Fillings & roots', 'Whitening', 'Aligners'];

export function ModelLab() {
  const [file, setFile] = useState<{ url: string; name: string; size: number } | null>(null);
  const [finish, setFinish] = useState<ToothFinish>('clinic');
  const [rot, setRot] = useState<[number, number, number]>([0, 0, 0]);
  const [scale, setScale] = useState(1);
  const [view, setView] = useState<'hero' | 'story'>('hero');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [over, setOver] = useState(false);
  const progress = useMotionValue(0.1);
  const [stage, setStage] = useState(0.1);

  useEffect(() => () => { if (file) URL.revokeObjectURL(file.url); }, [file]);

  const look: ToothLook = useMemo(() => ({ ...BUILT_IN_MOLAR, file: file?.url ?? BUILT_IN_MOLAR.file, finish, rotation: rot, scale }), [file, finish, rot, scale]);

  const take = (f: File | undefined) => {
    if (!f) return;
    if (!/\.glb$/i.test(f.name)) { setError('Please use a .glb file (one file with everything inside). On Sketchfab: Download 3D model → GLB.'); return; }
    setError('');
    setRot([0, 0, 0]); setScale(1); setFinish('clinic');
    setFile({ url: URL.createObjectURL(f), name: f.name, size: f.size });
  };

  const fileName = file ? file.name.replace(/[^\w.-]+/g, '-').toLowerCase() : 'molar.glb';
  const snippet = `export const tooth3d: ToothLook = {
  file: '/models/${fileName}',
  finish: '${finish}',
  rotation: [${rot.join(', ')}],
  scale: ${scale},
  credit: '${file ? 'Tooth model by NAME, LICENCE' : ''}',
};`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  };

  return (
    <div className="min-h-svh bg-mist" dir="ltr" lang="en">
      <div className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[380px_1fr] lg:p-6">
        {/* ---------------- controls */}
        <aside className="glass-strong flex flex-col gap-6 rounded-3xl p-5 lg:sticky lg:top-6 lg:max-h-[calc(100svh-3rem)] lg:overflow-y-auto">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">Model Lab</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Choose the 3D tooth</h1>
            <p className="mt-1 text-sm text-muted">Only on your computer. Visitors never see this page.</p>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold">1 · Model</h2>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setFile(null); setError(''); setRot([0, 0, 0]); setScale(1); }}
                className={`rounded-2xl p-3 text-start text-sm ring-1 transition ${!file ? 'bg-ink text-white ring-ink' : 'bg-white ring-line hover:ring-brand'}`}>
                <span className="block font-semibold">Built-in molar</span>
                <span className={`text-xs ${!file ? 'text-white/70' : 'text-muted'}`}>Made for this site</span>
              </button>
              <label
                onDragOver={e => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-3 text-sm transition ${over ? 'border-brand bg-sky' : file ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-brand'}`}>
                <input type="file" accept=".glb,model/gltf-binary" className="sr-only" onChange={e => take(e.target.files?.[0])} />
                <span className="block font-semibold">{file ? 'Your model' : 'Your own .glb'}</span>
                <span className={`block truncate text-xs ${file ? 'text-white/70' : 'text-muted'}`}>{file ? file.name : 'Drop it here or click'}</span>
              </label>
            </div>
            {file && file.size > 8e6 && (
              <p className="mt-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 ring-1 ring-amber-200">
                This file is {(file.size / 1e6).toFixed(1)} MB. Visitors download it, so aim for under 5 MB (Sketchfab often offers a lighter version).
              </p>
            )}
            {error && <p className="mt-2 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-900 ring-1 ring-rose-200">{error}</p>}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">2 · Finish</h2>
            <div className="grid gap-2">
              {FINISHES.map(f => (
                <button key={f.id} type="button" onClick={() => setFinish(f.id)}
                  className={`rounded-2xl px-3.5 py-2.5 text-start ring-1 transition ${finish === f.id ? 'bg-sky ring-brand' : 'bg-white ring-line hover:ring-brand/50'}`}>
                  <span className="block text-sm font-semibold">{f.label}</span>
                  <span className="text-xs text-muted">{f.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold">3 · Turn it upright</h2>
            <p className="mb-3 text-xs text-muted">Crown at the top, roots at the bottom. Most models need X at 0, 90 or −90.</p>
            {(['X', 'Y', 'Z'] as const).map((axis, i) => (
              <div key={axis} className="mb-2.5 flex items-center gap-3">
                <span className="w-4 text-xs font-semibold text-muted">{axis}</span>
                <input type="range" min={-180} max={180} step={5} value={rot[i]} className="flex-1 accent-[#0e7490]"
                  onChange={e => setRot(r => r.map((v, k) => (k === i ? Number(e.target.value) : v)) as [number, number, number])} />
                <div className="flex gap-1">
                  {[-90, 0, 90].map(v => (
                    <button key={v} type="button" onClick={() => setRot(r => r.map((x, k) => (k === i ? v : x)) as [number, number, number])}
                      className={`w-9 rounded-lg py-1 text-[11px] font-semibold ring-1 ${rot[i] === v ? 'bg-ink text-white ring-ink' : 'bg-white ring-line'}`}>{v}°</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-3 flex items-center gap-3">
              <span className="w-10 text-xs font-semibold text-muted">Size</span>
              <input type="range" min={0.6} max={1.4} step={0.05} value={scale} onChange={e => setScale(Number(e.target.value))} className="flex-1 accent-[#0e7490]" />
              <span className="w-10 text-end text-xs tabular-nums">{scale.toFixed(2)}</span>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">4 · Use it</h2>
            <ol className="mb-3 list-decimal space-y-1 ps-5 text-xs text-ink-soft">
              {file && <li>Copy <b>{file.name}</b> into <code>website/public/models/</code>{fileName !== file.name ? <> and name it <code>{fileName}</code></> : null}.</li>}
              <li>Open <code>website/content/clinic.ts</code> and replace the <code>tooth3d</code> block with this:</li>
            </ol>
            <pre className="overflow-x-auto rounded-2xl bg-ink p-3.5 text-[11.5px] leading-relaxed text-sky">{snippet}</pre>
            <button type="button" onClick={copy} className="mt-2 w-full rounded-full bg-ink py-2.5 text-sm font-semibold text-white hover:bg-brand-deep">
              {copied ? 'Copied ✓' : 'Copy settings'}
            </button>
            {file && <p className="mt-2 text-xs text-muted">Most free models ask you to credit the artist: put their name and licence in <code>credit</code>. It appears in small print in the footer.</p>}
          </section>
        </aside>

        {/* ---------------- preview */}
        <main className="flex min-h-[70svh] flex-col gap-3">
          <div className="flex items-center gap-2">
            {(['hero', 'story'] as const).map(v => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ${view === v ? 'bg-ink text-white ring-ink' : 'bg-white ring-line'}`}>
                {v === 'hero' ? 'Top of the page' : '“What we do” section'}
              </button>
            ))}
          </div>
          <div className="relative flex-1 overflow-hidden rounded-3xl bg-white ring-1 ring-line">
            <div className="aurora absolute inset-0" />
            <div className="absolute inset-0">
              <Boundary key={look.file + view} onError={m => setError(`This model could not be shown (${m}). Try another .glb file.`)}>
                {view === 'hero' ? <HeroScene look={look} /> : <StoryScene look={look} progress={progress} still={false} />}
              </Boundary>
            </div>
          </div>
          {view === 'story' && (
            <div className="glass-strong rounded-2xl p-4">
              <input type="range" min={0} max={1} step={0.001} value={stage} className="w-full accent-[#0e7490]"
                onChange={e => { const v = Number(e.target.value); setStage(v); progress.set(v); }} />
              <div className="mt-1 grid grid-cols-4 text-center text-xs text-muted">
                {STAGES.map((s, i) => (
                  <button key={s} type="button" className={Math.min(3, Math.floor(stage * 4)) === i ? 'font-semibold text-brand' : ''}
                    onClick={() => { const v = (i + 0.5) / 4; setStage(v); progress.set(v); }}>{s}</button>
                ))}
              </div>
              {file && <p className="mt-2 text-center text-xs text-muted">With your own model, the roots light up only if its parts are named “crown” and “roots”. Everything else works with any model.</p>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
