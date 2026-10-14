'use client';
/**
 * "What we do": the section stays pinned while the visitor scrolls through
 * four treatments. Scroll progress (0 to 1) drives the 3D tooth directly, and
 * the text changes at each quarter. With reduced motion turned on, the four
 * treatments are shown as a plain list beside a still tooth.
 */
import { useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'motion/react';
import type { Dict } from '@/lib/i18n';
import { StoryScene, ToothArt, useWebGL } from '../three/SceneLoader';
import { tooth3d } from '@/content/clinic';

const ICONS = [
  // magnifier, layers, sparkle, aligner
  'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm4.7 11.2L20 20M10.5 7.5v6M7.5 10.5h6',
  'M12 3 3 8l9 5 9-5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5',
  'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6',
  'M4 10c0-3 3-5 8-5s8 2 8 5-2 7-4 7c-1.5 0-2-2-4-2s-2.5 2-4 2c-2 0-4-4-4-7z',
];

export function Story({ t }: { t: Dict }) {
  const host = useRef<HTMLElement>(null);
  const reduce = !!useReducedMotion();
  const webgl = useWebGL();
  const { scrollYProgress } = useScroll({ target: host, offset: ['start start', 'end end'] });
  const bar = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  const [stage, setStage] = useState(0);
  const n = t.story.stages.length;
  useMotionValueEvent(scrollYProgress, 'change', v => {
    const s = Math.min(n - 1, Math.max(0, Math.floor(v * n * 0.999)));
    setStage(prev => (prev === s ? prev : s));
  });

  const scene = (still: boolean) =>
    webgl === false
      ? <div className="grid h-full place-items-center"><ToothArt className="h-[55%] w-auto" /></div>
      : webgl && <StoryScene progress={still ? null : scrollYProgress} still={still} host={host} look={tooth3d} />;

  if (reduce) {
    return (
      <section id="story" ref={host} className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24">
        <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-brand uppercase">{t.story.eyebrow}</p>
        <div className="grid items-center gap-10 md:grid-cols-2">
          <ol className="space-y-8">
            {t.story.stages.map((s, i) => (
              <li key={s.title}>
                <h3 className="text-2xl font-semibold text-ink">{i + 1}. {s.title}</h3>
                <p className="mt-2 text-ink-soft">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="h-[420px]">{scene(true)}</div>
        </div>
      </section>
    );
  }

  return (
    <section id="story" ref={host} className="relative scroll-mt-0" style={{ height: `${n * 85 + 100}svh` }}>
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_55%_at_70%_50%,rgb(230_244_249/0.95),transparent_70%)]" />
        <div className="mx-auto grid h-full w-full max-w-6xl grid-rows-[1fr_auto] items-center gap-4 px-5 pt-20 pb-10 md:grid-cols-[0.9fr_1.1fr] md:grid-rows-1 md:pt-0 md:pb-0">
          {/* text */}
          <div className="relative z-10 order-2 md:order-1">
            <p className="mb-5 text-xs font-semibold tracking-[0.18em] text-brand uppercase">{t.story.eyebrow}</p>
            <div className="relative min-h-[11rem] sm:min-h-[12rem]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18 }}
                  transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-brand shadow-soft ring-1 ring-line">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                        <path d={ICONS[stage % ICONS.length]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="text-sm font-semibold text-muted tabular-nums">0{stage + 1} / 0{n}</span>
                  </div>
                  <h2 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-5xl">{t.story.stages[stage].title}</h2>
                  <p className="text-pretty mt-4 max-w-md text-base leading-relaxed text-ink-soft sm:text-lg">{t.story.stages[stage].body}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            {/* progress */}
            <div className="mt-8 flex items-center gap-4">
              <div className="relative h-1 w-40 overflow-hidden rounded-full bg-line">
                <motion.div style={{ scaleX: bar }} className="absolute inset-0 origin-left rounded-full bg-linear-to-r from-brand to-accent rtl:origin-right" />
              </div>
              <ol className="flex gap-2" aria-hidden="true">
                {t.story.stages.map((s, i) => (
                  <li key={s.title} className={`h-1.5 rounded-full transition-all duration-500 ${i === stage ? 'w-6 bg-brand' : 'w-1.5 bg-line'}`} />
                ))}
              </ol>
            </div>
            {/* every stage is also in the page text, for screen readers and search engines */}
            <ol className="sr-only">
              {t.story.stages.map(s => <li key={s.title}>{s.title}: {s.body}</li>)}
            </ol>
          </div>
          {/* 3D */}
          <div className="relative order-1 h-full max-h-[52svh] min-h-[260px] md:order-2 md:max-h-none md:h-[78svh]">
            {/* the scene is wider than its column and fades out at the sides, so teeth never meet a hard edge */}
            <div className="absolute inset-y-0 -start-5 -end-5 [mask-image:linear-gradient(to_right,transparent,#000_14%,#000_86%,transparent)] md:-start-[4%] md:-end-[12vw]">
              {scene(false)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
