'use client';
/**
 * THE BOOKING PANEL, inside the chat window.
 *   Treatment → Dentist → Time → Details → Confirm
 * Each step is a list from top to bottom. Choosing a dentist shows their free
 * times straight away (read from the clinic's diary through /api/slots, no
 * chat message). Only "Confirm" sends anything: one message with everything,
 * which the assistant books at once.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { clinic, dentists, services } from '@/content/clinic';
import type { Dict, Lang } from '@/lib/i18n';
import { minutes, money } from '@/lib/format';
import { clock, dayTitle, nextDays, type DoctorsAnswer, type SlotOption, type SlotsAnswer } from '@/lib/slots';

export type PanelStart = { service?: string; dentist?: string };
export type BookingRequest = {
  serviceId: string; serviceName: string; dentistId: string; dentistName: string;
  date: string; time: string; name: string; phone: string; email: string;
};
type Step = 'treatment' | 'dentist' | 'time' | 'days' | 'day' | 'details';
const ANY = 'any';

/** What the assistant receives when the visitor confirms (it books this straight away). */
export function requestMessage(r: BookingRequest) {
  return [
    'BOOKING FORM: the visitor chose this from the free times and pressed Confirm.',
    `Treatment: ${r.serviceName} (id ${r.serviceId})`,
    `Dentist: ${r.dentistName || 'any'} (id ${r.dentistId || ANY})`,
    `Date: ${r.date} (${dayTitle('en', r.date)})`,
    `Time: ${r.time} (${clock('en', r.time)})`,
    `Name: ${r.name}`,
    `Mobile: ${r.phone}`,
    `Email: ${r.email}`,
  ].join('\n');
}

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(String(r.status));
  return r.json() as Promise<T>;
}

