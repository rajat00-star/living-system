// Reads Rajat's public GitHub and writes everything the site and the README show:
//   data/snapshot.json   facts, statistics and cited notes (inlined into the page)
//   data/geometry.json   shapes computed from those facts (loaded with the 3D scene)
//   public/readme/*.svg  the README plates, drawn by the same code
//
//   node pipeline/run.mjs [--strict] [--no-svg]
//     --strict  fail when GitHub cannot be read or a field note's quote has gone,
//               instead of keeping the last good snapshot
//
// Token: GITHUB_TOKEN (GitHub Actions), GH_TOKEN, or `gh auth token` for local runs. It is
// held in memory only. Without one the run is unauthenticated and skips attribution.
// Only public repositories are ever read; private ones are rejected before anything else.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../content/config.mjs';
import { fieldNotes } from '../content/field-notes.mjs';
import { attributeDays, buildTechGraph, calendarStats, detectTech, morphology, parseCalendarHtml, parseManifest, round } from './derive.mjs';
import { verifyEntries } from './evidence.mjs';
import { coreLayout, dendrite, networkLayout, solveSnake } from './geometry.mjs';
import { createClient } from './github.mjs';
import { ownEvents } from '../src/lib/events.js';
import { geometrySchema, snapshotSchema } from './schema.mjs';
import { manifestPattern, techClasses } from './tech-catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const log = (...parts) => console.log('  ', ...parts);
const warn = (...parts) => console.warn('  !', ...parts);

function resolveToken() {
  if (process.env.GITHUB_TOKEN) return { token: process.env.GITHUB_TOKEN, source: 'GITHUB_TOKEN' };
  if (process.env.GH_TOKEN) return { token: process.env.GH_TOKEN, source: 'GH_TOKEN' };
  try {
    const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (token) return { token, source: 'gh auth token' };
  } catch {
    // gh is optional
  }
  return { token: '', source: 'none' };
}

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
const REPO = 'repository { name isPrivate owner { login } }';
const CONTRIBUTIONS = `query($login: String!) { user(login: $login) { contributionsCollection {
  restrictedContributionsCount
  contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } }
  commitContributionsByRepository(maxRepositories: 100) { ${REPO} contributions(first: 100) { nodes { occurredAt commitCount } } }
  repositoryContributions(first: 100) { nodes { occurredAt ${REPO} } }
  issueContributions(first: 100) { nodes { occurredAt issue { ${REPO} } } }
  pullRequestContributions(first: 100) { nodes { occurredAt pullRequest { ${REPO} } } }
  pullRequestReviewContributions(first: 100) { nodes { occurredAt pullRequestReview { ${REPO} } } }
} } }`;

