// The scroll timeline: one number, t, from 0 at the top of FIG. 01 to 5 at the end of
// FIG. 05. The scene reads it every frame; React only hears when the figure changes.
// Scrolling stays native: wheel, keys, scrollbars and touch all behave normally.
import { FIGURES } from './data.js';

export const timeline = { t: 0, figure: 0, vh: 800, pointer: { x: 0, y: 0, active: false } };

let sections = [];
let frame = 0;
let started = false;

function measure() {
  sections = FIGURES.map(({ id }) => {
    const el = document.getElementById(id);
    if (!el) return null;
    return { top: el.getBoundingClientRect().top + window.scrollY, height: Math.max(1, el.offsetHeight) };
  });
  timeline.vh = window.innerHeight;
}

function update(store) {
  frame = 0;
  const probe = window.scrollY + timeline.vh * 0.5;
  let t = 0;
  sections.forEach((s, i) => {
    if (s && probe >= s.top) t = i + Math.min(1, (probe - s.top) / s.height);
  });
  timeline.t = Math.min(FIGURES.length, t);
  const figure = Math.min(FIGURES.length - 1, Math.floor(timeline.t));
  if (figure !== timeline.figure) {
    timeline.figure = figure;
    store.set({ figure });
  }
  store.set({ genomePhase: genomePhase(timeline.t) });
  document.documentElement.style.setProperty('--progress', (timeline.t / FIGURES.length).toFixed(4));
}

// FIG. 03 shows the calendar three ways as it scrolls: helix, terrain, then flow.
export function genomePhase(t) {
  const local = t - 2;
  if (local < 0.48) return 'helix';
  if (local < 0.74) return 'terrain';
  return 'flow';
}

export function startTimeline(store) {
  if (started) return () => {};
  started = true;
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(() => update(store));
  };
  const remeasure = () => {
    measure();
    schedule();
  };
  measure();
  update(store);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', remeasure);
  const observer = new ResizeObserver(remeasure);
  observer.observe(document.body);
  return () => {
    started = false;
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', remeasure);
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}

// Where a figure is best seen: partway into its pinned stage.
export function figureScrollY(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const top = el.getBoundingClientRect().top + window.scrollY;
  const pinned = Math.max(0, el.offsetHeight - window.innerHeight);
  return top + (id === FIGURES[0].id ? 0 : pinned * 0.35);
}

let glide = 0;
const ease = (x) => 1 - (1 - x) ** 4;

function stopGlide() {
  cancelAnimationFrame(glide);
  glide = 0;
  window.removeEventListener('wheel', stopGlide);
  window.removeEventListener('touchstart', stopGlide);
  window.removeEventListener('keydown', stopGlide);
}

// A deliberate glide to a figure. Any wheel, touch or key input cancels it at once, so
// the page never fights the reader. With motion off it jumps.
export function goToFigure(id, { motion = true, focus = true } = {}) {
  const to = figureScrollY(id);
  const done = () => {
    if (focus) {
      const heading = document.getElementById(`${id}-title`);
      heading?.focus({ preventScroll: true });
    }
    history.replaceState(null, '', `#${id}`);
  };
  stopGlide();
  if (!motion) {
    window.scrollTo(0, to);
    done();
    return;
  }
  const from = window.scrollY;
  const duration = Math.min(1600, 600 + Math.abs(to - from) / 3);
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / duration);
    window.scrollTo(0, from + (to - from) * ease(k));
    if (k < 1) glide = requestAnimationFrame(step);
    else {
      stopGlide();
      done();
    }
  };
  glide = requestAnimationFrame(step);
  window.addEventListener('wheel', stopGlide, { passive: true });
  window.addEventListener('touchstart', stopGlide, { passive: true });
  window.addEventListener('keydown', stopGlide);
}
