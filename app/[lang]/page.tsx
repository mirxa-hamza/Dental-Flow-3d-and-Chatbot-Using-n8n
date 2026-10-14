import { notFound } from 'next/navigation';
import { dictionaries, isLang } from '@/lib/i18n';
import { clinic } from '@/content/clinic';
import { Nav } from '@/components/sections/Nav';
import { Experience } from '@/components/sections/Experience';
import { CallToAction, Dentists, Faq, Footer, How, Treatments, Visit } from '@/components/sections/Content';
import { ChatWidget } from '@/components/chat/ChatWidget';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionaries[lang];
  return (
    <>
      <Nav lang={lang} t={t} clinicName={clinic.name[lang]} />
      <main>
        <Experience t={t} city={clinic.city[lang]} />
        <Treatments lang={lang} t={t} />
        <Dentists lang={lang} t={t} />
        <How t={t} />
        <Visit lang={lang} t={t} />
        <Faq lang={lang} t={t} />
        <CallToAction t={t} />
      </main>
      <Footer lang={lang} t={t} />
      <ChatWidget lang={lang} t={t.chat} phone={clinic.phone} minWord={t.treatments.min} />
    </>
  );
}
