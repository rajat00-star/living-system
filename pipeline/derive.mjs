// Pure functions that turn raw GitHub responses into the facts the site shows.
// Nothing here touches the network, so all of it is covered by unit tests.
import { catalog, languageToTech, techClasses } from './tech-catalog.mjs';

// ---------------------------------------------------------------------------
// Manifests

const normalisePip = (name) => name.toLowerCase().replace(/_/g, '-');

export function parseRequirements(text) {
  return [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.replace(/#.*/, '').trim())
        .filter((line) => line && !line.startsWith('-') && !/^(git\+|https?:)/.test(line))
        .map((line) => normalisePip(line.split(/[\s;<>=!~[(@]/)[0]))
        .filter((name) => /^[a-z0-9][a-z0-9.-]*$/.test(name)),
    ),
  ];
}

// PEP 621 `dependencies = [...]`, optional dependency groups, and Poetry's table form.
export function parsePyproject(text) {
  const names = new Set();
  let section = '';
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/#.*/, '').trim();
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      section = header[1].trim();
      continue;
    }
    const inProject = section === 'project' || section === 'project.optional-dependencies';
    const arrayStart = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*\[(.*)$/);
    if (inProject && arrayStart && (section !== 'project' || arrayStart[1] === 'dependencies')) {
      let body = arrayStart[2];
      while (!body.includes(']') && i + 1 < lines.length) body += ` ${lines[++i].replace(/#.*/, '')}`;
      for (const match of body.matchAll(/["']([^"']+)["']/g)) names.add(normalisePip(match[1].split(/[\s;<>=!~[(@]/)[0]));
      continue;
    }
    if (/^tool\.poetry\.(dev-)?dependencies$|^tool\.poetry\.group\.[^.]+\.dependencies$/.test(section)) {
      const key = line.match(/^([A-Za-z0-9_.-]+)\s*=/);
      if (key && key[1].toLowerCase() !== 'python') names.add(normalisePip(key[1]));
    }
  }
  return [...names].filter((name) => /^[a-z0-9][a-z0-9.-]*$/.test(name));
}

export function parseManifest(file, text) {
  const base = file.split('/').pop();
  try {
    if (base === 'package.json') {
      const json = JSON.parse(text);
      return {
        path: file,
        kind: 'npm',
        dependencies: Object.keys(json.dependencies ?? {}).sort(),
        devDependencies: Object.keys(json.devDependencies ?? {}).sort(),
      };
    }
    if (base === 'manifest.json') {
      const json = JSON.parse(text);
      if (!json.manifest_version) return null;
      return { path: file, kind: 'extension', manifestVersion: json.manifest_version, dependencies: [], devDependencies: [] };
    }
    if (/^requirements.*\.txt$/.test(base)) {
      const deps = parseRequirements(text);
      const dev = /dev|test/i.test(base);
      return { path: file, kind: 'pip', dependencies: dev ? [] : deps, devDependencies: dev ? deps : [] };
    }
    if (base === 'pyproject.toml') return { path: file, kind: 'pip', dependencies: parsePyproject(text), devDependencies: [] };
  } catch {
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Technologies

// Which catalogued technologies a repository uses, each with the file that proves it.
export function detectTech({ paths, manifests, languages }) {
  const found = new Map();
  const add = (id, evidence) => {
    if (!found.has(id)) found.set(id, new Set());
    found.get(id).add(evidence);
  };
  for (const tech of catalog) {
    for (const manifest of manifests) {
      const all = [...manifest.dependencies, ...manifest.devDependencies];
      if (manifest.kind === 'npm' && tech.npm?.some((name) => all.includes(name))) add(tech.id, manifest.path);
      if (manifest.kind === 'pip' && tech.pip?.some((name) => all.includes(name))) add(tech.id, manifest.path);
      if (manifest.kind === 'extension' && tech.manifestV3 && manifest.manifestVersion === 3) add(tech.id, manifest.path);
    }
    for (const pattern of tech.files ?? []) {
      const hit = paths.find((p) => pattern.test(p));
      if (hit) add(tech.id, hit);
    }
  }
  for (const language of Object.keys(languages)) {
    if (languageToTech[language]) add(languageToTech[language], 'GitHub language statistics');
  }
  return [...found].map(([id, evidence]) => ({ id, evidence: [...evidence].sort() })).sort((a, b) => a.id.localeCompare(b.id));
}

const languageId = (name) => `lang-${name.toLowerCase().replace(/\+/g, 'p').replace(/[^a-z0-9]+/g, '-')}`;

// The network: repositories and technologies, joined where a repository uses one.
export function buildTechGraph(repos) {
  const nodes = new Map();
  const edges = [];
  for (const repo of repos) {
    const total = Object.values(repo.languagesRaw).reduce((sum, bytes) => sum + bytes, 0) || 1;
    for (const [name, bytes] of Object.entries(repo.languagesRaw)) {
      if (languageToTech[name]) continue;
      const id = languageId(name);
      if (!nodes.has(id)) nodes.set(id, { id, label: name, class: 'language', bytes: 0, repos: [], evidence: [] });
      const node = nodes.get(id);
      node.bytes += bytes;
      node.repos.push(repo.name);
      node.evidence.push({ repo: repo.name, path: 'GitHub language statistics' });
      edges.push({ repo: repo.name, tech: id, weight: round(bytes / total, 4) });
    }
    for (const { id, evidence } of repo.tech) {
      const entry = catalog.find((tech) => tech.id === id);
      if (!nodes.has(id)) nodes.set(id, { id, label: entry.label, class: entry.class, bytes: 0, repos: [], evidence: [] });
      const node = nodes.get(id);
      node.repos.push(repo.name);
      for (const path of evidence) node.evidence.push({ repo: repo.name, path });
      edges.push({ repo: repo.name, tech: id, weight: 1 });
    }
  }
  const order = Object.keys(techClasses);
  const list = [...nodes.values()].sort((a, b) => order.indexOf(a.class) - order.indexOf(b.class) || b.repos.length - a.repos.length || b.bytes - a.bytes || a.label.localeCompare(b.label));
  return { nodes: list, edges };
}

// ---------------------------------------------------------------------------
// Files

const SOURCE = /\.(py|pyi|ts|tsx|js|jsx|mjs|cjs|css|scss|html|cpp|cc|c|h|hpp|sh|bash|go|rs|java|kt|swift|rb|php|sql|mako|vue|svelte|glsl|wgsl)$|(^|\/)(Dockerfile[^/]*|Makefile)$/i;
const DOCS = /\.(md|mdx|txt|rst|pdf|docx?|pptx?|tex|ipynb)$|(^|\/)(LICEN[CS]E[^/]*|NOTICE|AUTHORS|CHANGELOG)$/i;
const CONFIG = /\.(json|ya?ml|toml|ini|cfg|conf|lock|env[^/]*|xml|csv|tsv|example|gitignore|dockerignore|editorconfig|prettierrc|eslintrc)$|(^|\/)\.[^/]+$/i;

// 0 source, 1 documentation, 2 configuration and data, 3 media and everything else.
export function fileClass(file) {
  if (SOURCE.test(file)) return 0;
  if (DOCS.test(file)) return 1;
  if (CONFIG.test(file)) return 2;
  return 3;
}

export function morphology(paths) {
  const dirs = new Set();
  let maxDepth = 0;
  const top = new Map();
  for (const file of paths) {
    const parts = file.split('/');
    maxDepth = Math.max(maxDepth, parts.length - 1);
    for (let i = 1; i < parts.length; i += 1) dirs.add(parts.slice(0, i).join('/'));
    const head = parts[0];
    if (!top.has(head)) top.set(head, { name: head, type: parts.length > 1 ? 'dir' : 'file', files: 0 });
    top.get(head).files += 1;
  }
  const classes = [0, 0, 0, 0];
  for (const file of paths) classes[fileClass(file)] += 1;
  return {
    files: paths.length,
    directories: dirs.size,
    maxDepth,
    classes: { source: classes[0], docs: classes[1], config: classes[2], other: classes[3] },
    topLevel: [...top.values()].sort((a, b) => (a.type === b.type ? b.files - a.files || a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1)),
  };
}

// ---------------------------------------------------------------------------
// Calendar

const DAY = 86_400_000;
const toDay = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

export function calendarStats(days, { createdAt, generatedAt }) {
  const active = days.filter((day) => day.count > 0);
  const total = days.reduce((sum, day) => sum + day.count, 0);
  let busiest = null;
  for (const day of active) if (!busiest || day.count > busiest.count) busiest = { date: day.date, count: day.count };

  let longest = { length: 0, from: null, to: null };
  let run = { length: 0, from: null };
  let previous = null;
  for (const day of days) {
    if (day.count > 0) {
      run = previous !== null && toDay(day.date) - previous === DAY && run.length > 0 ? { length: run.length + 1, from: run.from } : { length: 1, from: day.date };
      if (run.length > longest.length) longest = { length: run.length, from: run.from, to: day.date };
    } else {
      run = { length: 0, from: null };
    }
    previous = toDay(day.date);
  }

  const genesis = createdAt.slice(0, 10);
  return {
    total,
    activeDays: active.length,
    busiest,
    longestStreak: longest,
    firstActive: active[0]?.date ?? null,
    lastActive: active.at(-1)?.date ?? null,
    genesis,
    ageDays: Math.floor((Date.parse(generatedAt) - Date.parse(createdAt)) / DAY),
    daysSinceGenesis: days.filter((day) => day.date >= genesis).length,
  };
}

// Splits each day's count into what public data can attribute to a repository and the
// remainder (private work shown as an anonymous count, or anything GitHub does not attribute).
export function attributeDays(days, attributions) {
  const byDate = new Map(days.map((day) => [day.date, { date: day.date, count: day.count, left: day.count, parts: [] }]));
  const sorted = [...attributions].sort((a, b) => a.date.localeCompare(b.date));
  for (const item of sorted) {
    // occurredAt is UTC; the calendar may sit a day either side, so the nearest day with
    // room is used, and an attribution that fits nowhere is dropped rather than invented.
    const candidates = [0, -1, 1].map((offset) => new Date(toDay(item.date) + offset * DAY).toISOString().slice(0, 10));
    const target = candidates.map((date) => byDate.get(date)).find((day) => day && day.left >= item.count);
    if (!target) continue;
    target.left -= item.count;
    const existing = target.parts.find((part) => part.repo === item.repo && part.kind === item.kind);
    if (existing) existing.count += item.count;
    else target.parts.push({ repo: item.repo, kind: item.kind, count: item.count });
  }
  return [...byDate.values()]
    .filter((day) => day.count > 0)
    .map((day) => ({ date: day.date, count: day.count, parts: day.parts, unattributed: day.left }));
}

// The calendar exactly as a signed-out visitor sees it, parsed from GitHub's public
// contributions page. Each day cell carries its date and level; its tooltip carries the count.
// The parse is accepted only if the days add up to the total the page itself states.
export function parseCalendarHtml(html) {
  const cells = [];
  for (const match of html.matchAll(/<td\b[^>]*\bContributionCalendar-day\b[^>]*>/g)) {
    const tag = match[0];
    const date = tag.match(/\bdata-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const level = Number(tag.match(/\bdata-level="(\d)"/)?.[1]);
    if (date && id && Number.isInteger(level)) cells.push({ date, id, level });
  }
  const tips = new Map();
  for (const match of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) tips.set(match[1], match[2].trim());
  const days = cells
    .map(({ date, id, level }) => {
      const tip = tips.get(id) ?? '';
      const n = tip.match(/^([\d,]+) contributions?\b/);
      if (!n && !/^No contributions\b/.test(tip)) throw new Error(`calendar: unreadable tooltip for ${date}`);
      return { date, count: n ? Number(n[1].replace(/,/g, '')) : 0, level };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const stated = html.match(/([\d,]+)\s+contributions?\s+in the last year/);
  const total = days.reduce((sum, day) => sum + day.count, 0);
  if (!days.length) throw new Error('calendar: no days found');
  if (stated && Number(stated[1].replace(/,/g, '')) !== total) throw new Error(`calendar: days sum to ${total}, page states ${stated[1]}`);
  for (let i = 1; i < days.length; i += 1) {
    if (Date.parse(days[i].date) - Date.parse(days[i - 1].date) !== 86_400_000) throw new Error(`calendar: gap before ${days[i].date}`);
  }
  return days;
}

export function round(value, digits = 2) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
