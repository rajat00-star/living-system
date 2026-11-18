// Everything a visitor can do, in one place, so the page, the keyboard and the 3D scene
// all change state the same way.
import { FIGURES, specimens } from './data.js';
import { loadGeometry } from './geometry.js';
import { KEYS, writePref } from './prefs.js';
import { setSound, sfx } from './sound.js';
import { goToFigure, timeline } from './timeline.js';

// The snake's clock, shared by the 3D terrain and the flat grid. `step` is fractional so
// the 3D snake glides between cells; the store only hears whole steps.
const PING = { torus: 0, specimen: 2, day: 4, tech: 5 };

export const snakeClock = { step: 0, playing: false, speed: 7, base: 0, startedAt: 0, path: null, eats: null };

export function createActions(store, snapshot) {
  const list = specimens(snapshot);
  let raf = 0;
  let returnFocus = null;

  const motion = () => store.get().prefs.motion;

  function select(id, { from = null, scroll = true } = {}) {
    const current = store.get().selected;
    if (id === current) return;
    if (from) returnFocus = from;
    store.set({ selected: id, hover: null });
    if (id) {
      sfx.open();
      if (scroll && timeline.figure !== 1) goToFigure('specimens', { motion: motion(), focus: false });
      requestAnimationFrame(() => document.getElementById(`specimen-${id}-name`)?.focus({ preventScroll: true }));
    }
  }

  function close() {
    if (!store.get().selected) return;
    store.set({ selected: null, layerPinned: null, layerHover: null });
    sfx.close();
    const target = returnFocus;
    returnFocus = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
  }

  function cycle(direction) {
    const ids = list.map((s) => s.id);
    const at = ids.indexOf(store.get().selected);
    const next = ids[(at + direction + ids.length) % ids.length] ?? ids[0];
    select(next, { scroll: false });
  }

  function setPref(key, value) {
    const prefs = { ...store.get().prefs, [key]: value };
    const root = document.documentElement;
    if (key === 'motion') {
      root.dataset.motion = value ? 'on' : 'off';
      writePref(KEYS.motion, value ? 'on' : 'off');
    }
    if (key === 'three') {
      root.classList.toggle('has-3d', value);
      writePref(KEYS.three, value ? 'on' : 'off');
    }
    if (key === 'sound' && !setSound(value)) prefs.sound = false;
    store.set({ prefs });
  }

  // ---- snake
  function snakeTick() {
    const last = snakeClock.path.length - 1;
    const s = snakeClock.playing ? snakeClock.base + ((performance.now() - snakeClock.startedAt) / 1000) * snakeClock.speed : snakeClock.base;
    snakeClock.step = Math.min(s, last);
    const whole = Math.floor(snakeClock.step);
    if (whole !== store.get().snakeStep) {
      if (snakeClock.eats.some((eat) => eat.step === whole)) sfx.bite(snakeClock.eats.find((eat) => eat.step === whole).level);
      store.set({ snakeStep: whole });
    }
    if (s >= last) {
      snakeClock.playing = false;
      snakeClock.base = last;
      store.set({ snake: 'done' });
      return;
    }
    if (snakeClock.playing) raf = requestAnimationFrame(snakeTick);
  }

  async function snakePlay() {
    const geometry = await loadGeometry(snapshot.generatedAt);
    snakeClock.path = geometry.snake.path;
    snakeClock.eats = geometry.snake.eats;
    if (store.get().snake === 'done') {
      snakeClock.base = 0;
      store.set({ snakeStep: 0 });
    }
    snakeClock.playing = true;
    snakeClock.startedAt = performance.now();
    store.set({ snake: 'playing' });
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(snakeTick);
  }

  function snakePause() {
    if (!snakeClock.playing) return;
    snakeClock.base = snakeClock.step;
    snakeClock.playing = false;
    cancelAnimationFrame(raf);
    store.set({ snake: 'paused' });
  }

  return {
    select,
    close,
    cycle,
    setPref,
    // A soft ping, tuned by what is under the pointer, when it moves onto something new.
    hover: (hover) => {
      const previous = store.get().hover;
      if (hover && (hover.kind !== previous?.kind || hover.id !== previous?.id)) sfx.ping(PING[hover.kind] ?? 0);
      store.set({ hover });
    },
    focusTech: (techFocus) => store.set({ techFocus }),
    setTechClass: (techClass) => store.set({ techClass, techFocus: null }),
    focusDay: (dayFocus) => store.set({ dayFocus }),
    hoverLayer: (layerHover) => store.set({ layerHover }),
    pinLayer: (key) => store.set({ layerPinned: store.get().layerPinned === key ? null : key }),
    goTo: (index) => goToFigure(FIGURES[index].id, { motion: motion() }),
    snakeToggle: () => (snakeClock.playing ? snakePause() : snakePlay()),
    snakeReset: () => {
      snakePause();
      snakeClock.base = 0;
      snakeClock.step = 0;
      store.set({ snake: 'idle', snakeStep: 0 });
    },
  };
}