const firstLine = (text, max = 96) => {
  const line = String(text ?? '').split('\n')[0].trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

async function collect(client, authSource) {
  const login = config.login;
  const generatedAt = new Date().toISOString();
  const github = `https://github.com/${login}`;

  if (client.authenticated) {
    const core = await client.rateLimit();
    log(`quota: ${core?.remaining ?? '?'} requests left (token from ${authSource})`);
    if (core && core.remaining < 60) throw new Error(`only ${core.remaining} GitHub requests left this hour`);
  } else {
    warn('no token: unauthenticated (60 requests an hour) and no contribution attribution');
  }

  const profileRaw = await client.get(`/users/${login}`);
  // Public profile fields only, picked by name: nothing else from the response is kept.
  const profile = {
    login: profileRaw.login,
    name: profileRaw.name ?? null,
    bio: profileRaw.bio ?? null,
    location: profileRaw.location ?? null,
    url: github,
    createdAt: profileRaw.created_at,
    publicRepos: profileRaw.public_repos,
    followers: profileRaw.followers,
    following: profileRaw.following,
  };

  const listed = await client.get(`/users/${login}/repos?per_page=100&type=owner&sort=pushed`);
  const publicRepos = listed.filter((repo) => repo.private === false && repo.visibility === 'public' && !repo.fork && !repo.archived);
  if (publicRepos.length !== listed.filter((repo) => !repo.fork && !repo.archived).length) throw new Error('a non-public repository was listed; refusing to continue');
  const excluded = new Set(config.exclude.map((name) => name.toLowerCase()));
  const shown = publicRepos.filter((repo) => !excluded.has(repo.name.toLowerCase()));
  log(`${publicRepos.length} public repositories${shown.length < publicRepos.length ? `, ${publicRepos.length - shown.length} excluded in config` : ''}`);

  const repos = [];
  for (const raw of shown) {
    const base = `/repos/${login}/${raw.name}`;
    const { count: commitCount, first: head } = await client.count(`${base}/commits?sha=${encodeURIComponent(raw.default_branch)}`);
    const ref = head?.sha ?? raw.default_branch;
    const [languagesRaw, tree] = await Promise.all([client.get(`${base}/languages`), client.get(`${base}/git/trees/${ref}?recursive=1`)]);
    if (tree.truncated) warn(`${raw.name}: tree truncated by GitHub, counts are partial`);
    const paths = tree.tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path);
    const ownPaths = paths.filter((p) => !config.ignoreManifestPaths.test(p));
    const manifestPaths = ownPaths.filter((p) => manifestPattern.test(p)).slice(0, 24);
    const manifests = (
      await Promise.all(
        manifestPaths.map(async (file) => {
          const text = await client.raw(login, raw.name, ref, file);
          return text == null ? null : parseManifest(file, text);
        }),
      )
    ).filter(Boolean);
    const tech = detectTech({ paths: ownPaths, manifests, languages: languagesRaw });
    const blobUrl = (file) => `${github}/${raw.name}/blob/${ref}/${file.split('/').map(encodeURIComponent).join('/')}`;
    const verified = fieldNotes[raw.name]
      ? await verifyEntries(fieldNotes[raw.name], (file) => client.raw(login, raw.name, ref, file), { blobUrl })
      : { stages: null, layers: [], notes: [], dropped: [] };
    for (const item of verified.dropped) warn(`${raw.name}: dropped "${item.label}" (${item.path}: ${item.reason})`);

    const bytes = Object.values(languagesRaw).reduce((sum, n) => sum + n, 0);
    const featured = config.featured.find((f) => f.repo.toLowerCase() === raw.name.toLowerCase());
    repos.push({
      record: {
        id: featured?.id ?? raw.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: raw.name,
        displayName: featured?.name ?? config.names[raw.name] ?? raw.name,
        featured: Boolean(featured),
        visibility: 'public',
        url: `${github}/${raw.name}`,
        description: raw.description ?? null,
        homepage: raw.homepage || null,
        license: raw.license?.spdx_id ?? null,
        defaultBranch: raw.default_branch,
        createdAt: raw.created_at,
        pushedAt: raw.pushed_at,
        stars: raw.stargazers_count,
        forks: raw.forks_count,
        openIssues: raw.open_issues_count,
        sizeKb: raw.size,
        topics: raw.topics ?? [],
        primaryLanguage: raw.language ?? null,
        languages: Object.entries(languagesRaw)
          .sort((a, b) => b[1] - a[1])
          .map(([name, n]) => ({ name, bytes: n, share: round(n / (bytes || 1), 4) })),
        bytes,
        commits: {
          count: commitCount,
          head: head ? { sha: head.sha, message: firstLine(head.commit?.message), date: head.commit?.committer?.date ?? head.commit?.author?.date, url: `${github}/${raw.name}/commit/${head.sha}` } : null,
        },
        morphology: morphology(paths),
        manifests: manifests.map(({ path: file, kind, dependencies, devDependencies }) => ({ path: file, kind, dependencies, devDependencies })),
        tech,
        signature: config.signatures[raw.name] ?? null,
        stages: verified.stages,
        layers: verified.layers,
        notes: verified.notes,
        contributions: 0,
      },
      paths,
      languagesRaw,
      dropped: verified.dropped,
    });
  }

  // Featured systems: public ones are already in; private ones become sealed specimens
  // from config text only; anything else is reported and left out.
  const sealed = [];
  const missing = [];
  for (const entry of config.featured) {
    if (repos.some(({ record }) => record.name.toLowerCase() === entry.repo.toLowerCase())) continue;
    if (config.sealed[entry.id]) sealed.push({ id: entry.id, name: entry.name, ...config.sealed[entry.id] });
    else missing.push(entry.name);
  }
  if (missing.length) warn(`featured but not public, left out: ${missing.join(', ')}`);

  const featuredOrder = config.featured.map((f) => f.repo.toLowerCase());
  repos.sort((a, b) => {
    const ia = featuredOrder.indexOf(a.record.name.toLowerCase());
    const ib = featuredOrder.indexOf(b.record.name.toLowerCase());
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return b.paths.length - a.paths.length || a.record.name.localeCompare(b.record.name);
  });

  // The calendar as visitors see it. GraphQL adds which repository each contribution
  // went to, for public repositories only.
  let days;
  let calendarSource = 'public-page';
  let graph = null;
  if (client.authenticated) {
    try {
      graph = (await client.graphql(CONTRIBUTIONS, { login })).user.contributionsCollection;
    } catch (error) {
      warn(`contribution attribution unavailable: ${error.message}`);
    }
  }
  try {
    days = parseCalendarHtml(await client.publicCalendarHtml(login));
  } catch (error) {
    if (!graph) throw error;
    warn(`public calendar page unreadable (${error.message}); using GraphQL`);
    calendarSource = 'graphql';
    days = graph.contributionCalendar.weeks.flatMap((week) => week.contributionDays).map((d) => ({ date: d.date, count: d.contributionCount, level: LEVELS[d.contributionLevel] ?? 0 }));
  }
  if (graph && graph.contributionCalendar.totalContributions !== days.reduce((s, d) => s + d.count, 0)) {
    warn('GraphQL and the public page disagree on the total; the public page is used');
  }

  const attributions = [];
  if (graph) {
    const own = (repo) => repo && !repo.isPrivate;
    const name = (repo) => (repo.owner.login.toLowerCase() === login.toLowerCase() ? repo.name : `${repo.owner.login}/${repo.name}`);
    for (const group of graph.commitContributionsByRepository) {
      if (!own(group.repository)) continue;
      for (const node of group.contributions.nodes) attributions.push({ date: node.occurredAt.slice(0, 10), repo: name(group.repository), kind: 'commit', count: node.commitCount });
    }
    const singles = [
      ['repositoryContributions', (n) => n.repository, 'repository'],
      ['issueContributions', (n) => n.issue?.repository, 'issue'],
      ['pullRequestContributions', (n) => n.pullRequest?.repository, 'pull request'],
      ['pullRequestReviewContributions', (n) => n.pullRequestReview?.repository, 'review'],
    ];
    for (const [field, pick, kind] of singles) {
      for (const node of graph[field].nodes) {
        const repo = pick(node);
        if (own(repo)) attributions.push({ date: node.occurredAt.slice(0, 10), repo: name(repo), kind, count: 1 });
      }
    }
  }
  const attribution = attributeDays(days, attributions);
  for (const day of attribution) for (const part of day.parts) {
    const target = repos.find(({ record }) => record.name === part.repo);
    if (target) target.record.contributions += part.count;
  }

  const offset = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  const weeks = Math.ceil((days.length + offset) / 7);
  const stats = calendarStats(days, { createdAt: profile.createdAt, generatedAt });

  // Activity: public events on Rajat's own repositories, plus each repository's own
  // creation and latest push, which GitHub keeps longer than its 90-day event feed.
  const eventsRaw = await client.get(`/users/${login}/events/public?per_page=100`);
  const activity = [
    ...ownEvents(eventsRaw, login),
    ...repos.flatMap(({ record }) => [
      { at: record.createdAt, repo: record.name, kind: 'created', text: 'repository created', source: 'repository' },
      { at: record.pushedAt, repo: record.name, kind: 'pushed', text: `latest push to ${record.defaultBranch}`, source: 'repository' },
    ]),
  ]
    .filter((item, i, all) => all.findIndex((other) => other.repo === item.repo && Math.abs(Date.parse(other.at) - Date.parse(item.at)) < 120_000) === i)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 24);

  const techGraph = buildTechGraph(repos.map(({ record, languagesRaw }) => ({ name: record.name, languagesRaw, tech: record.tech })));
  const languages = Object.values(
    repos.reduce((acc, { record }) => {
      for (const lang of record.languages) {
        acc[lang.name] ??= { name: lang.name, bytes: 0, repos: [] };
        acc[lang.name].bytes += lang.bytes;
        acc[lang.name].repos.push(record.name);
      }
      return acc;
    }, {}),
  ).sort((a, b) => b.bytes - a.bytes);
  const totalBytes = languages.reduce((sum, lang) => sum + lang.bytes, 0);

  const records = repos.map(({ record }) => record);
  const snapshot = {
    schema: 1,
    generatedAt,
    source: { authenticated: client.authenticated, calendar: calendarSource, requests: client.stats.requests, notModified: client.stats.notModified },
    profile,
    identity: config.identity,
    links: { ...config.links, github, site: config.websiteUrl },
    totals: {
      repos: records.length,
      files: records.reduce((sum, r) => sum + r.morphology.files, 0),
      directories: records.reduce((sum, r) => sum + r.morphology.directories, 0),
      bytes: totalBytes,
      languages: languages.length,
      technologies: techGraph.nodes.length,
      stars: records.reduce((sum, r) => sum + r.stars, 0),
      forks: records.reduce((sum, r) => sum + r.forks, 0),
      openIssues: records.reduce((sum, r) => sum + r.openIssues, 0),
      commits: records.reduce((sum, r) => sum + r.commits.count, 0),
      followers: profile.followers,
      contributions: stats.total,
      activeDays: stats.activeDays,
      ageDays: stats.ageDays,
    },
    languages: languages.map((lang) => ({ ...lang, share: round(lang.bytes / (totalBytes || 1), 4) })),
    repos: records,
    sealed,
    // One specimen order for the site and the README: featured systems as the brief lists
    // them, then the other public repositories by size. Plate numbers follow it.
    order: [
      ...config.featured.map((f) => f.id).filter((id) => records.some((r) => r.id === id) || sealed.some((s) => s.id === id)),
      ...records.filter((r) => !r.featured).map((r) => r.id),
    ],
    calendar: {
      from: days[0].date,
      to: days.at(-1).date,
      weeks,
      days: days.map((d) => [d.date, d.count, d.level]),
      stats,
      attribution,
      restricted: graph?.restrictedContributionsCount ?? 0,
    },
    tech: { classes: techClasses, ...techGraph },
    activity,
  };

  const cells = days
    .map((d, i) => ({ x: Math.floor((i + offset) / 7), y: (i + offset) % 7, level: d.level }))
    .filter((cell) => cell.level > 0);
  const geometry = {
    schema: 1,
    generatedAt,
    core: coreLayout(repos.map(({ record, paths }) => ({ name: record.name, paths }))),
    dendrites: Object.fromEntries(repos.map(({ record, paths }) => [record.name, dendrite(paths, record.name)])),
    ...(({ positions, scale }) => ({ network: positions, networkScale: scale }))(networkLayout(techGraph, records.map((r) => r.name))),
    snake: solveSnake(cells, weeks, 7),
  };

  const dropped = repos.reduce((sum, r) => sum + r.dropped.length, 0);
  return { snapshot, geometry, dropped, missing };
}