function Row({ title, sub, onClick, accent, right }: { title: ReactNode; sub?: ReactNode; onClick: () => void; accent?: boolean; right?: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-start ring-1 transition active:scale-[0.99] ${
        accent ? 'bg-sky/70 ring-brand/30 hover:ring-brand' : 'bg-white ring-line hover:ring-brand/60 hover:shadow-sm'}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold leading-snug text-ink">{title}</span>
        {sub && <span className="mt-0.5 block text-xs leading-snug text-muted">{sub}</span>}
      </span>
      {right}
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted transition group-hover:text-brand rtl:-scale-x-100" aria-hidden="true">
        <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="space-y-2" role="status">
      <p className="text-xs text-muted">{text}</p>
      {[0, 1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse rounded-2xl bg-white ring-1 ring-line" style={{ animationDelay: `${i * 120}ms` }} />)}
    </div>
  );
}

export function BookingPanel({ lang, t, minWord, start, onClose, onConfirm }: {
  lang: Lang; t: Dict['chat']; minWord: string; start: PanelStart; onClose: () => void; onConfirm: (r: BookingRequest) => void;
}) {
  const startService = services.find(s => s.id === start.service);
  const [step, setStep] = useState<Step>(startService ? 'dentist' : 'treatment');
  const [service, setService] = useState(startService?.id ?? '');
  const [dentist, setDentist] = useState<{ id: string; name: string } | null>(null);
  const [doctors, setDoctors] = useState<DoctorsAnswer['doctors'] | null>(null);
  const [slots, setSlots] = useState<SlotsAnswer | null>(null);
  const [day, setDay] = useState('');
  const [pick, setPick] = useState<SlotOption | null>(null);
  const [failed, setFailed] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [errors, setErrors] = useState<Partial<Record<'name' | 'phone' | 'email', string>>>({});
  const [history, setHistory] = useState<Step[]>([]);
  const [attempt, setAttempt] = useState(0);   // "Try again" after a failed load

  const svc = services.find(s => s.id === service);
  const go = (next: Step) => { setHistory(h => [...h, step]); setStep(next); setFailed(false); };
  const back = () => { const h = [...history]; const prev = h.pop(); setHistory(h); if (prev) setStep(prev); else onClose(); };

  // keep the details typed earlier in this visit
  useEffect(() => {
    try { const v = JSON.parse(sessionStorage.getItem('df-details') || 'null'); if (v && typeof v === 'object') setForm(f => ({ ...f, ...v })); } catch { /* ignore */ }
  }, []);

  // step 2: who does this treatment
  useEffect(() => {
    if (step !== 'dentist' || !service) return;
    let live = true;
    setDoctors(null);
    getJSON<DoctorsAnswer>(`/api/slots?mode=doctors&service=${encodeURIComponent(service)}`)
      .then(d => {
        if (!live) return;
        const list = d.doctors ?? [];
        const wanted = list.find(x => x.id === start.dentist);
        if (wanted || list.length === 1) {               // a dentist asked for, or the only one: straight to the times
          const only = wanted ?? list[0];
          setDentist(only); setStep('time'); return;
        }
        if (list.length === 0) { setDentist({ id: ANY, name: '' }); setStep('time'); return; }
        setDoctors(list);
      })
      .catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [step, service, start.dentist, attempt]);

  // step 3: their next free times, or every free time on one day
  useEffect(() => {
    if ((step !== 'time' && step !== 'day') || !service || !dentist) return;
    let live = true;
    setSlots(null);
    const q = `service=${encodeURIComponent(service)}&doctor=${encodeURIComponent(dentist.id || ANY)}&lang=${lang}`;
    getJSON<SlotsAnswer>(step === 'time' ? `/api/slots?mode=next&${q}` : `/api/slots?mode=day&${q}&date=${day}`)
      .then(s => live && setSlots(s))
      .catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [step, service, dentist, day, lang, attempt]);

  const grouped = useMemo(() => {
    const g = new Map<string, SlotOption[]>();
    for (const o of slots?.options ?? []) { if (!g.has(o.date)) g.set(o.date, []); g.get(o.date)!.push(o); }
    return [...g.entries()];
  }, [slots]);

  const choose = (o: SlotOption) => { setPick(o); go('details'); };
  const specialty = (id: string) => dentists.find(d => d.id === id)?.specialty[lang];
  const confirm = () => {
    const e: typeof errors = {};
    const name = form.name.trim().replace(/\s+/g, ' ');
    const digits = form.phone.replace(/[^\d]/g, '');
    if ((name.match(/\p{L}/gu) || []).length < 2) e.name = t.badName;
    if (digits.length < 10 || digits.length > 15) e.phone = t.badPhone;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = t.badEmail;
    setErrors(e);
    if (Object.keys(e).length || !svc || !pick) return;
    try { sessionStorage.setItem('df-details', JSON.stringify({ name, phone: form.phone.trim(), email: form.email.trim() })); } catch { /* ignore */ }
    const docName = pick.doctorName || (dentist && dentist.id !== ANY ? dentist.name : '');
    onConfirm({ serviceId: svc.id, serviceName: svc.name.en, dentistId: pick.doctor || (dentist?.id ?? ANY), dentistName: docName,
      date: pick.date, time: pick.time, name, phone: form.phone.trim(), email: form.email.trim() });
  };

  const titles: Record<Step, string> = { treatment: t.stepTreatment, dentist: t.stepDentist, time: t.stepTime, days: t.pickDay, day: t.stepTime, details: t.stepDetails };
  const n = { treatment: 1, dentist: 2, time: 3, days: 3, day: 3, details: 4 }[step];
  const crumbs = [svc?.name[lang], dentist && dentist.id !== ANY ? dentist.name : dentist ? t.anyDentist : '', pick ? `${dayTitle(lang, pick.date, true)} · ${clock(lang, pick.time)}` : '']
    .filter((x, i) => x && i < n - 1);

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 340, damping: 34 }}
      className="absolute inset-x-0 bottom-0 top-3 z-20 flex flex-col overflow-hidden rounded-t-[1.5rem] bg-mist shadow-[0_-20px_50px_-20px_rgb(11_27_43/0.35)] ring-1 ring-black/5"
      role="dialog" aria-label={t.panelTitle}
    >
      {/* header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line/70 bg-white/90 px-3 py-3 backdrop-blur">
        <button type="button" onClick={back} aria-label={t.back} className="grid h-9 w-9 place-items-center rounded-full hover:bg-mist">
          <svg viewBox="0 0 20 20" className="h-4.5 w-4.5 rtl:-scale-x-100" aria-hidden="true"><path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide text-brand uppercase">{t.panelTitle}</p>
          <h3 className="truncate text-[15px] font-semibold text-ink">{titles[step]}</h3>
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map(i => <span key={i} className={`h-1.5 rounded-full transition-all ${i === n ? 'w-5 bg-brand' : i < n ? 'w-1.5 bg-brand/50' : 'w-1.5 bg-line'}`} />)}
        </div>
        <button type="button" onClick={onClose} aria-label={t.close} className="grid h-9 w-9 place-items-center rounded-full hover:bg-mist">
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>
      {crumbs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {crumbs.map(c => <span key={c} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-ink-soft ring-1 ring-line">{c}</span>)}
        </div>
      )}

      {/* body */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step + day} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="space-y-2">
            {failed && (
              <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-900 ring-1 ring-rose-200">
                {t.slotsError}{' '}
                <button type="button" className="font-semibold underline" onClick={() => { setFailed(false); setAttempt(a => a + 1); }}>{t.retry}</button>
              </div>
            )}

            {step === 'treatment' && services.map(s => (
              <Row key={s.id} title={s.name[lang]} sub={`${minutes(lang, s.minutes, minWord)} · ${money(lang, s.price, clinic.currency)}`}
                onClick={() => { setService(s.id); setDentist(null); go('dentist'); }} />
            ))}

            {step === 'dentist' && !failed && (doctors === null ? <Loading text={t.loading} /> : (
              <>
                <Row accent title={t.anyDentist} sub={t.anyDentistHint} onClick={() => { setDentist({ id: ANY, name: '' }); go('time'); }} />
                {doctors.map(d => (
                  <Row key={d.id} title={<span dir="ltr">{d.name}</span>} sub={specialty(d.id)} onClick={() => { setDentist(d); go('time'); }} />
                ))}
              </>
            ))}

            {(step === 'time' || step === 'day') && !failed && (slots === null ? <Loading text={t.loading} /> : (
              <>
                {step === 'day' && <p className="pb-1 text-sm font-semibold text-ink">{dayTitle(lang, day)}</p>}
                {grouped.length === 0 && <p className="rounded-2xl bg-white p-4 text-sm text-ink-soft ring-1 ring-line">{t.noTimes}</p>}
                {grouped.map(([date, opts]) => (
                  <div key={date} className="space-y-2 pb-2">
                    {step === 'time' && <p className="sticky top-0 z-10 bg-mist/95 py-1 text-xs font-semibold tracking-wide text-muted uppercase backdrop-blur">{dayTitle(lang, date)}</p>}
                    {opts.map(o => (
                      <Row key={o.date + o.time + o.doctor} title={<span className="tabular-nums">{clock(lang, o.time)}</span>}
                        sub={o.doctorName && (!dentist || dentist.id === ANY) ? <span dir="ltr">{o.doctorName}</span> : undefined} onClick={() => choose(o)} />
                    ))}
                  </div>
                ))}
                <Row accent title={t.otherDays} onClick={() => go('days')} />
              </>
            ))}

            {step === 'days' && nextDays(14).map(d => (
              <Row key={d} title={dayTitle(lang, d)} onClick={() => { setDay(d); go('day'); }} />
            ))}

            {step === 'details' && pick && svc && (
              <form className="space-y-3" onSubmit={e => { e.preventDefault(); confirm(); }} noValidate>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
                  <p className="text-[15px] font-semibold text-ink">{svc.name[lang]}</p>
                  <p className="mt-1 text-sm text-ink-soft">{dayTitle(lang, pick.date)} · <span className="tabular-nums">{clock(lang, pick.time)}</span></p>
                  {(pick.doctorName || (dentist && dentist.id !== ANY)) && <p className="mt-0.5 text-sm text-ink-soft" dir="ltr">{pick.doctorName || dentist?.name}</p>}
                </div>
                {([['name', t.name, '', 'name', 'text'], ['phone', t.phone, t.phoneHint, 'tel', 'tel'], ['email', t.email, t.emailHint, 'email', 'email']] as const).map(([k, label, hint, auto, type]) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-xs font-semibold text-ink-soft">{label}</span>
                    <input type={type} autoComplete={auto} value={form[k]} dir={k === 'name' ? 'auto' : 'ltr'}
                      onChange={e => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(x => ({ ...x, [k]: undefined })); }}
                      aria-invalid={!!errors[k]}
                      className={`w-full rounded-xl bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none ring-1 transition focus:ring-2 focus:ring-brand/50 ${errors[k] ? 'ring-rose-300' : 'ring-line'}`} />
                    {errors[k] ? <span className="mt-1 block text-xs text-rose-700">{errors[k]}</span> : hint ? <span className="mt-1 block text-[11px] text-muted">{hint}</span> : null}
                  </label>
                ))}
                <button type="submit" className="w-full rounded-full bg-ink py-3 text-sm font-semibold text-white transition hover:bg-brand-deep active:scale-[0.98]">
                  {t.confirmBooking}
                </button>
              </form>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
