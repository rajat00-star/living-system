import { useEffect, useRef } from 'react';
import { refreshLive } from '../lib/live.js';
import { sfx } from '../lib/sound.js';
import { useSnapshot, useStore, useStoreApi } from '../lib/store.js';
import { startTimeline, timeline } from '../lib/timeline.js';

const typing = (target) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

// Client-only wiring: preferences decided before first paint, the scroll timeline, the
// live refresh and keyboard shortcuts.
export function Effects() {
  const store = useStoreApi();
  const snapshot = useSnapshot();
  const figure = useStore((s) => s.figure);
  const first = useRef(true);

  useEffect(() => {
    const root = document.documentElement;
    const webgl = root.dataset.webgl === 'yes' ? 'unknown' : 'unavailable';
    store.set({ prefs: { motion: root.dataset.motion !== 'off', sound: false, three: root.classList.contains('has-3d') }, webgl });
    root.classList.add('hydrated');
    const stopTimeline = startTimeline(store);

    const controller = new AbortController();
    const begin = () => {
      store.set({ live: { status: 'loading' } });
      refreshLive(snapshot.profile.login, { signal: controller.signal })
        .then((live) => store.set({ live }))
        .catch(() => {});
    };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(begin, { timeout: 2500 }) : window.setTimeout(begin, 1200);

    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
      const { actions } = store;
      const state = store.get();
      if (/^[1-5]$/.test(event.key)) {
        event.preventDefault();
        actions.goTo(Number(event.key) - 1);
      } else if (event.key === 'Escape') {
        if (state.selected) actions.close();
        else if (state.techFocus) actions.focusTech(null);
        else if (state.techClass) actions.setTechClass(null);
      } else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && timeline.figure === 1 && state.prefs.three && state.webgl === 'ready') {
        event.preventDefault();
        actions.cycle(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === 'm' || event.key === 'M') {
        actions.setPref('sound', !state.prefs.sound);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      stopTimeline();
      controller.abort();
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      window.removeEventListener('keydown', onKey);
    };
  }, [store, snapshot]);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const s = store.get();
      root.classList.toggle('scene-ready', Boolean(s.sceneReady && s.prefs.three));
      root.dataset.live = s.live.status;
      if (s.webgl === 'lost' || s.webgl === 'unavailable') root.classList.remove('has-3d');
    };
    sync();
    return store.subscribe(sync);
  }, [store]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    sfx.sweep();
  }, [figure]);

  return null;
}
