// The shape every snapshot must have before it is written. A snapshot that fails here
// is never published: the previous one stays in place.
import { z } from 'zod';

const count = z.number().int().nonnegative();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const datetime = z.iso.datetime();
const url = z.string().regex(/^https:\/\/github\.com\//);
const cited = { quote: z.string().min(3), path: z.string().min(1), url };

const repo = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1),
  featured: z.boolean(),
  visibility: z.literal('public'),
  url,
  description: z.string().nullable(),
  homepage: z.string().nullable(),
  license: z.string().nullable(),
  defaultBranch: z.string().min(1),
  createdAt: datetime,
  pushedAt: datetime,
  stars: count,
  forks: count,
  openIssues: count,
  sizeKb: count,
  topics: z.array(z.string()),
  primaryLanguage: z.string().nullable(),
  languages: z.array(z.object({ name: z.string(), bytes: count, share: z.number().min(0).max(1) })),
  bytes: count,
  commits: z.object({
    count,
    head: z.object({ sha: z.string().regex(/^[0-9a-f]{40}$/), message: z.string(), date: datetime, url }).nullable(),
  }),
  morphology: z.object({
    files: count,
    directories: count,
    maxDepth: count,
    classes: z.object({ source: count, docs: count, config: count, other: count }),
    topLevel: z.array(z.object({ name: z.string(), type: z.enum(['dir', 'file']), files: count })),
  }),
  manifests: z.array(z.object({ path: z.string(), kind: z.enum(['npm', 'pip', 'extension']), dependencies: z.array(z.string()), devDependencies: z.array(z.string()) })),
  tech: z.array(z.object({ id: z.string(), evidence: z.array(z.string()).min(1) })),
  signature: z.enum(['trajectory', 'perimeter', 'lattice', 'loop']).nullable(),
  stages: z.object({ items: z.array(z.string()).min(2), ...cited }).nullable(),
  layers: z.array(z.object({ name: z.string(), dir: z.string().nullable(), ...cited })),
  notes: z.array(z.object({ title: z.string(), ...cited })),
  contributions: count,
});

export const snapshotSchema = z
  .object({
    schema: z.literal(1),
    generatedAt: datetime,
    source: z.object({ authenticated: z.boolean(), calendar: z.enum(['public-page', 'graphql']), requests: count, notModified: count }),
    profile: z.object({
      login: z.string(),
      name: z.string().nullable(),
      bio: z.string().nullable(),
      location: z.string().nullable(),
      url,
      createdAt: datetime,
      publicRepos: count,
      followers: count,
      following: count,
    }),
    identity: z.object({ name: z.string(), role: z.string() }),
    links: z.object({ github: url, linkedin: z.string(), email: z.string(), portfolio: z.string(), site: z.string() }),
    totals: z.object({
      repos: count,
      files: count,
      directories: count,
      bytes: count,
      languages: count,
      technologies: count,
      stars: count,
      forks: count,
      openIssues: count,
      commits: count,
      followers: count,
      contributions: count,
      activeDays: count,
      ageDays: count,
    }),
    languages: z.array(z.object({ name: z.string(), bytes: count, share: z.number(), repos: z.array(z.string()) })),
    repos: z.array(repo).min(1),
    sealed: z.array(z.object({ id: z.string(), name: z.string(), summary: z.string(), source: z.string() })),
    order: z.array(z.string()).min(1),
    calendar: z.object({
      from: date,
      to: date,
      weeks: count,
      days: z.array(z.tuple([date, count, z.number().int().min(0).max(4)])).min(1),
      stats: z.object({
        total: count,
        activeDays: count,
        busiest: z.object({ date, count }).nullable(),
        longestStreak: z.object({ length: count, from: date.nullable(), to: date.nullable() }),
        firstActive: date.nullable(),
        lastActive: date.nullable(),
        genesis: date,
        ageDays: count,
        daysSinceGenesis: count,
      }),
      attribution: z.array(
        z.object({
          date,
          count,
          parts: z.array(z.object({ repo: z.string(), kind: z.enum(['commit', 'repository', 'issue', 'pull request', 'review']), count })),
          unattributed: count,
        }),
      ),
      restricted: count,
    }),
    tech: z.object({
      classes: z.record(z.string(), z.string()),
      nodes: z.array(z.object({ id: z.string(), label: z.string(), class: z.enum(['language', 'framework', 'infrastructure', 'ai']), bytes: count, repos: z.array(z.string()).min(1), evidence: z.array(z.object({ repo: z.string(), path: z.string() })).min(1) })),
      edges: z.array(z.object({ repo: z.string(), tech: z.string(), weight: z.number().min(0).max(1) })),
    }),
    activity: z.array(z.object({ at: datetime, repo: z.string(), kind: z.string(), text: z.string(), source: z.enum(['event', 'repository']) })),
  })
  .superRefine((snapshot, ctx) => {
    const sum = snapshot.calendar.days.reduce((total, day) => total + day[1], 0);
    if (sum !== snapshot.calendar.stats.total) ctx.addIssue({ code: 'custom', message: `calendar days sum to ${sum}, stats say ${snapshot.calendar.stats.total}` });
    const files = snapshot.repos.reduce((total, r) => total + r.morphology.files, 0);
    if (files !== snapshot.totals.files) ctx.addIssue({ code: 'custom', message: 'file totals disagree' });
    const names = new Set(snapshot.repos.map((r) => r.name));
    for (const edge of snapshot.tech.edges) if (!names.has(edge.repo)) ctx.addIssue({ code: 'custom', message: `edge to unknown repository ${edge.repo}` });
  });

export const geometrySchema = z.object({
  schema: z.literal(1),
  generatedAt: datetime,
  core: z.array(z.object({ repo: z.string(), eta: z.number(), fibres: count, classes: z.string().regex(/^[0-3]*$/) })),
  dendrites: z.record(
    z.string(),
    z.object({
      positions: z.array(z.number()),
      kinds: z.array(z.number().int()),
      depths: z.array(count),
      classes: z.array(z.number().int().min(-1).max(3)),
      edges: z.array(count),
      dirs: z.record(z.string(), count),
      maxDepth: count,
    }),
  ),
  network: z.record(z.string(), z.tuple([z.number(), z.number(), z.number()])),
  networkScale: z.number().positive(),
  snake: z.object({
    length: count,
    width: count,
    height: count,
    path: z.array(z.tuple([z.number().int(), z.number().int()])),
    eats: z.array(z.object({ step: count, x: count, y: count, level: z.number().int().min(1).max(4) })),
  }),
});
