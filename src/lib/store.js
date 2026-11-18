// A small external store shared by the page and the 3D scene. React components subscribe
// to the slices they show; the scene reads the whole state each frame without re-rendering.
import { createContext, createElement, useContext, useSyncExternalStore } from 'react';

export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(partial) {
      const next = typeof partial === 'function' ? partial(state) : partial;
      let changed = false;
      for (const key of Object.keys(next)) {
        if (!Object.is(state[key], next[key])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      state = { ...state, ...next };
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const StoreContext = createContext(null);
const SnapshotContext = createContext(null);

export function Providers({ store, snapshot, children }) {
  return createElement(SnapshotContext.Provider, { value: snapshot }, createElement(StoreContext.Provider, { value: store }, children));
}

export const useSnapshot = () => useContext(SnapshotContext);
export const useStoreApi = () => useContext(StoreContext);

// Selectors must return primitives or stable references.
export function useStore(selector) {
  const store = useContext(StoreContext);
  const read = () => selector(store.get());
  return useSyncExternalStore(store.subscribe, read, read);
}

export const initialState = (prefs) => ({
  figure: 0,
  selected: null,
  hover: null,
  techClass: null,
  techFocus: null,
  dayFocus: null,
  layerHover: null, // 'repoName:folder' previewed under the pointer
  layerPinned: null, // 'repoName:folder' pinned by a click; the 3D lights hover ?? pinned
  snake: 'idle', // idle | playing | paused | done
  snakeStep: 0,
  genomePhase: 'helix',
  prefs,
  webgl: 'unknown', // unknown | ready | unavailable | lost | off
  sceneReady: false,
  live: { status: 'idle' },
  quality: 'high',
});
