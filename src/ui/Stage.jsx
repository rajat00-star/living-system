import { Component, useEffect, useRef, useState } from 'react';
import { useSnapshot, useStore, useStoreApi } from '../lib/store.js';

// The label that follows the pointer over the 3D scene. Its words are also in the page,
// so the whole stage is hidden from assistive technology.
function HoverLabel() {
  const hover = useStore((s) => s.hover);
  const ref = useRef(null);
  useEffect(() => {
    const move = (event) => {
      if (ref.current) ref.current.style.transform = `translate3d(${event.clientX + 18}px, ${event.clientY + 16}px, 0)`;
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);
  const show = Boolean(hover && hover.source === 'scene' && hover.label);
  return (
    <div ref={ref} className={`hover-label${show ? ' is-on' : ''}`}>
      {show ? (
        <>
          <span className="hover-label__name">{hover.label}</span>
          {hover.detail ? <span className="hover-label__detail">{hover.detail}</span> : null}
        </>
      ) : null}
    </div>
  );
}

// If the scene cannot start (a GPU that refuses a WebGL 2 context, a driver error), the page
// says so and shows the still plates instead of an empty stage.
class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.store.set({ webgl: 'unavailable', sceneReady: false });
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Hosts the WebGL scene. Its code (three.js and friends) is a separate chunk that loads only
// after the prerendered page has painted, and only when WebGL 2 exists and 3D is on. On touch
// devices it waits for the first scroll or touch, so a phone spends nothing on 3D until its
// reader engages; the still plate of the Core is already on screen and hands over to it.
export function Stage() {
  const store = useStoreApi();
  const snapshot = useSnapshot();
  const enabled = useStore((s) => s.prefs.three && s.webgl !== 'unavailable' && s.webgl !== 'lost');
  const [Scene, setScene] = useState(null);

  useEffect(() => {
    if (!enabled || Scene) return undefined;
    let cancelled = false;
    const load = () =>
      import('../scene/Scene.jsx')
        .then((module) => {
          if (!cancelled) setScene(() => module.Scene);
        })
        .catch(() => {
          if (!cancelled) store.set({ webgl: 'unavailable' });
        });
    const touch = window.matchMedia('(pointer: coarse)').matches;
    let idle = 0;
    const schedule = () => {
      idle = window.requestIdleCallback ? window.requestIdleCallback(load, { timeout: 1200 }) : window.setTimeout(load, 250);
    };
    const events = ['scroll', 'pointerdown', 'keydown', 'wheel'];
    const engage = () => {
      events.forEach((name) => window.removeEventListener(name, engage));
      schedule();
    };
    if (touch) events.forEach((name) => window.addEventListener(name, engage, { passive: true, once: true }));
    else schedule();
    return () => {
      cancelled = true;
      events.forEach((name) => window.removeEventListener(name, engage));
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [enabled, Scene, store]);

  return (
    <div className="stage" aria-hidden="true">
      {Scene && enabled ? (
        <SceneBoundary store={store}>
          <Scene store={store} snapshot={snapshot} />
        </SceneBoundary>
      ) : null}
      <div id="scene-labels" className="scene-labels" />
      <HoverLabel />
    </div>
  );
}
