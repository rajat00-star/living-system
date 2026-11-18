import { FIGURES } from '../lib/data.js';
import { useStore, useStoreApi } from '../lib/store.js';

function Switch({ label, on, onToggle, title, unavailable = false }) {
  return (
    <button type="button" className="switch" aria-pressed={on} onClick={onToggle} title={title} data-sfx="none" disabled={unavailable}>
      <span className="switch__label">{label}</span>
      <span className="switch__state" aria-hidden="true">
        {unavailable ? 'n/a' : on ? 'on' : 'off'}
      </span>
    </button>
  );
}

export function Masthead() {
  const store = useStoreApi();
  const figure = useStore((s) => s.figure);
  const motion = useStore((s) => s.prefs.motion);
  const sound = useStore((s) => s.prefs.sound);
  const three = useStore((s) => s.prefs.three);
  const webgl = useStore((s) => s.webgl);
  const { actions } = store;

  const jump = (event, index) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    actions.goTo(index);
  };

  return (
    <header className="masthead">
      <a className="wordmark" href="#core" onClick={(event) => jump(event, 0)}>
        <span className="wordmark__pulse" aria-hidden="true" />
        <span className="wordmark__kicker">GitHub //</span>
        <span className="wordmark__name">The Living System</span>
      </a>

      <nav className="rail" aria-label="Figures">
        <ol>
          {FIGURES.map((f, i) => (
            <li key={f.id}>
              <a href={`#${f.id}`} aria-current={figure === i ? 'step' : undefined} onClick={(event) => jump(event, i)}>
                <span className="rail__n">{f.number}</span>
                <span className="rail__name">{f.name}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="switches" role="group" aria-label="Preferences">
        <Switch label="Motion" on={motion} onToggle={() => actions.setPref('motion', !motion)} title="Camera flights, flowing particles and morphs" />
        <Switch label="Sound" on={sound} onToggle={() => actions.setPref('sound', !sound)} title="Synthesised sound, off by default" />
        <Switch
          label="3D"
          on={three && webgl !== 'unavailable'}
          unavailable={webgl === 'unavailable'}
          onToggle={() => actions.setPref('three', !three)}
          title={webgl === 'unavailable' ? 'This browser has no WebGL 2, so the page shows still plates' : 'The WebGL scene; off shows still plates'}
        />
      </div>
    </header>
  );
}