const exists = (file) =>
  stat(file).then(
    () => true,
    () => false,
  );

async function main() {
  const started = Date.now();
  console.log('Living System pipeline');
  const { token, source } = resolveToken();
  const client = await createClient({ token, cacheFile: path.join(root, '.cache', 'http-cache.json'), log });
  const snapshotFile = path.join(root, 'data', 'snapshot.json');
  const geometryFile = path.join(root, 'data', 'geometry.json');

  let result;
  try {
    result = await collect(client, source);
    const s = snapshotSchema.safeParse(result.snapshot);
    if (!s.success) throw new Error(`snapshot failed validation:\n${s.error.issues.slice(0, 8).map((i) => `     ${i.path.join('.')}: ${i.message}`).join('\n')}`);
    const g = geometrySchema.safeParse(result.geometry);
    if (!g.success) throw new Error(`geometry failed validation:\n${g.error.issues.slice(0, 8).map((i) => `     ${i.path.join('.')}: ${i.message}`).join('\n')}`);
    if (strict && result.dropped) throw new Error(`${result.dropped} field note(s) no longer match their repositories`);
  } catch (error) {
    await client.save();
    console.error(`\n  pipeline failed: ${error.message}`);
    if (!strict && (await exists(snapshotFile)) && (await exists(geometryFile))) {
      const previous = JSON.parse(await readFile(snapshotFile, 'utf8'));
      console.error(`  keeping the last good snapshot from ${previous.generatedAt}\n`);
      return;
    }
    process.exitCode = 1;
    return;
  }

  await mkdir(path.dirname(snapshotFile), { recursive: true });
  await writeFile(snapshotFile, `${JSON.stringify(result.snapshot, null, 1)}\n`);
  await writeFile(geometryFile, `${JSON.stringify(result.geometry)}\n`);
  await client.save();

  if (!args.has('--no-svg')) {
    const { renderPlates, renderReadme } = await import('./svg/index.mjs');
    const written = await renderReadme({ snapshot: result.snapshot, geometry: result.geometry, outDir: path.join(root, 'public', 'readme') });
    const art = await renderPlates({ snapshot: result.snapshot, geometry: result.geometry, outDir: path.join(root, 'public', 'plates') });
    log(`README plates: ${written.length} · site art: ${art.length}`);
  }

  const { totals, calendar, repos } = result.snapshot;
  const notes = repos.reduce((sum, r) => sum + r.notes.length + r.layers.length + (r.stages ? 1 : 0), 0);
  log(`${totals.repos} repositories · ${totals.files} files · ${totals.bytes} bytes · ${totals.languages} languages · ${totals.technologies} technologies`);
  log(`${calendar.stats.total} contributions on ${calendar.stats.activeDays} days (calendar from the ${result.snapshot.source.calendar})`);
  log(`${notes} cited entries verified, ${result.dropped} dropped`);
  log(`${client.stats.requests} requests (${client.stats.notModified} not modified, ${client.stats.raw} raw files) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

await main();
