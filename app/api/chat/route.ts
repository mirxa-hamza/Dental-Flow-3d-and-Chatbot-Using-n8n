/**
 * POST /api/chat — the chat window talks to this route, and this route talks
 * to n8n (workflow 17). The secret key for n8n stays here on the server; the
 * visitor's browser never sees it or the n8n address.
 *
 * Without N8N_WEB_CHAT_URL the route answers in demo mode (nothing is booked).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { cleanResponse, type ChatRequest, type DemoState, type HistoryItem } from '@/lib/chat-types';
import { demoReply } from '@/lib/demo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const N8N_URL = process.env.N8N_WEB_CHAT_URL?.trim() ?? '';
const N8N_KEY = process.env.N8N_WEB_CHAT_KEY?.trim() ?? '';
const TIMEOUT_MS = 45_000;
const MAX_BODY = 40_000;
const MAX_VOICE_BODY = 2_600_000;   // a voice message: about 50 seconds of 16 kHz WAV, as base64

/* A light per-visitor limit (per server instance): 12 messages a minute, 150 a day. */
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter(t => now - t < 86_400_000);
  const lastMinute = list.filter(t => now - t < 60_000).length;
  if (lastMinute >= 12 || list.length >= 150) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 86_400_000) hits.delete(k);
  return false;
}

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

/* While you run the site on your own computer (npm run dev), a failed reply says why, in plain words,
   in the chat and in the terminal. On the live site visitors only see "couldn't reach the clinic". */
const DEV = process.env.NODE_ENV !== 'production';
function upstreamFail(status: number, error: string, why: string) {
  console.error(`[chat] ${why}`);
  return NextResponse.json({ ok: false, error, ...(DEV ? { detail: why } : {}) }, { status });
}
function explainStatus(code: number, body: string) {
  const said = body ? ` n8n said: ${body.replace(/\s+/g, ' ').slice(0, 200)}` : '';
  if (code === 401 || code === 403) return `n8n refused the key (HTTP ${code}). N8N_WEB_CHAT_KEY in .env.local must be exactly the value of the "DentalFlow web key" credential, and the Chat Request node in workflow 17 must use that credential.${said}`;
  if (code === 404) return `n8n has no webhook at ${N8N_URL} (HTTP 404). Publish workflow 17 in n8n, and check the address ends in /webhook/web-chat (not /webhook-test/).${said}`;
  if (code >= 500) return `Workflow 17 stopped with an error (HTTP ${code}). Open workflow 17 > Executions in n8n and look at the red node.${said}`;
  return `n8n answered HTTP ${code}.${said}`;
}

function parse(raw: unknown): ChatRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const message = typeof b.message === 'string' ? b.message.trim().slice(0, 1000) : '';
  const a = b.audio && typeof b.audio === 'object' ? (b.audio as Record<string, unknown>) : null;
  const audio = a && typeof a.data === 'string' && a.data.length > 1000 && /^[A-Za-z0-9+/]+=*$/.test(a.data)
    ? { mime: 'audio/wav', data: a.data } : null;
  if (!message && !audio) return null;
  const history: HistoryItem[] = (Array.isArray(b.history) ? b.history : []).slice(-20).flatMap(h => {
    const x = (h ?? {}) as Record<string, unknown>;
    const role = x.role === 'user' || x.role === 'assistant' || x.role === 'note' ? x.role : null;
    const text = typeof x.text === 'string' ? x.text.slice(0, 1500) : '';
    return role && text.trim() ? [{ role, text }] : [];
  });
  const ds = b.demoState && typeof b.demoState === 'object' ? (b.demoState as Record<string, unknown>) : null;
  const demoState: DemoState | null = ds && typeof ds.step === 'string'
    ? { step: (['start', 'treatment', 'time', 'details', 'confirm'].includes(ds.step) ? ds.step : 'start') as DemoState['step'],
        service: typeof ds.service === 'string' ? ds.service.slice(0, 40) : undefined,
        dentist: typeof ds.dentist === 'string' ? ds.dentist.slice(0, 40) : undefined,
        slot: typeof ds.slot === 'string' ? ds.slot.slice(0, 160) : undefined }
    : null;
  return {
    sessionId: (typeof b.sessionId === 'string' ? b.sessionId : '').replace(/[^\w-]/g, '').slice(0, 80) || 'anonymous',
    message, history, demoState, audio,
    lang: typeof b.lang === 'string' && /^(en|ur|ar)$/.test(b.lang) ? b.lang : 'en',
  };
}

/** GET /api/chat: is the chat connected to the clinic, or in demo mode? (The chat window asks when it opens.) */
export function GET() {
  return NextResponse.json({ demo: !N8N_URL });
}

export async function POST(req: NextRequest) {
  // Only this website's own pages may use the route.
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (origin && host) {
    try { if (new URL(origin).host !== host) return fail(403, 'forbidden'); } catch { return fail(403, 'forbidden'); }
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  if (limited(ip)) return fail(429, 'too_many_messages');

  const text = await req.text();
  if (text.length > MAX_VOICE_BODY || (text.length > MAX_BODY && !text.includes('"audio"'))) return fail(413, 'too_large');
  let body: ChatRequest | null = null;
  try { body = parse(JSON.parse(text)); } catch { body = null; }
  if (!body) return fail(400, 'bad_request');

  if (!N8N_URL) {
    await new Promise(r => setTimeout(r, 700 + Math.random() * 600)); // feels like a real reply
    return NextResponse.json(demoReply(body));
  }

  try {
    const res = await fetch(N8N_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-DentalFlow-Web-Key': N8N_KEY, 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ sessionId: body.sessionId, message: body.message, history: body.history, lang: body.lang, ...(body.audio ? { audio: body.audio } : {}) }),
      signal: AbortSignal.timeout(body.audio ? TIMEOUT_MS + 15_000 : TIMEOUT_MS),   // listening to a voice message takes a few seconds more
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return upstreamFail(502, 'upstream', explainStatus(res.status, text));
    }
    const raw = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(raw); } catch { /* not JSON */ }
    if (json === null) return upstreamFail(502, 'empty', `n8n answered, but not with the chat's JSON. Check the Respond Chat node in workflow 17. It sent: ${raw.slice(0, 200) || '(nothing)'}`);
    const data = cleanResponse(json);
    if (!data.reply && !data.carousel && !data.booking) return upstreamFail(502, 'empty', 'Workflow 17 answered without a reply. Open its Executions in n8n and check the Web Agent and Prepare Reply nodes (often the Gemini credential).');
    return NextResponse.json(data);
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    if (err?.name === 'TimeoutError') return upstreamFail(504, 'timeout', `n8n did not answer within ${TIMEOUT_MS / 1000} seconds. Open workflow 17 > Executions in n8n to see where it is stuck.`);
    const code = err?.cause?.code || err?.name || 'error';
    const hint = /localhost/.test(N8N_URL) ? ' If n8n is running, try 127.0.0.1 instead of localhost in N8N_WEB_CHAT_URL.' : ' Is n8n (and ngrok) running?';
    return upstreamFail(504, 'unreachable', `Cannot reach n8n at ${N8N_URL} (${code}). Start n8n with start-dentalflow.bat.${hint}`);
  }
}
