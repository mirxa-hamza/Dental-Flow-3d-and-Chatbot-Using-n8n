'use client';
/**
 * Lifts the loading screen: once the fonts are in and the 3D tooth has drawn
 * its first frames (or straight away on devices without 3D), and never later
 * than 4 seconds, so a slow connection still gets the page.
 */
import { useEffect } from 'react';

export const SCENE_READY = 'df:scene-ready';

export function ReadyGate() {
  useEffect(() => {
    const html = document.documentElement;
    if (html.hasAttribute('data-ready')) return;
    const start = performance.now();
    let done = false;
    const lift = () => {
      if (done) return;
      done = true;
      setTimeout(() => html.setAttribute('data-ready', ''), Math.max(0, 500 - (performance.now() - start)));
    };
    let webgl = false;
    try { const c = document.createElement('canvas'); webgl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { webgl = false; }
    const w = window as Window & { __dfSceneReady?: boolean };
    const scene = !webgl || w.__dfSceneReady ? Promise.resolve() : new Promise<void>(r => window.addEventListener(SCENE_READY, () => r(), { once: true }));
    const fonts = (document.fonts?.ready ?? Promise.resolve()).catch(() => undefined);
    Promise.all([scene, fonts]).then(lift);
    const id = setTimeout(lift, 4000);
    return () => clearTimeout(id);
  }, []);
  return null;
}
