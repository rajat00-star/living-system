import { useEffect, useState } from 'react';
import { formatDateTime, formatInt } from '../lib/format.js';
import { useSnapshot, useStore } from '../lib/store.js';

// The opening log. Every line reports something that really happened while the page
// loaded: which snapshot arrived, whether WebGL started, what GitHub answered.
export function Handshake() {
  const snapshot = useSnapshot();
  const webgl = useStore((s) => s.webgl);
  const three = useStore((s) => s.prefs.three);
  const live = useStore((s) => s.live);
  const ready = useStore((s) => s.sceneReady);
  const quality = useStore((s) => s.quality);
  const [mounted, setMounted] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hide = () => setGone(true);
    const timer = setTimeout(hide, 7000);
    const onScroll = () => {
      if (window.scrollY > 120) hide();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  if (!mounted) return <div className="handshake" aria-hidden="true" />;
  const login = snapshot.profile.login;
  const lines = [
    `snapshot ${formatDateTime(snapshot.generatedAt)} · ${snapshot.totals.repos} repositories`,
    webgl === 'unavailable' ? 'WebGL 2 unavailable · still plates' : webgl === 'lost' ? 'WebGL context lost · still plates' : !three ? '3D off · still plates' : webgl === 'ready' ? `WebGL 2 · quality ${quality}` : 'WebGL 2 · starting',
    live.status === 'idle' || live.status === 'loading'
      ? `GET api.github.com/users/${login} …`
      : live.status === 'ok'
        ? `GET api.github.com/users/${login} · ${live.cached ? 'kept from last visit' : '200'}`
        : live.status === 'limited'
          ? 'GET api.github.com · 403 rate limited · snapshot kept'
          : 'GET api.github.com · no answer · snapshot kept',
    ready ? `fold S³ → R³ · ${formatInt(snapshot.totals.files)} fibres` : null,
  ].filter(Boolean);

  return (
    <div className={`handshake${gone ? ' is-gone' : ''}`} aria-hidden="true">
      <ol>
        {lines.map((line, i) => (
          <li key={i} style={{ '--i': i }}>
            {line}
          </li>
        ))}
      </ol>
    </div>
  );
}
