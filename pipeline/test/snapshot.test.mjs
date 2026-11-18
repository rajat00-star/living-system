// The committed snapshot is what ships when GitHub cannot be read, so it is held to the
// same rules as a fresh one, plus the invariants that matter most.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { config } from '../../content/config.mjs';
import { geometrySchema, snapshotSchema } from '../schema.mjs';

const snapshot = JSON.parse(await readFile(new URL('../../data/snapshot.json', import.meta.url), 'utf8'));
const geometry = JSON.parse(await readFile(new URL('../../data/geometry.json', import.meta.url), 'utf8'));

test('snapshot and geometry pass their schemas', () => {
  const s = snapshotSchema.safeParse(snapshot);
  assert.ok(s.success, s.success ? '' : JSON.stringify(s.error.issues.slice(0, 3)));
  const g = geometrySchema.safeParse(geometry);
  assert.ok(g.success, g.success ? '' : JSON.stringify(g.error.issues.slice(0, 3)));
});

test('only public repositories, and no sealed one carries GitHub data', () => {
  for (const repo of snapshot.repos) assert.equal(repo.visibility, 'public');
  for (const sealed of snapshot.sealed) {
    assert.ok(!snapshot.repos.some((r) => r.id === sealed.id));
    assert.deepEqual(Object.keys(sealed).sort(), ['id', 'name', 'source', 'summary']);
  }
  for (const name of config.exclude) assert.ok(!snapshot.repos.some((r) => r.name.toLowerCase() === name.toLowerCase()));
});

test('totals add up from their parts', () => {
  const { totals, repos, calendar, languages, tech } = snapshot;
  assert.equal(totals.repos, repos.length);
  assert.equal(totals.files, repos.reduce((s, r) => s + r.morphology.files, 0));
  assert.equal(totals.bytes, languages.reduce((s, l) => s + l.bytes, 0));
  assert.equal(totals.bytes, repos.reduce((s, r) => s + r.bytes, 0));
  assert.equal(totals.commits, repos.reduce((s, r) => s + r.commits.count, 0));
  assert.equal(totals.contributions, calendar.days.reduce((s, d) => s + d[1], 0));
  assert.equal(totals.activeDays, calendar.days.filter((d) => d[1] > 0).length);
  assert.equal(totals.technologies, tech.nodes.length);
  for (const day of calendar.attribution) assert.equal(day.parts.reduce((s, p) => s + p.count, 0) + day.unattributed, day.count);
});

test('every specimen has its geometry, and every torus a repository', () => {
  for (const repo of snapshot.repos) assert.ok(geometry.dendrites[repo.name], repo.name);
  assert.deepEqual(geometry.core.map((t) => t.repo).sort(), snapshot.repos.map((r) => r.name).sort());
  for (const torus of geometry.core) assert.equal(torus.classes.length, torus.fibres);
  assert.equal(geometry.snake.eats.length, snapshot.calendar.days.filter((d) => d[2] > 0).length);
});

test('every cited passage links to its file at a pinned commit', () => {
  for (const repo of snapshot.repos) {
    for (const item of [repo.stages, ...repo.layers, ...repo.notes].filter(Boolean)) {
      assert.match(item.url, new RegExp(`^https://github\\.com/${config.login}/${repo.name}/blob/[0-9a-f]{40}/`));
    }
  }
});
