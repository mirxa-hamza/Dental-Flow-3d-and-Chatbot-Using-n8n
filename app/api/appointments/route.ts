/**
 * POST /api/appointments — "View My Appointments" and "Cancel an Appointment"
 * in the chat window. This route passes the request to n8n workflow 18 with
 * the same secret key as the chat (the browser never sees it).
 *
 *   { action: 'list',   contact: { phone?, email? }, lang }
 *   { action: 'cancel', contact: { phone?, email? }, reference, lang }
 *
 * The workflow's address is next to the chat's: .../webhook/web-chat ->
 * .../webhook/web-appointments (or set N8N_APPOINTMENTS_URL).
 * Without N8N_WEB_CHAT_URL it answers in demo mode (nothing is cancelled).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { cleanAnswer, readContact, type Contact } from '@/lib/appointments';
import { demoAppointments, demoCancel } from '@/lib/demo-appointments';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const CHAT_URL = process.env.N8N_WEB_CHAT_URL?.trim() ?? '';
const URL_ = process.env.N8N_APPOINTMENTS_URL?.trim() || (CHAT_URL ? CHAT_URL.replace(/\/web-chat\/?$/, '/web-appointments') : '');
const KEY = process.env.N8N_WEB_CHAT_KEY?.trim() ?? '';
const DEV = process.env.NODE_ENV !== 'production';

/* There is no code check, so lookups are limited per visitor (per server instance):
   8 lookups and 6 cancellations in 10 minutes, 40 lookups a day. */
const hits = new Map<string, number[]>();
function limited(key: string, perTen: number, perDay: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter(t => now - t < 86_400_000);
  if (list.filter(t => now - t < 600_000).length >= perTen || list.length >= perDay) { hits.set(key, list); return true; }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 86_400_000) hits.delete(k);
  return false;
}

const fail = (status: number, reason: string, detail?: string) =>
  NextResponse.json({ ok: false, reason, ...(DEV && detail ? { detail } : {}) }, { status });

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (origin && host) {
    try { if (new URL(origin).host !== host) return fail(403, 'forbidden'); } catch { return fail(403, 'forbidden'); }
  }

  const text = await req.text();
  if (text.length > 4000) return fail(413, 'too_large');
  let b: Record<string, unknown> = {};
  try { b = JSON.parse(text) as Record<string, unknown>; } catch { return fail(400, 'bad_request'); }
  const action = b.action === 'cancel' ? 'cancel' : 'list';
  const c = (b.contact && typeof b.contact === 'object' ? b.contact : {}) as Record<string, unknown>;
  const contact: Contact | null = readContact(`${typeof c.phone === 'string' ? c.phone : ''} ${typeof c.email === 'string' ? c.email : ''}`);
  if (!contact) return fail(400, 'invalid-contact');
  const reference = typeof b.reference === 'string' ? b.reference.trim().toUpperCase().slice(0, 20) : '';
  if (action === 'cancel' && !/^DN-?[A-Z0-9]{3,12}$/.test(reference)) return fail(400, 'invalid-reference');
  const lang = typeof b.lang === 'string' && /^(en|ur|ar)$/.test(b.lang) ? b.lang : 'en';

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  if (action === 'list' ? limited('l:' + ip, 8, 40) : limited('c:' + ip, 6, 30)) return fail(429, 'too-many');

  if (!URL_) {
    await new Promise(r => setTimeout(r, 500 + Math.random() * 400));
    return NextResponse.json(action === 'list' ? demoAppointments(contact) : demoCancel(contact, reference));
  }

  try {
    const res = await fetch(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-DentalFlow-Web-Key': KEY, 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ action, phone: contact.phone ?? '', email: contact.email ?? '', reference, lang }),
      signal: AbortSignal.timeout(25_000),
      cache: 'no-store',
    });
    const raw = await res.text();
    if (!res.ok) {
      const why = res.status === 404
        ? `n8n has no webhook at ${URL_} (HTTP 404). Import and publish workflow 18 (Web Appointments).`
        : res.status === 401 || res.status === 403
          ? `n8n refused the key (HTTP ${res.status}). The Appointments Request node in workflow 18 must use the "DentalFlow web key" credential, like Chat Request in workflow 17.`
          : `Workflow 18 answered HTTP ${res.status}: ${raw.slice(0, 200)}`;
      console.error(`[appointments] ${why}`);
      return fail(502, 'upstream', why);
    }
    let json: unknown = null;
    try { json = JSON.parse(raw); } catch { /* not JSON */ }
    if (json === null) return fail(502, 'upstream', `Workflow 18 did not answer with JSON: ${raw.slice(0, 200) || '(nothing)'}`);
    return NextResponse.json(cleanAnswer(json));
  } catch (e) {
    const err = e as Error;
    const why = err?.name === 'TimeoutError' ? 'Workflow 18 did not answer within 25 seconds.' : `Cannot reach n8n at ${URL_}. Is n8n (and ngrok) running?`;
    console.error(`[appointments] ${why}`);
    return fail(504, 'unreachable', why);
  }
}
