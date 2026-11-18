import { toriOrder } from '../lib/data.js';
import { formatBytes, formatInt } from '../lib/format.js';
import { useSnapshot, useStore, useStoreApi } from '../lib/store.js';
import { fileClassNames } from '../lib/tokens.js';
import { Readout } from './bits.jsx';

export function CoreFigure() {
  const snapshot = useSnapshot();
  const { actions } = useStoreApi();
  const hover = useStore((s) => (s.hover?.kind === 'torus' ? s.hover.id : null));
  const { totals, profile, identity } = snapshot;
  const tori = toriOrder(snapshot);

  const hoverTorus = (repo) => actions.hover(repo ? { kind: 'torus', id: repo.name, label: repo.displayName, detail: `${formatInt(repo.morphology.files)} files`, source: 'list' } : null);

  return (
    <section id="core" className="fig fig--core" aria-labelledby="core-title">
      <div className="fig__stage">
        <div className="hero">
          <p className="kicker">
            <span className="kicker__mark">GitHub</span> // {profile.login}
          </p>
          <h1 id="core-title" className="display" tabIndex={-1}>
            The Living <em>System</em>
          </h1>
          <p className="lede">
            {identity.name}’s public GitHub, rendered as one computational organism. Every file in every public repository is a fibre of this core, and every torus is a repository.
            It is {formatInt(totals.ageDays)} days old; its geometry is computed from the data, so it grows with every commit.
          </p>
          <Readout
            className="readout--hero"
            items={[
              ['repositories', formatInt(totals.repos)],
              ['files', formatInt(totals.files)],
              ['source', formatBytes(totals.bytes)],
              ['languages', formatInt(totals.languages)],
              ['days old', formatInt(totals.ageDays)],
            ]}
          />
        </div>

        <figure className="plate plate--core">
          <img src="plates/core.svg" width="900" height="760" alt={`A still drawing of the Core: ${formatInt(totals.files)} fibres, one per file, woven into ${tori.length} nested tori, one per repository.`} decoding="async" fetchPriority="high" />
        </figure>

        <aside className="legend" aria-labelledby="core-legend">
          <p className="label" id="core-legend">
            <span className="label__accent">Fig. 01</span> The Core
          </p>
          <ol className="tori">
            {tori.map((repo, i) => (
              <li key={repo.name}>
                <button
                  type="button"
                  className="tori__item"
                  aria-pressed={hover === repo.name}
                  onPointerEnter={() => hoverTorus(repo)}
                  onPointerLeave={() => hoverTorus(null)}
                  onFocus={() => hoverTorus(repo)}
                  onBlur={() => hoverTorus(null)}
                  onClick={(event) => actions.select(repo.id, { from: event.currentTarget })}
                >
                  <span className="tori__k" aria-hidden="true">
                    T{i + 1}
                  </span>
                  <span className="tori__name">{repo.displayName}</span>
                  <span className="tori__n">{formatInt(repo.morphology.files)}</span>
                </button>
              </li>
            ))}
          </ol>
          <ul className="key" aria-label="Fibre colours">
            {fileClassNames.map((name, i) => (
              <li key={name} className={`key__item key__item--${i}`}>
                {name}
              </li>
            ))}
          </ul>
          <p className="caption">
            Each fibre is a great circle of the 3-sphere, carried to space by stereographic projection: a Hopf fibration, where every pair of fibres is linked.{' '}
            <span className="when-3d">Move the pointer to re-fold it in four dimensions.</span>
          </p>
        </aside>

        <a className="cue" href="#specimens" onClick={(event) => (event.preventDefault(), actions.goTo(1))}>
          Scroll to separate the core
          <span aria-hidden="true"> ↓</span>
        </a>
      </div>
    </section>
  );
}
