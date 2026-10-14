/**
 * THE CLINIC'S OWN DETAILS, shown on the website.
 *
 * Edit this file for each clinic. The chat assistant does not read it: it
 * reads the clinic's Google Sheet (Settings, Services, Doctors, FAQ tabs) like
 * the WhatsApp assistant does, so keep the two in step. Prices and dentists
 * here are what visitors see before they open the chat.
 *
 * Every text has three versions: en (English), ur (Urdu), ar (Arabic).
 */
import type { Lang } from '@/lib/i18n';
import type { ToothLook } from '@/components/three/look';

type T = Record<Lang, string>;

export type Service = { id: string; name: T; minutes: number; price: number; blurb: T };
export type Dentist = { id: string; name: string; specialty: T; days: T; initials: string };

export const clinic = {
  name: { en: 'Smile Dental Clinic', ur: 'سمائل ڈینٹل کلینک', ar: 'عيادة سمايل لطب الأسنان' } as T,
  city: { en: 'Lahore', ur: 'لاہور', ar: 'لاهور' } as T,
  phone: '+92 300 000 0000',
  /** Digits only, with country code. Empty = no WhatsApp button. */
  whatsapp: '',
  email: 'hello@example.com',
  address: { en: '12 Main Boulevard, Lahore', ur: '12 مین بلیوارڈ، لاہور', ar: '12 مين بوليفارد، لاهور' } as T,
  mapUrl: 'https://maps.google.com/?q=12+Main+Boulevard+Lahore',
  currency: 'PKR',
  hours: [
    { day: { en: 'Monday to Thursday', ur: 'پیر تا جمعرات', ar: 'الاثنين إلى الخميس' } as T, time: '10:00 – 20:00' },
    { day: { en: 'Friday', ur: 'جمعہ', ar: 'الجمعة' } as T, time: '10:00 – 12:30 · 14:30 – 20:00' },
    { day: { en: 'Saturday', ur: 'ہفتہ', ar: 'السبت' } as T, time: '10:00 – 16:00' },
    { day: { en: 'Sunday', ur: 'اتوار', ar: 'الأحد' } as T, time: '' },
  ],
};

/**
 * The 3D tooth on the page. To use another model:
 *   1. try it first on the Model Lab page: http://localhost:3000/en/model-lab
 *   2. copy the .glb file into website/public/models/
 *   3. paste the settings the Model Lab gives you here.
 */
export const tooth3d: ToothLook = {
  file: '/models/molar.glb',   // the built-in molar
  finish: 'clinic',            // 'clinic' (white enamel), 'own' (the model's own colours) or 'glass'
  rotation: [0, 0, 0],         // degrees around X, Y, Z, if a model arrives lying down
  scale: 1,
  credit: '',                  // e.g. 'Tooth model by NAME, CC BY 4.0'
};

export const services: Service[] = [
  { id: 'checkup', minutes: 30, price: 1500,
    name: { en: 'Check-up & Consultation', ur: 'چیک اپ اور مشورہ', ar: 'فحص واستشارة' },
    blurb: { en: 'A full examination, and a clear plan if anything needs attention.', ur: 'مکمل معائنہ، اور اگر کسی علاج کی ضرورت ہو تو واضح منصوبہ۔', ar: 'فحص شامل، وخطة واضحة إذا احتاج شيء إلى علاج.' } },
  { id: 'cleaning', minutes: 45, price: 4000,
    name: { en: 'Scaling & Polishing', ur: 'سکیلنگ اور پالش', ar: 'تنظيف وتلميع الأسنان' },
    blurb: { en: 'Removes the build-up that brushing cannot reach.', ur: 'وہ میل صاف کرتی ہے جو برش سے نہیں نکلتا۔', ar: 'إزالة الترسبات التي لا تصل إليها الفرشاة.' } },
  { id: 'filling', minutes: 45, price: 5000,
    name: { en: 'Cavity Filling', ur: 'کیویٹی فلنگ', ar: 'حشو الأسنان' },
    blurb: { en: 'Tooth-coloured materials, matched to your tooth.', ur: 'دانت کے رنگ کا میٹیریل، آپ کے دانت سے ملتا ہوا۔', ar: 'مواد بلون الأسنان تتطابق مع سنّك.' } },
  { id: 'rct', minutes: 90, price: 18000,
    name: { en: 'Root Canal Treatment', ur: 'روٹ کینال ٹریٹمنٹ', ar: 'علاج عصب الأسنان' },
    blurb: { en: 'By a specialist who explains every step first.', ur: 'اسپیشلسٹ کے ہاتھوں، جو ہر مرحلہ پہلے سمجھاتے ہیں۔', ar: 'على يد أخصائي يشرح كل خطوة قبل البدء.' } },
  { id: 'extract', minutes: 45, price: 6000,
    name: { en: 'Tooth Extraction', ur: 'دانت نکلوانا', ar: 'خلع الأسنان' },
    blurb: { en: 'Gentle, careful and properly numbed.', ur: 'نرمی اور احتیاط کے ساتھ، مکمل سُن کر کے۔', ar: 'بلطف وعناية، وبتخدير كامل.' } },
  { id: 'whiten', minutes: 60, price: 15000,
    name: { en: 'Teeth Whitening', ur: 'دانت سفید کرنا', ar: 'تبييض الأسنان' },
    blurb: { en: 'A brighter smile in one visit, under supervision.', ur: 'ایک ہی وزٹ میں روشن مسکراہٹ، ماہر کی نگرانی میں۔', ar: 'ابتسامة أكثر إشراقاً في زيارة واحدة، تحت الإشراف.' } },
];

