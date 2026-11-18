// Views over the snapshot that several parts of the page need.
import { plateNumber } from './format.js';

export const FIGURES = [
  { id: 'core', number: '01', name: 'The Core' },
  { id: 'specimens', number: '02', name: 'Specimens' },
  { id: 'genome', number: '03', name: 'Genome' },
  { id: 'network', number: '04', name: 'Nervous system' },
  { id: 'vitals', number: '05', name: 'Vital signs' },
];

const cache = new WeakMap();
function memo(snapshot, key, build) {
  if (!cache.has(snapshot)) cache.set(snapshot, {});
  const entry = cache.get(snapshot);
  if (!(key in entry)) entry[key] = build();
  return entry[key];
}

// Every specimen in plate order: public repositories and sealed private ones.
export const specimens = (snapshot) =>
  memo(snapshot, 'specimens', () =>
    snapshot.order.map((id, index) => {
      const repo = snapshot.repos.find((r) => r.id === id) ?? null;
      const sealed = snapshot.sealed.find((s) => s.id === id) ?? null;
      return { id, index, plate: plateNumber(index), name: repo ? repo.displayName : sealed.name, repo, sealed, featured: repo ? repo.featured : true };
    }),
  );

// The tori in the order the Core nests them: the largest repository outermost.
export const toriOrder = (snapshot) => [...snapshot.repos].sort((a, b) => b.morphology.files - a.morphology.files || a.name.localeCompare(b.name));

export const specimenById = (snapshot, id) => specimens(snapshot).find((s) => s.id === id) ?? null;
export const repoByName = (snapshot, name) => snapshot.repos.find((r) => r.name === name) ?? null;
export const techById = (snapshot, id) => snapshot.tech.nodes.find((n) => n.id === id) ?? null;

// A link to a file at the exact commit the snapshot read, so the evidence never drifts.
export function fileUrl(snapshot, repoName, path) {
  const repo = repoByName(snapshot, repoName);
  if (!repo || !path || path === 'GitHub language statistics') return null;
  const ref = repo.commits.head?.sha ?? repo.defaultBranch;
  return `${repo.url}/blob/${ref}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

// The calendar laid out on GitHub's grid: week columns, Sunday-first rows.
export const calendarCells = (snapshot) =>
  memo(snapshot, 'cells', () => {
    const offset = new Date(`${snapshot.calendar.from}T00:00:00Z`).getUTCDay();
    return snapshot.calendar.days.map(([date, count, level], i) => ({ date, count, level, x: Math.floor((i + offset) / 7), y: (i + offset) % 7, beforeGenesis: date < snapshot.calendar.stats.genesis }));
  });

export const attributionFor = (snapshot, date) => snapshot.calendar.attribution.find((day) => day.date === date) ?? null;

export function describeAttribution(snapshot, day) {
  if (!day) return [];
  const parts = day.parts.map((part) => {
    const repo = repoByName(snapshot, part.repo);
    const name = repo?.displayName ?? part.repo;
    if (part.kind === 'commit') return `${part.count} commit${part.count === 1 ? '' : 's'} to ${name}`;
    if (part.kind === 'repository') return `created ${name}`;
    return `${part.count} ${part.kind}${part.count === 1 ? '' : 's'} in ${name}`;
  });
  if (day.unattributed) parts.push(`${day.unattributed} private or not attributable`);
  return parts;
}

export const reposForTech = (snapshot, techId) => snapshot.tech.edges.filter((e) => e.tech === techId).map((e) => e.repo);
export const techForRepo = (snapshot, repoName) => snapshot.tech.edges.filter((e) => e.repo === repoName).map((e) => e.tech);

// Repositories that share technologies: the filaments between specimens.
export const filaments = (snapshot) =>
  memo(snapshot, 'filaments', () => {
    const out = [];
    const names = snapshot.repos.map((r) => r.name);
    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        const a = new Set(techForRepo(snapshot, names[i]));
        const shared = techForRepo(snapshot, names[j]).filter((t) => a.has(t));
        if (shared.length) out.push({ a: names[i], b: names[j], shared });
      }
    }
    return out;
  });
