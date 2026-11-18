import { snakeClock } from '../lib/actions.js';
import { attributionFor, calendarCells, describeAttribution } from '../lib/data.js';
import { formatDate, formatInt, plural } from '../lib/format.js';
import { useSnapshot, useStore, useStoreApi } from '../lib/store.js';
import { FigHead, Readout } from './bits.jsx';

const PHASES = [
  ['helix', 'Helix'],
  ['terrain', 'Terrain'],
  ['flow', 'Flow'],
];

function Phases() {
  const phase = useStore((s) => (s.snake === 'playing' || s.snake === 'paused' ? 'terrain' : s.genomePhase));
  return (
    <ol className="phases when-3d" aria-label="Projection">
      {PHASES.map(([id, name]) => (
        <li key={id} aria-current={phase === id ? 'step' : undefined}>
          {name}
        </li>
      ))}
    </ol>
  );
}

function SnakePanel() {
  const snapshot = useSnapshot();
  const { actions } = useStoreApi();
  const state = useStore((s) => s.snake);
  const step = useStore((s) => s.snakeStep);
  const total = snapshot.calendar.days.filter((d) => d[2] > 0).length;
  const eaten = state === 'idle' || !snakeClock.eats ? 0 : snakeClock.eats.filter((e) => e.step <= step).length;
  const steps = snakeClock.path ? snakeClock.path.length - 1 : null;
  const label = state === 'playing' ? 'Pause' : state === 'paused' ? 'Resume' : state === 'done' ? 'Run again' : 'Run the snake';
  return (
    <section className="snake" aria-labelledby="snake-title">
      <p className="label" id="snake-title">
        <span className="label__accent">Snake protocol</span>
      </p>
      <p className="snake__text">An original solver eats every lit day of the real calendar by breadth-first search: lightest first unless a darker day walls the way, and never across its own body.</p>
      <div className="snake__controls">
        <button type="button" className="button" onClick={() => actions.snakeToggle()} aria-pressed={state === 'playing'}>
          {label}
        </button>
        {state !== 'idle' ? (
          <button type="button" className="button button--quiet" onClick={() => actions.snakeReset()}>
            Reset
          </button>
        ) : null}
        <p className="snake__status">
          {state === 'idle' ? `${total} lit days to eat` : `${eaten} of ${total} eaten · step ${step}${steps ? ` of ${steps}` : ''}`}
        </p>
      </div>
      <p className="sr-only" role="status">
        {state === 'done' ? `The snake ate all ${total} lit days in ${steps} steps.` : state === 'playing' ? `Snake running: ${eaten} of ${total} eaten.` : ''}
      </p>
    </section>
  );
}

function DaysTable() {
  const snapshot = useSnapshot();
  const { actions } = useStoreApi();
  const focus = useStore((s) => s.dayFocus);
  const { attribution, restricted } = snapshot.calendar;
  return (
    <aside className="days" aria-labelledby="days-title">
      <p className="label" id="days-title">
        <span className="label__accent">{attribution.length}</span> active days
      </p>
      <table className="days__table">
        <thead className="sr-only">
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Contributions</th>
            <th scope="col">Where they went</th>
          </tr>
        </thead>
        <tbody>
          {[...attribution].reverse().map((day) => (
            <tr key={day.date} className={focus === day.date ? 'is-focus' : undefined} onPointerEnter={() => actions.focusDay(day.date)} onPointerLeave={() => actions.focusDay(null)}>
              <th scope="row">
                <time dateTime={day.date}>{formatDate(day.date, { year: false })}</time>
              </th>
              <td className="days__n">{day.count}</td>
              <td>{describeAttribution(snapshot, day).join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {restricted ? <p className="caption">{plural(restricted, 'contribution')} went to private repositories; GitHub shows them only as counts, and so does this page.</p> : null}
    </aside>
  );
}

// The calendar as a flat grid: the still plate without WebGL, and where the snake runs then.
function GenomeGrid() {
  const snapshot = useSnapshot();
  const flat = useStore((s) => !s.prefs.three || s.webgl === 'unavailable' || s.webgl === 'lost');
  const state = useStore((s) => s.snake);
  const step = useStore((s) => s.snakeStep);
  const focus = useStore((s) => s.dayFocus);
  const cells = calendarCells(snapshot);
  const pitch = 15;
  const size = 12;
  const weeks = snapshot.calendar.weeks;
  const running = flat && state !== 'idle' && snakeClock.path;
  const eaten = new Set(running ? snakeClock.eats.filter((e) => e.step <= step).map((e) => `${e.x},${e.y}`) : []);
  const body = running ? snakeClock.path.slice(Math.max(0, step - 3), step + 1) : [];
  const { stats } = snapshot.calendar;
  return (
    <figure className="plate plate--genome">
      <svg viewBox={`${-pitch} ${-pitch} ${(weeks + 2) * pitch} ${9 * pitch}`} role="img" aria-label={`Contribution calendar: ${stats.total} contributions on ${stats.activeDays} days. Days before ${formatDate(stats.genesis)}, when the account began, are drawn as outlines.`}>
        {cells.map((c) => (
          <rect
            key={c.date}
            x={c.x * pitch}
            y={c.y * pitch}
            width={size}
            height={size}
            rx="1.5"
            className={`day ${c.beforeGenesis ? 'day--void' : `day--${eaten.has(`${c.x},${c.y}`) ? 0 : c.level}`}${focus === c.date ? ' is-focus' : ''}`}
          >
            <title>{`${formatDate(c.date)}: ${c.beforeGenesis ? 'before the account existed' : plural(c.count, 'contribution')}`}</title>
          </rect>
        ))}
        {body.map(([x, y], i) => (
          <rect key={i} x={x * pitch - 1} y={y * pitch - 1} width={size + 2} height={size + 2} rx="3" className={`snake-seg${i === body.length - 1 ? ' snake-seg--head' : ''}`} />
        ))}
      </svg>
    </figure>
  );
}

export function GenomeFigure() {
  const snapshot = useSnapshot();
  const { stats } = snapshot.calendar;
  return (
    <section id="genome" className="fig fig--genome" aria-labelledby="genome-title">
      <div className="fig__stage">
        <FigHead id="genome" number="03" title="Contribution genome">
          The real calendar from GitHub: wound into a helix, laid flat as terrain, then released as each contribution travels to the repository it went to. The account began on{' '}
          {formatDate(stats.genesis)}; the days before are drawn empty, not invented.
        </FigHead>
        <Readout
          className="readout--genome"
          items={[
            ['contributions', formatInt(stats.total)],
            ['active days', formatInt(stats.activeDays)],
            ['busiest day', stats.busiest ? `${formatDate(stats.busiest.date, { year: false })} · ${stats.busiest.count}` : '—'],
            ['longest streak', plural(stats.longestStreak.length, 'day')],
            ['days since genesis', formatInt(snapshot.totals.ageDays)],
          ]}
        />
        <Phases />
        <SnakePanel />
        <DaysTable />
        <GenomeGrid />
      </div>
    </section>
  );
}
