'use client';
import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { fill, type Dict } from '@/lib/i18n';
import { HeroScene, ToothArt, useWebGL } from '../three/SceneLoader';
import { tooth3d } from '@/content/clinic';
import { Arrow, OpenChatButton } from './ui';

export function Hero({ t, city }: { t: Dict; city: string }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const webgl = useWebGL();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  // as the visitor scrolls away, the tooth drifts down and the text lifts and fades
  const sceneY = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '18%']);
  const sceneScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 0.86]);
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '-12%']);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  // The entrance is plain CSS (.rise in globals.css): it starts the moment the loading screen lifts,
  // and never leaves the text blurred or hidden while the page's JavaScript is still loading.
  const up = (i: number) => ({ style: { '--rise-delay': `${0.08 + i * 0.08}s` } as React.CSSProperties });

  return (
    <section ref={ref} className="relative isolate min-h-[100svh] overflow-hidden pt-24">
      <div className="aurora pointer-events-none absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-linear-to-b from-transparent to-[var(--page-bg)]" />

      <div className="mx-auto grid min-h-[calc(100svh-6rem)] max-w-6xl items-center gap-6 px-5 pb-16 md:grid-cols-[1.15fr_1fr] md:gap-2">
        <motion.div style={{ y: textY, opacity: fade }} className="relative z-10 order-2 md:order-1">
          <p style={up(0).style} className="rise glass mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-brand-deep">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            {fill(t.hero.eyebrow, { city })}
          </p>
          <h1 className="text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-[4.4rem]">
            <span style={up(1).style} className="rise block">{t.hero.title1}</span>
            <span style={up(2).style} className="rise block bg-linear-to-r from-brand via-accent to-brand-deep bg-clip-text pb-1 text-transparent">
              {t.hero.title2}
            </span>
          </h1>
          <p style={up(3).style} className="rise text-pretty mt-6 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
            {t.hero.sub}
          </p>
          <div style={up(4).style} className="rise mt-8 flex flex-wrap items-center gap-3">
            <OpenChatButton className="px-6! py-3.5!">
              {t.hero.cta}
              <Arrow />
            </OpenChatButton>
            <a href="#treatments" className="inline-flex items-center rounded-full px-5 py-3.5 text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-white/80">
              {t.hero.secondary}
            </a>
          </div>
          <ul style={up(5).style} className="rise mt-8 flex flex-wrap gap-2">
            {t.hero.chips.map(c => (
              <li key={c} className="rounded-full bg-white/60 px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-line">
                {c}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div style={{ y: sceneY, scale: sceneScale }} className="relative order-1 h-[36svh] min-h-[240px] md:order-2 md:h-[640px]">
          <div className="rise-scene absolute inset-0">
          <div className="absolute inset-[12%] -z-10 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgb(43_123_234/0.16),rgb(14_116_144/0.09)_42%,transparent_70%)] blur-2xl" />
          {webgl === false
            ? <div className="grid h-full place-items-center"><ToothArt className="h-[60%] w-auto" /></div>
            : webgl && <HeroScene host={ref} look={tooth3d} />}
          </div>
        </motion.div>
      </div>

      <a
        href="#story"
        className="absolute inset-x-0 bottom-6 mx-auto hidden w-max flex-col items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-muted uppercase md:flex"
      >
        {t.hero.scroll}
        <span className="flex h-9 w-5.5 justify-center rounded-full ring-1 ring-line">
          <motion.span
            className="mt-1.5 h-2 w-1 rounded-full bg-brand"
            animate={reduce ? undefined : { y: [0, 10, 0], opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </span>
      </a>
    </section>
  );
}
