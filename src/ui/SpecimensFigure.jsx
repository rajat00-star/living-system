import { specimens, techById } from '../lib/data.js';
import { formatDate, formatDateTime, formatInt, percent, plural } from '../lib/format.js';
import { useSnapshot, useStore, useStoreApi } from '../lib/store.js';
import { Ext, FigHead, Source, stripLead } from './bits.jsx';

const licenceText = (spdx) => (!spdx ? 'no licence file' : spdx === 'NOASSERTION' ? 'licence: other' : `licence ${spdx}`);

export function LanguageBar({ languages }) {
  if (!languages.length) return <p className="muted">GitHub detects no programming language in this repository.</p>;
  return (
    <figure className="langbar">
      <div className="langbar__bar" aria-hidden="true">
        {languages.map((lang, i) => (
          <span key={lang.name} className={`tone-${Math.min(i, 4)}`} style={{ flexGrow: lang.bytes }} />
        ))}
      </div>
      <figcaption>
        <ul className="langbar__legend">
          {languages.map((lang, i) => (
            <li key={lang.name}>
              <span className={`swatch tone-${Math.min(i, 4)}`} aria-hidden="true" />
              <span className="langbar__name">{lang.name}</span> <span className="langbar__pct">{percent(lang.share)}</span>{' '}
              <span className="langbar__bytes">{formatInt(lang.bytes)} bytes</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

function RepoBody({ repo, snapshot }) {
  const { actions } = useStoreApi();
  const layerPinned = useStore((s) => s.layerPinned);
  const m = repo.morphology;
  const tech = repo.tech.map((t) => techById(snapshot, t.id)).filter(Boolean);
  return (
    <>
      <p className="specimen__desc">{repo.description ?? 'No description on GitHub.'}</p>
      <dl className="facts">
        <div>
          <dt>Created</dt>
          <dd>
            <time dateTime={repo.createdAt}>{formatDate(repo.createdAt)}</time>
          </dd>
        </div>
        <div>
          <dt>Last push</dt>
          <dd>
            <time dateTime={repo.pushedAt}>{formatDate(repo.pushedAt)}</time>
          </dd>
        </div>
        <div>
          <dt>Commits</dt>
          <dd>
            {formatInt(repo.commits.count)} on <code>{repo.defaultBranch}</code>
            {repo.commits.head ? (
              <>
                {' · latest '}
                <Ext href={repo.commits.head.url} label={`Latest commit ${repo.commits.head.sha.slice(0, 7)}: ${repo.commits.head.message}`}>
                  <code>{repo.commits.head.sha.slice(0, 7)}</code>
                </Ext>
              </>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Morphology</dt>
          <dd>
            {plural(m.files, 'file')} · {plural(m.directories, 'folder')} · depth {m.maxDepth}
          </dd>
        </div>
        <div>
          <dt>Contents</dt>
          <dd>
            {formatInt(m.classes.source)} source · {formatInt(m.classes.docs)} docs · {formatInt(m.classes.config)} config · {formatInt(m.classes.other)} media and other
          </dd>
        </div>
        <div>
          <dt>Stars · forks · issues</dt>
          <dd>
            {formatInt(repo.stars)} · {formatInt(repo.forks)} · {formatInt(repo.openIssues)}
          </dd>
        </div>
        <div>
          <dt>In the calendar</dt>
          <dd>{plural(repo.contributions, 'public contribution')}</dd>
        </div>
      </dl>

      <section className="block" aria-label="Languages">
        <h4 className="label">Languages, by bytes</h4>
        <LanguageBar languages={repo.languages} />
      </section>

      {repo.stages ? (
        <section className="block">
          <h4 className="label">Pipeline, in its own words</h4>
          <ol className="stages">
            {repo.stages.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <Source repo={repo.name} path={repo.stages.path} url={repo.stages.url} />
        </section>
      ) : null}

      {repo.layers.length ? (
        <section className="block">
          <h4 className="label">Architecture</h4>
          <dl className="layers">
            {repo.layers.map((layer) => {
              const key = `${repo.name}:${layer.dir}`;
              return (
                <div key={layer.name}>
                  <dt>
                    {layer.dir ? (
                      <button
                        type="button"
                        className="layer__btn"
                        aria-pressed={layerPinned === key}
                        title="Light this folder in the specimen"
                        onClick={() => actions.pinLayer(key)}
                        onPointerEnter={() => actions.hoverLayer(key)}
                        onPointerLeave={() => actions.hoverLayer(null)}
                        onFocus={() => actions.hoverLayer(key)}
                        onBlur={() => actions.hoverLayer(null)}
                      >
                        {layer.name}
                      </button>
                    ) : (
                      layer.name
                    )}
                  </dt>
                  <dd>“{stripLead(layer.quote)}”</dd>
                </div>
              );
            })}
          </dl>
          <Source repo={repo.name} path={repo.layers[0].path} url={repo.layers[0].url} />
        </section>
      ) : null}

      {repo.notes.length ? (
        <section className="block">
          <h4 className="label">Field notes</h4>
          <ul className="notes">
            {repo.notes.map((note) => (
              <li key={note.title}>
                <p className="notes__title">{note.title}</p>
                <blockquote cite={note.url}>
                  <p>“{note.quote}”</p>
                </blockquote>
                <Source repo={repo.name} path={note.path} url={note.url} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tech.length ? (
        <section className="block">
          <h4 className="label">Technologies found</h4>
          <ul className="chips">
            {tech.map((node) => (
              <li key={node.id}>
                <button type="button" className="chip" data-class={node.class} onClick={() => (actions.focusTech(node.id), actions.goTo(3))}>
                  {node.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {repo.manifests.length ? (
        <section className="block">
          <h4 className="label">Manifests read</h4>
          {repo.manifests.map((manifest) => {
            const deps = [...manifest.dependencies, ...manifest.devDependencies.map((d) => `${d} (dev)`)];
            return (
              <details key={manifest.path} className="manifest">
                <summary>
                  <code>{manifest.path}</code> <span className="muted">{manifest.kind === 'extension' ? `manifest v${manifest.manifestVersion ?? 3}` : plural(deps.length, 'dependency', 'dependencies')}</span>
                </summary>
                {deps.length ? <p className="manifest__deps">{deps.join(', ')}</p> : null}
              </details>
            );
          })}
        </section>
      ) : null}

      <p className="specimen__foot">
        <Ext href={repo.url} className="button">
          Open {repo.name} on GitHub
        </Ext>
        <span className="label">Read {formatDateTime(snapshot.generatedAt)}</span>
      </p>
    </>
  );
}

function SealedBody({ sealed }) {
  return (
    <>
      <p className="specimen__desc">{sealed.summary}</p>
      <p className="specimen__source">Source: {sealed.source}</p>
      <p className="specimen__sealed">This repository is private. Nothing on this plate is read from GitHub: no file tree, languages, dates or counts.</p>
    </>
  );
}

function SpecimenArticle({ specimen, open }) {
  const snapshot = useSnapshot();
  const { actions } = useStoreApi();
  const { id, plate, name, repo, sealed } = specimen;
  return (
    <article id={`specimen-${id}`} className={`specimen${open ? ' is-open' : ''}${sealed ? ' specimen--sealed' : ''}`} aria-labelledby={`specimen-${id}-name`}>
      <header className="specimen__head">
        <p className="label">
          <span className="label__accent">{plate}</span> {sealed ? 'Sealed specimen · private repository' : `Specimen · public · ${licenceText(repo.license)}`}
        </p>
        <h3 id={`specimen-${id}-name`} className="specimen__name" tabIndex={-1}>
          {name}
        </h3>
        <button type="button" className="specimen__close" onClick={() => actions.close()}>
          Close<span className="sr-only"> {name}</span>
          <span aria-hidden="true"> ×</span>
        </button>
      </header>
      <img className="specimen__art" src={`plates/specimen-${id}.svg`} alt="" width="480" height="480" loading="lazy" decoding="async" />
      {repo ? <RepoBody repo={repo} snapshot={snapshot} /> : <SealedBody sealed={sealed} />}
    </article>
  );
}

export function SpecimensFigure() {
  const snapshot = useSnapshot();
  const { actions } = useStoreApi();
  const selected = useStore((s) => s.selected);
  const three = useStore((s) => s.prefs.three && s.webgl !== 'unavailable' && s.webgl !== 'lost');
  const list = specimens(snapshot);

  const choose = (event, id) => {
    if (!three || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    actions.select(selected === id ? null : id, { from: event.currentTarget, scroll: false });
  };
  const hover = (sp) => actions.hover(sp ? { kind: 'specimen', id: sp.id, source: 'list' } : null);

  return (
    <section id="specimens" className="fig fig--specimens" aria-labelledby="specimens-title">
      <div className="fig__stage">
        <FigHead id="specimens" number="02" title="Specimens">
          The core, separated into the systems it is made of. Each specimen grows from its repository’s real directory tree: folders branch, files end in points. Its outline comes from what its README says
          the system does.
        </FigHead>
        <nav className="index" aria-label="Specimen index">
          <ol>
            {list.map((sp) => (
              <li key={sp.id}>
                <a
                  className="index__item"
                  href={`#specimen-${sp.id}`}
                  aria-current={selected === sp.id ? 'true' : undefined}
                  onClick={(event) => choose(event, sp.id)}
                  onPointerEnter={() => hover(sp)}
                  onPointerLeave={() => hover(null)}
                  onFocus={() => hover(sp)}
                  onBlur={() => hover(null)}
                >
                  <span className="index__plate">{sp.plate}</span>
                  <span className="index__name">{sp.name}</span>
                  <span className="index__meta">{sp.sealed ? 'sealed' : formatInt(sp.repo.morphology.files)}</span>
                </a>
              </li>
            ))}
          </ol>
          <p className="hint when-3d">Select a specimen, or use ← → to move between them. Esc returns to the constellation.</p>
        </nav>
        <div className="plates" data-open={selected ? 'true' : 'false'}>
          {list.map((sp) => (
            <SpecimenArticle key={sp.id} specimen={sp} open={selected === sp.id} />
          ))}
        </div>
      </div>
    </section>
  );
}
