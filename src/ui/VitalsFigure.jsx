import { useEffect, useState } from 'react';
import { repoByName } from '../lib/data.js';
import { formatBytes, formatDate, formatDateTime, formatInt, relativeTime } from '../lib/format.js';
import { useSnapshot, useStore } from '../lib/store.js';
import { FigHead } from './bits.jsx';
import { LanguageBar } from './SpecimensFigure.jsx';

function useNow(interval = 30_000) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

function LiveStatus() {
  const snapshot = useSnapshot();
  const live = useStore((s) => s.live);
  const now = useNow();
  let text = 'Live check waiting';
  if (live.status === 'loading') text = 'Checking GitHub…';
  if (live.status === 'ok' && now) text = `Live: checked ${relativeTime(live.checkedAt, now)}${live.cached ? ' (kept in this browser)' : ''}${live.remaining != null ? ` · ${live.remaining} of this visitor’s hourly requests left` : ''}`;
  if (live.status === 'limited') text = `Live check paused: GitHub’s hourly limit for this visitor is spent${live.resetAt ? ` until ${new Date(live.resetAt).toISOString().slice(11, 16)} UTC` : ''}. Showing the snapshot.`;
  if (live.status === 'error') text = 'Live check failed. Showing the snapshot.';
  return (
    <div className="live" data-status={live.status}>
      <p className="live__line">
        <span className="live__dot" aria-hidden="true" />
        {text}
      </p>
      <p className="live__line live__line--muted">Snapshot built {formatDateTime(snapshot.generatedAt)}</p>
    </div>
  );
}

function Sparkline() {
  const snapshot = useSnapshot();
  const { days, stats } = snapshot.calendar;
  const since = days.filter(([date]) => date >= stats.genesis);
  const max = Math.max(1, ...since.map((d) => d[1]));
  const w = 4;
  const H = 64;
  return (
    <figure className="spark">
      <svg viewBox={`0 0 ${since.length * w} ${H + 1}`} preserveAspectRatio="none" role="img" aria-label={`Contributions per day since ${formatDate(stats.genesis)}: ${stats.total} in all, at most ${max} in a day.`}>
        <line x1="0" y1={H + 0.5} x2={since.length * w} y2={H + 0.5} className="spark__base" />
        {since.map(([date, count], i) => (count ? <rect key={date} x={i * w + 0.6} y={H - (count / max) * H} width={w - 1.2} height={(count / max) * H} className="spark__bar" /> : null))}
      </svg>
      <figcaption className="spark__axis">
        <span>{formatDate(stats.genesis, { year: false })}</span>
        <span>max {max}</span>
        <span>{formatDate(snapshot.calendar.to, { year: false })}</span>
      </figcaption>
    </figure>
  );
}

function Activity() {
  const snapshot = useSnapshot();
  const live = useStore((s) => s.live);
  const events = live.status === 'ok' ? live.events : [];
  const items = [...events, ...snapshot.activity]
    .filter((item, i, all) => all.findIndex((o) => o.repo === item.repo && Math.abs(Date.parse(o.at) - Date.parse(item.at)) < 120_000) === i)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 9);
  return (
    <ol className="activity">
      {items.map((item) => (
        <li key={`${item.repo}-${item.at}-${item.kind}`}>
          <time dateTime={item.at}>{formatDate(item.at, { year: false })}</time>
          <span className="activity__repo">{repoByName(snapshot, item.repo)?.displayName ?? item.repo}</span>
          <span className="activity__text">{item.text}</span>
        </li>
      ))}
    </ol>
  );
}

export function VitalsFigure() {
  const snapshot = useSnapshot();
  const live = useStore((s) => s.live);
  const { totals } = snapshot;
  const L = live.status === 'ok' ? live : null;
  const cells = [
    ['public repositories', formatInt(L?.profile.publicRepos ?? totals.repos), Boolean(L)],
    ['files', formatInt(totals.files)],
    ['of source', formatBytes(totals.bytes)],
    ['languages', formatInt(totals.languages)],
    ['technologies', formatInt(totals.technologies)],
    ['commits, default branches', formatInt(totals.commits)],
    ['contributions, last year', formatInt(totals.contributions)],
    ['active days', formatInt(totals.activeDays)],
    ['stars', formatInt(L?.totals.stars ?? totals.stars), Boolean(L)],
    ['forks', formatInt(L?.totals.forks ?? totals.forks), Boolean(L)],
    ['followers', formatInt(L?.profile.followers ?? totals.followers), Boolean(L)],
    ['days since genesis', formatInt(totals.ageDays)],
  ];
  const cited = snapshot.repos.reduce((sum, r) => sum + r.notes.length + r.layers.length + (r.stages ? 1 : 0), 0);

  return (
    <section id="vitals" className="fig fig--vitals" aria-labelledby="vitals-title">
      <div className="fig__stage">
        <FigHead id="vitals" number="05" title="Vital signs" />
        <LiveStatus />
        <dl className="vitals">
          {cells.map(([term, value, isLive]) => (
            <div key={term} className="vital">
              <dt>{term}</dt>
              <dd>
                {value}
                {isLive ? <span className="vital__live">live</span> : null}
              </dd>
            </div>
          ))}
        </dl>
        <div className="vitals__lower">
          <section className="vitals__block" aria-labelledby="langs-title">
            <h3 className="label" id="langs-title">
              Languages across every public repository
            </h3>
            <LanguageBar languages={snapshot.languages} />
          </section>
          <section className="vitals__block" aria-labelledby="pulse-title">
            <h3 className="label" id="pulse-title">
              Contributions since genesis
            </h3>
            <Sparkline />
          </section>
          <section className="vitals__block" aria-labelledby="activity-title">
            <h3 className="label" id="activity-title">
              Repository activity
            </h3>
            <Activity />
          </section>
        </div>
        <section className="provenance" aria-labelledby="provenance-title">
          <h3 className="label" id="provenance-title">
            How this page knows
          </h3>
          <p>
            Each build reads GitHub’s REST and GraphQL APIs with the short-lived token GitHub issues to that build alone, every six hours. It validates every field, refuses private repositories, and
            drops any field note whose quotation has left its repository: {cited} cited passages passed on the last build. Your browser then makes three unauthenticated reads to show what has changed since.
            No token exists anywhere in this page.
          </p>
        </section>
      </div>
    </section>
  );
}
