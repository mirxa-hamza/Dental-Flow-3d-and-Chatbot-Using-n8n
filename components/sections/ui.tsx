'use client';
/** Small shared pieces: the scroll reveal, the "open the chat" button, the section heading and the logo. */
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export const OPEN_CHAT_EVENT = 'dentalflow:open-chat';
/** book: open the booking panel (optionally with a treatment or a dentist already chosen); message: send it as the first message */
export type OpenChatDetail = { message?: string; book?: { service?: string; dentist?: string } };

/** Opens the chat window: on the booking panel, or with a first message. */
export function openChat(detail: OpenChatDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenChatDetail>(OPEN_CHAT_EVENT, { detail }));
}

/** A "Book" button anywhere on the page: opens the chat on its booking panel. */
export function OpenChatButton({ children, message, book, className = '', variant = 'primary' }: {
  children: ReactNode; message?: string; book?: OpenChatDetail['book']; className?: string; variant?: 'primary' | 'ghost' | 'soft';
}) {
  const styles = {
    primary: 'bg-ink text-white shadow-[0_14px_30px_-12px_rgb(11_27_43/0.55)] hover:bg-brand-deep',
    ghost: 'bg-white/70 text-ink ring-1 ring-line hover:bg-white',
    soft: 'bg-sky text-brand-deep hover:bg-brand hover:text-white',
  }[variant];
  return (
    <button
      type="button"
      onClick={() => openChat(message ? { message } : { book: book ?? {} })}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-300 ease-out-quart active:scale-[0.97] ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Reveal({ children, delay = 0, className = '', as = 'div' }: {
  children: ReactNode; delay?: number; className?: string; as?: 'div' | 'li' | 'article';
}) {
  const reduce = useReducedMotion();
  const M = motion[as];
  return (
    <M
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.8, delay, ease: [0.25, 1, 0.5, 1] }}
    >
      {children}
    </M>
  );
}

export function Heading({ eyebrow, title, center }: { eyebrow: string; title: string; center?: boolean }) {
  return (
    <Reveal className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-brand uppercase">{eyebrow}</p>
      <h2 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl md:text-5xl">{title}</h2>
    </Reveal>
  );
}

export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-xl bg-linear-to-br from-brand to-accent text-white shadow-lift ${className}`}>
      <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3.2c-2-1.3-6.4-1.3-7.7 1.6-1.3 2.9.2 6.4 1.1 8.6.9 2.4.7 6.6 2.4 8.4 1.3 1.3 2.2-.7 2.4-2.6.2-1.8.7-3.7 1.8-3.7s1.6 1.9 1.8 3.7c.2 1.9 1.1 3.9 2.4 2.6 1.7-1.8 1.5-6 2.4-8.4.9-2.2 2.4-5.7 1.1-8.6C18.4 1.9 14 1.9 12 3.2z"
        />
      </svg>
    </span>
  );
}

export const Arrow = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" className={`${className} rtl:-scale-x-100`} aria-hidden="true">
    <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