/** The clinic's dentists. Keep this list the same as the Doctors tab of the sheet: the page shows this
 *  list, but the chat books from the sheet, so a dentist missing from the sheet cannot be booked. */
export const dentists: Dentist[] = [
  { id: 'dr-ayesha', name: 'Dr. Ayesha Khan', initials: 'AK',
    specialty: { en: 'General dentistry · Orthodontics', ur: 'جنرل ڈینٹسٹری · آرتھوڈانٹکس', ar: 'طب الأسنان العام · تقويم الأسنان' },
    days: { en: 'Monday to Saturday', ur: 'پیر تا ہفتہ', ar: 'الاثنين إلى السبت' } },
  { id: 'dr-bilal', name: 'Dr. Bilal Ahmed', initials: 'BA',
    specialty: { en: 'Root canal specialist', ur: 'روٹ کینال اسپیشلسٹ', ar: 'أخصائي علاج العصب والجذور' },
    days: { en: 'Thursday to Saturday, afternoons', ur: 'جمعرات تا ہفتہ، دوپہر کے بعد', ar: 'الخميس إلى السبت، بعد الظهر' } },
];

export const faq: { q: T; a: T }[] = [
  { q: { en: 'Is there parking?', ur: 'کیا پارکنگ کی سہولت ہے؟', ar: 'هل تتوفر مواقف للسيارات؟' },
    a: { en: 'Yes, free parking in front of the clinic.', ur: 'جی ہاں، کلینک کے سامنے مفت پارکنگ ہے۔', ar: 'نعم، تتوفر مواقف مجانية أمام العيادة.' } },
  { q: { en: 'How do I pay?', ur: 'ادائیگی کیسے کر سکتے ہیں؟', ar: 'ما طرق الدفع المتاحة؟' },
    a: { en: 'Cash, card or bank transfer at the clinic.', ur: 'کلینک پر نقد، کارڈ یا بینک ٹرانسفر کے ذریعے۔', ar: 'نقداً أو بالبطاقة أو بالتحويل البنكي في العيادة.' } },
  { q: { en: 'Can I change or cancel my appointment?', ur: 'کیا اپائنٹمنٹ تبدیل یا منسوخ کر سکتے ہیں؟', ar: 'هل يمكنني تغيير الموعد أو إلغاؤه؟' },
    a: { en: 'Yes. Message us on WhatsApp from the number you booked with, up to 4 hours before.', ur: 'جی ہاں۔ جس نمبر سے بکنگ کی تھی اسی سے ہمیں واٹس ایپ پر پیغام بھیجیں، کم از کم 4 گھنٹے پہلے۔', ar: 'نعم. يرجى مراسلتنا على واتساب من الرقم الذي حُجز به الموعد، قبل 4 ساعات على الأقل.' } },
  { q: { en: 'Do you treat children?', ur: 'کیا آپ بچوں کا علاج کرتے ہیں؟', ar: 'هل تعالجون الأطفال؟' },
    a: { en: 'Yes, children are very welcome. Mention the child’s age when you book in the chat.', ur: 'جی ہاں، بچوں کو خوش آمدید۔ چیٹ میں بکنگ کرتے وقت بچے کی عمر بتا دیں۔', ar: 'نعم، نرحب بالأطفال. يرجى ذكر عمر الطفل عند الحجز في المحادثة.' } },
];
