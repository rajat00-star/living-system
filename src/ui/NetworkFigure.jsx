import { fileUrl, repoByName, techById } from '../lib/data.js';
import { formatInt, plural } from '../lib/format.js';
import { useSnapshot, useStore, useStoreApi } from '../lib/store.js';
import { Ext, FigHead } from './bits.jsx';

// The four classes differ by shape first, so they never depend on colour alone.
export function Glyph({ cls }) {
  return (
    <svg className={`glyph glyph--${cls}`} viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      {cls === 'language' ? <circle cx="5" cy="5" r="3.6" /> : null}
      {cls === 'framework' ? <rect x="1.6" y="1.6" width="6.8" height="6.8" /> : null}
      {cls === 'infrastructure' ? <circle cx="5" cy="5" r="3.2" fill="none" strokeWidth="1.4" /> : null}
      {cls === 'ai' ? <polygon points="5,1.2 9,8.6 1,8.6" /> : null}
    </svg>
  );
}

function TechDetail() {
  const snapshot = useSnapshot();
  const { actions } = useStoreApi();
  const focus = useStore((s) => s.techFocus);
  const node = focus ? techById(snapshot, focus) : null;
  if (!node) {
    return (
      <aside className="tech-detail" aria-live="polite">
        <p className="tech-detail__empty">Select a technology to see which repositories use it, and the file that shows it.</p>
      </aside>
    );
  }
  return (
    <aside className="tech-detail" aria-live="polite" aria-labelledby="tech-detail-name">
      <p className="label">
        <Glyph cls={node.class} /> {snapshot.tech.classes[node.class]}
      </p>
      <h3 id="tech-detail-name" className="tech-detail__name">
        {node.label}
      </h3>
      <p className="tech-detail__text">
        Used by {plural(node.repos.length, 'public repository', 'public repositories')}
        {node.class === 'language' ? `, ${formatInt(node.bytes)} bytes in all` : ''}.
      </p>
      <ul className="evidence">
        {node.evidence.map((ev) => {
          const repo = repoByName(snapshot, ev.repo);
          const url = fileUrl(snapshot, ev.repo, ev.path);
          return (
            <li key={`${ev.repo}:${ev.path}`}>
              <button type="button" className="evidence__repo" onClick={(event) => actions.select(repo.id, { from: event.currentTarget })}>
                {repo?.displayName ?? ev.repo}
              </button>
              {url ? (
                <Ext href={url} className="evidence__path">
                  {ev.path}
                </Ext>
              ) : (
                <span className="evidence__path">{ev.path}</span>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" className="button button--quiet" onClick={() => actions.focusTech(null)}>
        Clear
      </button>
    </aside>
  );
}

export function NetworkFigure() {
  const snapshot = useSnapshot();
  const { actions } = useStoreApi();
  const techClass = useStore((s) => s.techClass);
  const focus = useStore((s) => s.techFocus);
  const { nodes, classes } = snapshot.tech;
  const groups = Object.entries(classes).map(([cls, name]) => ({ cls, name, nodes: nodes.filter((n) => n.class === cls) }));
  const hover = (node) => actions.hover(node ? { kind: 'tech', id: node.id, source: 'list' } : null);

  return (
    <section id="network" className="fig fig--network" aria-labelledby="network-title">
      <div className="fig__stage">
        <FigHead id="network" number="04" title="Nervous system">
          {nodes.length} technologies wired to the repositories that use them. Every link is read from a file: a manifest, a Dockerfile, a workflow, an extension manifest, or GitHub’s own language
          statistics.
        </FigHead>
        <div className="filters" role="group" aria-label="Show one class of technology">
          <button type="button" className="filter" aria-pressed={!techClass} onClick={() => actions.setTechClass(null)}>
            All <span className="filter__n">{nodes.length}</span>
          </button>
          {groups.map((g) => (
            <button key={g.cls} type="button" className="filter" aria-pressed={techClass === g.cls} onClick={() => actions.setTechClass(techClass === g.cls ? null : g.cls)}>
              <Glyph cls={g.cls} />
              {g.name} <span className="filter__n">{g.nodes.length}</span>
            </button>
          ))}
        </div>
        <div className="techlist">
          {groups.map((g) => (
            <section key={g.cls} className="techlist__group" data-dim={techClass && techClass !== g.cls ? 'true' : undefined} aria-label={g.name}>
              <h3 className="label">{g.name}</h3>
              <ul>
                {g.nodes.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      className="tech"
                      aria-pressed={focus === node.id}
                      onClick={() => actions.focusTech(focus === node.id ? null : node.id)}
                      onPointerEnter={() => hover(node)}
                      onPointerLeave={() => hover(null)}
                      onFocus={() => hover(node)}
                      onBlur={() => hover(null)}
                    >
                      <Glyph cls={node.class} />
                      <span className="tech__name">{node.label}</span>
                      <span className="tech__n" aria-label={plural(node.repos.length, 'repository', 'repositories')}>
                        {node.repos.length}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <TechDetail />
      </div>
    </section>
  );
}
