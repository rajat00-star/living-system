// Small pieces of the page's typography and linking.

export function Ext({ href, children, className = '', label }) {
  if (!href) return null;
  return (
    <a className={`ext ${className}`} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
      {children}
      <span className="ext__arrow" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}

// A citation: the repository file a sentence was quoted from, at the exact commit read.
export function Source({ repo, path, url }) {
  return (
    <a className="source" href={url} target="_blank" rel="noopener noreferrer">
      <span aria-hidden="true">— </span>
      {repo}/{path}
      <span className="sr-only"> (source, opens on GitHub)</span>
    </a>
  );
}

export function FigHead({ id, number, title, children }) {
  return (
    <header className="fig__head">
      <p className="label">
        <span className="label__accent">Fig. {number}</span>
      </p>
      <h2 id={`${id}-title`} className="fig__title" tabIndex={-1}>
        {title}
      </h2>
      {children ? <p className="fig__text">{children}</p> : null}
    </header>
  );
}

// Monospace data, set as a definition list so each value is announced with its name.
export function Readout({ items, className = '' }) {
  return (
    <dl className={`readout ${className}`}>
      {items.map(([term, value]) => (
        <div key={term} className="readout__item">
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Drops the folder name that opens a repository-layout line ("server/ Express …").
export const stripLead = (quote) => quote.replace(/^\S+\/\s+/, '');
