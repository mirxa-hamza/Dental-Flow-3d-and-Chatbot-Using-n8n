/**
 * DEMO MODE for "My appointments": any mobile number or email shows two
 * sample appointments, and cancelling one only changes this server's memory.
 * Nothing real is looked up or cancelled.
 */
import { dentists, services } from '@/content/clinic';
import type { Appointment, AppointmentsAnswer, Contact } from './appointments';
import { nextDays } from './slots';

const cancelled = new Map<string, Set<string>>();
const keyOf = (c: Contact) => (c.email || '') + '|' + (c.phone || '').slice(-10);

function sample(c: Contact): Appointment[] {
  const k = keyOf(c);
  let h = 7;
  for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) % 900000;
  const days = nextDays(9);
  const gone = cancelled.get(k) ?? new Set();
  const list: Appointment[] = [
    { reference: `DN-${100000 + h}`, service: services[0].name.en, dentist: dentists[0]?.name ?? '', date: days[2], time: '10:30', minutes: services[0].minutes, status: 'confirmed' },
    { reference: `DN-${100000 + ((h * 7) % 900000)}`, service: services[2].name.en, dentist: dentists[1]?.name ?? dentists[0]?.name ?? '', date: days[6], time: '15:00', minutes: services[2].minutes, status: 'confirmed' },
  ];
  return list.filter(a => !gone.has(a.reference));
}

export function demoAppointments(c: Contact): AppointmentsAnswer {
  return { ok: true, appointments: sample(c) };
}

export function demoCancel(c: Contact, reference: string): AppointmentsAnswer {
  const k = keyOf(c);
  if (!sample(c).some(a => a.reference === reference)) return { ok: false, reason: 'not-found' };
  const set = cancelled.get(k) ?? new Set<string>();
  set.add(reference);
  cancelled.set(k, set);
  if (cancelled.size > 2000) cancelled.clear();
  return { ok: true, cancelled: true, reference, emailed: !!c.email };
}
