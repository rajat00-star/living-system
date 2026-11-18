import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attributeDays, calendarStats, detectTech, fileClass, morphology, parseCalendarHtml, parseManifest, parsePyproject, parseRequirements } from '../derive.mjs';

test('requirements: names only, comments, extras, markers and includes ignored', () => {
  const text = ['fastapi>=0.110 # web', 'psycopg[binary]==3.2', 'SQLAlchemy~=2.0', '-r base.txt', 'git+https://x/y.git', 'pydantic_core ; python_version > "3.9"', '', '# only a comment'].join('\n');
  assert.deepEqual(parseRequirements(text), ['fastapi', 'psycopg', 'sqlalchemy', 'pydantic-core']);
});

test('pyproject: PEP 621 dependencies, optional groups and Poetry tables', () => {
  const text = `[project]\nname = "x"\ndependencies = [\n  "fastapi>=0.1",\n  "httpx",\n]\n[project.optional-dependencies]\ndev = ["pytest>=8"]\n[tool.poetry.dependencies]\npython = "^3.11"\nredis = "*"\n`;
  assert.deepEqual(parsePyproject(text).sort(), ['fastapi', 'httpx', 'pytest', 'redis']);
});

test('manifests: package.json, extension manifest, dev requirements', () => {
  assert.deepEqual(parseManifest('web/package.json', '{"dependencies":{"react":"19"},"devDependencies":{"vite":"7"}}'), { path: 'web/package.json', kind: 'npm', dependencies: ['react'], devDependencies: ['vite'] });
  assert.equal(parseManifest('ext/manifest.json', '{"manifest_version":3}').manifestVersion, 3);
  assert.equal(parseManifest('app/manifest.json', '{"name":"pwa"}'), null);
  assert.deepEqual(parseManifest('requirements-dev.txt', 'pytest').devDependencies, ['pytest']);
  assert.equal(parseManifest('bad/package.json', '{not json'), null);
});

test('technologies carry the file that proves them', () => {
  const tech = detectTech({
    paths: ['Dockerfile', '.github/workflows/ci.yml', 'backend/alembic.ini'],
    manifests: [{ path: 'backend/requirements.txt', kind: 'pip', dependencies: ['fastapi', 'psycopg'], devDependencies: [] }],
    languages: { Python: 10, Dockerfile: 2 },
  });
  const byId = Object.fromEntries(tech.map((t) => [t.id, t.evidence]));
  assert.deepEqual(byId.fastapi, ['backend/requirements.txt']);
  assert.deepEqual(byId.postgresql, ['backend/requirements.txt']);
  assert.deepEqual(byId.docker, ['Dockerfile', 'GitHub language statistics']);
  assert.deepEqual(byId['github-actions'], ['.github/workflows/ci.yml']);
  assert.deepEqual(byId.alembic, ['backend/alembic.ini']);
  assert.equal(byId.react, undefined);
});

test('file classes and morphology', () => {
  assert.equal(fileClass('src/a.ts'), 0);
  assert.equal(fileClass('Dockerfile'), 0);
  assert.equal(fileClass('README.md'), 1);
  assert.equal(fileClass('LICENSE'), 1);
  assert.equal(fileClass('package.json'), 2);
  assert.equal(fileClass('.gitignore'), 2);
  assert.equal(fileClass('docs/shot.png'), 3);
  const m = morphology(['README.md', 'src/a.ts', 'src/lib/b.ts', 'docs/x.png']);
  assert.equal(m.files, 4);
  assert.equal(m.directories, 3);
  assert.equal(m.maxDepth, 2);
  assert.deepEqual(m.classes, { source: 2, docs: 1, config: 0, other: 1 });
  assert.deepEqual(m.topLevel.map((t) => t.name), ['src', 'docs', 'README.md']);
});

const day = (date, count) => ({ date, count, level: count ? 1 : 0 });

test('calendar statistics: totals, busiest day, streaks, age', () => {
  const days = [day('2026-08-05', 0), day('2026-08-06', 1), day('2026-08-07', 3), day('2026-08-08', 2), day('2026-08-09', 0), day('2026-08-10', 9)];
  const s = calendarStats(days, { createdAt: '2026-08-06T10:19:00Z', generatedAt: '2026-08-10T12:00:00Z' });
  assert.equal(s.total, 15);
  assert.equal(s.activeDays, 4);
  assert.deepEqual(s.busiest, { date: '2026-08-10', count: 9 });
  assert.deepEqual(s.longestStreak, { length: 3, from: '2026-08-06', to: '2026-08-08' });
  assert.equal(s.ageDays, 4);
  assert.equal(s.daysSinceGenesis, 5);
});

test('attribution fills each day only up to its count and never invents', () => {
  const days = [day('2026-08-15', 5), day('2026-08-16', 2), day('2026-08-26', 9)];
  const out = attributeDays(days, [
    { date: '2026-08-15', repo: 'a', kind: 'commit', count: 4 },
    { date: '2026-08-15', repo: 'a', kind: 'repository', count: 1 },
    { date: '2026-08-27', repo: 'b', kind: 'commit', count: 9 }, // a day late in UTC: lands on the 26th
    { date: '2026-08-16', repo: 'c', kind: 'commit', count: 5 }, // more than the day holds: dropped
  ]);
  const byDate = Object.fromEntries(out.map((d) => [d.date, d]));
  assert.equal(byDate['2026-08-15'].unattributed, 0);
  assert.equal(byDate['2026-08-26'].parts[0].repo, 'b');
  assert.equal(byDate['2026-08-16'].parts.length, 0);
  assert.equal(byDate['2026-08-16'].unattributed, 2);
});

function calendarHtml(cells, stated) {
  const tds = cells.map(([date, level], i) => `<td tabindex="0" data-ix="${i}" style="width: 11px" data-date="${date}" id="contribution-day-component-${i}" data-level="${level}" role="gridcell" class="ContributionCalendar-day"></td>`);
  const tips = cells.map(([, , tip], i) => `<tool-tip id="t${i}" for="contribution-day-component-${i}" popover="manual" class="sr-only">${tip}</tool-tip>`);
  return `<h2>${stated} contributions\n in the last year</h2><table>${tds.join('')}</table>${tips.join('')}`;
}

test('public calendar page: counts from tooltips, checked against the stated total', () => {
  const html = calendarHtml(
    [
      ['2026-08-06', 1, '1 contribution on August 6th.'],
      ['2026-08-07', 0, 'No contributions on August 7th.'],
      ['2026-08-08', 4, '1,204 contributions on August 8th.'],
    ],
    '1,205',
  );
  assert.deepEqual(parseCalendarHtml(html), [day('2026-08-06', 1), { date: '2026-08-07', count: 0, level: 0 }, { date: '2026-08-08', count: 1204, level: 4 }]);
  assert.throws(() => parseCalendarHtml(calendarHtml([['2026-08-06', 1, '1 contribution on August 6th.']], '2')), /page states/);
  assert.throws(() => parseCalendarHtml(calendarHtml([['2026-08-06', 0, 'No contributions.'], ['2026-08-08', 0, 'No contributions.']], '0')), /gap/);
  assert.throws(() => parseCalendarHtml(calendarHtml([['2026-08-06', 1, 'something else']], '1')), /unreadable/);
});
