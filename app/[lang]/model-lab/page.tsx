import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ModelLab } from '@/components/ModelLab';

export const metadata: Metadata = { title: 'Model Lab', robots: { index: false, follow: false } };

/** Only while the site runs on your computer (npm run dev). The live site answers "not found". */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ModelLab />;
}
