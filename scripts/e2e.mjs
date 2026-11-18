// End-to-end tests in real Chrome against the production build.
// `npm run build && npm run test:e2e`. Needs Google Chrome. E2E_ONLY="snake|live" runs a subset.
//
// GitHub's API is mocked in every test, so the suite is deterministic, can rehearse rate limits
// and outages, and never spends the hourly quota of the machine running it.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { formatBytes, formatInt } from '../src/lib/format.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4189;
const BASE = `http://localhost:${PORT}/`;
const GPU = ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--mute-audio'];
// A deprecation notice printed by @react-three/fiber itself (it still uses THREE.Clock); not ours.
const KNOWN = [/THREE\.Clock: This module has been deprecated/];

const snapshot = JSON.parse(await readFile(path.join(root, 'data', 'snapshot.json'), 'utf8'));
const login = snapshot.profile.login;

const server = spawn('node', ['scripts/preview.mjs'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((resolve) => setTimeout(resolve, 600));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: GPU });

let passed = 0;
const failed = [];
const only = process.env.E2E_ONLY ? new RegExp(process.env.E2E_ONLY, 'i') : null;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function test(name, run) {
  if (only && !only.test(name)) return;
  const started = Date.now();
  try {
    await run();
    passed += 1;
    console.log(`  ok    ${name} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (error) {
    failed.push(name);
    console.log(`  FAIL  ${name}\n        ${String(error.message || error).split('\n').slice(0, 4).join('\n        ')}`);
  }
}

// --------------------------------------------------------------- GitHub mock
function apiPayloads({ starBump = 0, events = [] } = {}) {
  return {
    profile: { login, public_repos: snapshot.profile.publicRepos, followers: snapshot.profile.followers, following: snapshot.profile.following },
    repos: snapshot.repos.map((r, i) => ({ name: r.name, private: false, fork: false, stargazers_count: r.stars + (i === 0 ? starBump : 0), forks_count: r.forks, open_issues_count: r.openIssues, pushed_at: r.pushedAt, created_at: r.createdAt })),
    events,
  };
}

async function mockGitHub(context, mode = 'ok', options = {}) {
  const hits = { count: 0 };
  await context.route('https://api.github.com/**', async (route) => {
    hits.count += 1;
    if (mode === 'offline') return route.abort('internetdisconnected');
    if (mode === 'limited') return route.fulfill({ status: 403, headers: { 'access-control-allow-origin': '*', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1800), 'access-control-expose-headers': 'x-ratelimit-remaining, x-ratelimit-reset' }, body: '{"message":"API rate limit exceeded"}' });
    const p = apiPayloads(options);
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith('/repos') ? p.repos : url.pathname.endsWith('/events/public') ? p.events : p.profile;
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'x-ratelimit-remaining': '57', 'access-control-expose-headers': 'x-ratelimit-remaining, x-ratelimit-reset' }, body: JSON.stringify(body) });
  });
  return hits;
}

async function openPage({ width = 1440, height = 900, reducedMotion, javaScriptEnabled = true, api = 'ok', apiOptions, b = browser, storage, waitScene = false } = {}) {
  const context = await b.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700, reducedMotion: reducedMotion ? 'reduce' : 'no-preference', javaScriptEnabled });
  const hits = await mockGitHub(context, api, apiOptions);
  if (storage) await context.addInitScript((pairs) => pairs.forEach(([k, v]) => localStorage.setItem(k, v)), storage);
  const page = await context.newPage();
  const problems = [];
  const hosts = new Set();
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type()) && !KNOWN.some((k) => k.test(m.text()))) problems.push(`${m.type()}: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
  page.on('request', (r) => hosts.add(new URL(r.url()).host));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().startsWith('https://api.github.com')) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  await page.goto(BASE, { waitUntil: 'load' });
  if (javaScriptEnabled) await page.waitForFunction(() => document.documentElement.classList.contains('hydrated'), null, { timeout: 10_000 });
  if (waitScene) await page.waitForFunction(() => document.documentElement.classList.contains('scene-ready'), null, { timeout: 25_000 });
  return { page, context, problems, hosts, hits };
}

const clean = (problems) => assert(problems.length === 0, problems.slice(0, 4).join(' | '));
const text = (page, selector) => page.locator(selector).first().innerText();
async function scrollToFigure(page, id, fraction = 0.4) {
  await page.evaluate(
    ([target, f]) => {
      const el = document.getElementById(target);
      window.scrollTo(0, el.offsetTop + Math.max(0, el.offsetHeight * f - innerHeight * 0.5));
    },
    [id, fraction],
  );
  await page.waitForTimeout(600);
}

// --------------------------------------------------------------- tests
console.log('\nDocument');

await test('the prerendered page is complete without JavaScript', async () => {
  const { page, context } = await openPage({ javaScriptEnabled: false });
  assert((await text(page, 'h1')).replace(/\s+/g, ' ').trim() === 'The Living System', 'missing title');
  assert((await page.locator('article.specimen').count()) === snapshot.order.length, 'specimen plates missing');
  assert((await page.locator('.days__table tbody tr').count()) === snapshot.calendar.attribution.length, 'active days missing');
  assert((await page.locator('.techlist .tech').count()) === snapshot.tech.nodes.length, 'technologies missing');
  assert(!(await page.evaluate(() => document.documentElement.classList.contains('has-3d'))), 'no 3D without JavaScript');
  await context.close();
});

await test('numbers on the page are the snapshot’s', async () => {
  const { page, context, problems } = await openPage();
  const hero = await text(page, '.readout--hero');
  for (const value of [formatInt(snapshot.totals.repos), formatInt(snapshot.totals.files), formatBytes(snapshot.totals.bytes), formatInt(snapshot.totals.languages), formatInt(snapshot.totals.ageDays)]) assert(hero.includes(value), `hero lacks ${value}`);
  for (const repo of snapshot.repos) {
    const plate = await text(page, `#specimen-${repo.id} .facts`);
    assert(plate.includes(`${formatInt(repo.commits.count)} on`), `${repo.name}: commits`);
    assert(plate.includes(`${formatInt(repo.morphology.files)} file`), `${repo.name}: files`);
  }
  const vitals = await text(page, '.vitals');
  for (const value of [formatInt(snapshot.totals.contributions), formatInt(snapshot.totals.technologies), formatInt(snapshot.totals.commits)]) assert(vitals.includes(value), `vitals lack ${value}`);
  clean(problems);
  await context.close();
});

await test('WebGL starts, reports ready, and the page stays error-free', async () => {
  const { page, context, problems } = await openPage({ waitScene: true });
  assert(await page.locator('.stage canvas').count(), 'no canvas');
  const handshake = await text(page, '.handshake');
  assert(/WebGL 2/.test(handshake), `handshake: ${handshake}`);
  for (const id of ['specimens', 'genome', 'network', 'vitals']) {
    await scrollToFigure(page, id);
    await page.waitForTimeout(700);
  }
  clean(problems);
  await context.close();
});

console.log('\nLive data');

await test('live data overlays the snapshot and is labelled live', async () => {
  const now = new Date().toISOString();
  const { page, context, problems } = await openPage({ apiOptions: { starBump: 5, events: [{ type: 'PushEvent', public: true, created_at: now, repo: { name: `${login}/${snapshot.repos[0].name}` }, payload: { ref: 'refs/heads/main', size: 2 } }] } });
  await page.waitForFunction(() => document.querySelector('.live')?.dataset.status === 'ok', null, { timeout: 8000 });
  const stars = await page.locator('.vital', { hasText: 'stars' }).innerText();
  assert(/(^|\D)5(\D|$)/.test(stars) && /live/i.test(stars), `stars: ${stars}`);
  assert((await text(page, '.activity')).includes('pushed 2 commits to main'), 'live event missing from activity');
  assert(/Live: checked/.test(await text(page, '.live')), 'live line');
  clean(problems);
  await context.close();
});

await test('a rate limit keeps the snapshot and says so', async () => {
  const { page, context, problems } = await openPage({ api: 'limited' });
  await page.waitForFunction(() => document.querySelector('.live')?.dataset.status === 'limited', null, { timeout: 8000 });
  assert(/limit/.test(await text(page, '.live')), 'no rate-limit message');
  const stars = await page.locator('.vital', { hasText: 'stars' }).innerText();
  assert(!/live/i.test(stars) && stars.includes(formatInt(snapshot.totals.stars)), `stars: ${stars}`);
  clean(problems.filter((p) => !/403|Failed to load resource/.test(p)));
  await context.close();
});

await test('an outage keeps the snapshot and says so', async () => {
  const { page, context, problems } = await openPage({ api: 'offline' });
  await page.waitForFunction(() => document.querySelector('.live')?.dataset.status === 'error', null, { timeout: 8000 });
  assert(/failed/i.test(await text(page, '.live')), 'no outage message');
  clean(problems.filter((p) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource|Failed to fetch/.test(p)));
  await context.close();
});

await test('a revisit within ten minutes makes no new requests', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const hits = await mockGitHub(context, 'ok');
  const page = await context.newPage();
  await page.goto(BASE);
  await page.waitForFunction(() => document.querySelector('.live')?.dataset.status === 'ok', null, { timeout: 8000 });
  const first = hits.count;
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.live')?.dataset.status === 'ok', null, { timeout: 8000 });
  assert(first === 3 && hits.count === 3, `requests: first ${first}, after reload ${hits.count}`);
  await context.close();
});

console.log('\nInteraction');

await test('number keys move between figures and the rail follows', async () => {
  const { page, context, problems } = await openPage();
  await page.keyboard.press('3');
  await page.waitForFunction(() => document.querySelector('.rail a[aria-current]')?.getAttribute('href') === '#genome', null, { timeout: 6000 });
  await page.waitForFunction(() => location.hash === '#genome', null, { timeout: 6000 });
  await page.keyboard.press('1');
  await page.waitForFunction(() => document.querySelector('.rail a[aria-current]')?.getAttribute('href') === '#core', null, { timeout: 6000 });
  clean(problems);
  await context.close();
});

await test('a specimen plate opens, takes focus, cycles with arrows and returns focus on Escape', async () => {
  const { page, context, problems } = await openPage({ waitScene: true });
  await scrollToFigure(page, 'specimens');
  const trigger = page.locator('a[href="#specimen-safecircle"]');
  await trigger.click();
  await page.waitForFunction(() => document.querySelector('.plates')?.dataset.open === 'true');
  await page.waitForFunction(() => document.activeElement?.id === 'specimen-safecircle-name', null, { timeout: 3000 });
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('#specimen-omnipilot')?.classList.contains('is-open'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('.plates')?.dataset.open === 'false');
  await page.waitForFunction(() => document.activeElement?.getAttribute('href') === '#specimen-safecircle', null, { timeout: 3000 });
  clean(problems);
  await context.close();
});

await test('an architecture layer can be lit from the plate', async () => {
  const { page, context, problems } = await openPage({ waitScene: true });
  await scrollToFigure(page, 'specimens');
  await page.locator('a[href="#specimen-omnipilot"]').click();
  const layer = page.locator('#specimen-omnipilot .layer__btn', { hasText: 'server/' }).first();
  await layer.click();
  assert((await layer.getAttribute('aria-pressed')) === 'true', 'layer not pressed');
  clean(problems);
  await context.close();
});

await test('the snake eats every lit day', async () => {
  const { page, context, problems } = await openPage({ waitScene: true });
  await scrollToFigure(page, 'genome', 0.34);
  await page.locator('.snake .button').first().click();
  const total = snapshot.calendar.days.filter((d) => d[2] > 0).length;
  await page.waitForFunction((n) => document.querySelector('.snake__status')?.textContent.startsWith(`${n} of ${n} eaten`), total, { timeout: 30_000 });
  await page.waitForFunction(() => /Run again/i.test(document.querySelector('.snake .button')?.textContent ?? ''), null, { timeout: 5000 });
  clean(problems);
  await context.close();
});

await test('a technology shows the files that prove it, and classes filter', async () => {
  const { page, context, problems } = await openPage();
  await scrollToFigure(page, 'network');
  const node = snapshot.tech.nodes.find((n) => n.id === 'fastapi') ?? snapshot.tech.nodes[0];
  await page.locator('.techlist .tech', { hasText: node.label }).first().click();
  assert((await text(page, '.tech-detail__name')) === node.label, 'detail name');
  const links = await page.locator('.tech-detail .evidence a').evaluateAll((as) => as.map((a) => a.href));
  assert(links.length >= 1 && links.every((h) => new RegExp(`^https://github\\.com/${login}/[^/]+/blob/[0-9a-f]{40}/`).test(h)), `evidence links: ${links.join(' ')}`);
  await page.locator('.filter', { hasText: 'AI / ML' }).click();
  assert((await page.locator('.techlist__group[data-dim]').count()) === 3, 'other classes not dimmed');
  clean(problems);
  await context.close();
});

console.log('\nPreferences and fallbacks');

await test('motion, sound and 3D switches work and persist', async () => {
  const { page, context, problems } = await openPage();
  const motion = page.locator('.switch', { hasText: 'Motion' });
  await motion.click();
  assert((await page.evaluate(() => document.documentElement.dataset.motion)) === 'off', 'motion not off');
  const sound = page.locator('.switch', { hasText: 'Sound' });
  assert((await sound.getAttribute('aria-pressed')) === 'false', 'sound should start off');
  await sound.click();
  assert((await sound.getAttribute('aria-pressed')) === 'true', 'sound did not turn on');
  await page.locator('.switch', { hasText: '3D' }).click();
  assert(!(await page.evaluate(() => document.documentElement.classList.contains('has-3d'))), '3D still on');
  assert(await page.locator('.plate--core img').isVisible(), 'still plate hidden');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.classList.contains('hydrated'));
  const state = await page.evaluate(() => ({ motion: document.documentElement.dataset.motion, three: document.documentElement.classList.contains('has-3d') }));
  assert(state.motion === 'off' && !state.three, `not remembered: ${JSON.stringify(state)}`);
  assert((await page.locator('.switch', { hasText: 'Sound' }).getAttribute('aria-pressed')) === 'false', 'sound must start off on every visit');
  clean(problems);
  await context.close();
});

await test('reduced motion is honoured from the first paint', async () => {
  const { page, context, problems } = await openPage({ reducedMotion: true });
  assert((await page.evaluate(() => document.documentElement.dataset.motion)) === 'off', 'motion not off');
  clean(problems);
  await context.close();
});

// The page checks only that the WebGL 2 API exists before first paint (a real context would
// block it); a browser that has the API but cannot make a context falls back when the scene
// fails to start.
await test('without WebGL: still plates, a disabled 3D switch, and a working snake', async () => {
  const noGl = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-webgl', '--disable-3d-apis', '--mute-audio'] });
  const { page, context, problems } = await openPage({ b: noGl });
  await page.waitForFunction(() => !document.documentElement.classList.contains('has-3d'), null, { timeout: 10_000 });
  assert(await page.locator('.switch', { hasText: '3D' }).isDisabled(), '3D switch should be disabled');
  assert(await page.locator('.plate--core img').isVisible(), 'core plate hidden');
  await page.locator('#genome').scrollIntoViewIfNeeded();
  await page.locator('.snake .button').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.plate--genome .snake-seg').length > 0, null, { timeout: 8000 });
  clean(problems.filter((p) => !/WebGL|THREE\.WebGLRenderer|Error creating/i.test(p)));
  await context.close();
  await noGl.close();
});

console.log('\nResponsive');
for (const [width, height] of [
  [320, 640],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
]) {
  await test(`${width}×${height}: no horizontal overflow, switches on screen, no errors`, async () => {
    const { page, context, problems } = await openPage({ width, height });
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, right: Math.max(...[...document.querySelectorAll('.switch')].map((s) => s.getBoundingClientRect().right)), width: innerWidth }));
    assert(m.overflow <= 0, `overflows by ${m.overflow}px`);
    assert(m.right <= m.width, `switches end at ${m.right}px of ${m.width}`);
    clean(problems);
    await context.close();
  });
}

console.log('\nSecurity and accessibility');

await test('only this site and api.github.com are contacted', async () => {
  const { page, context, hosts } = await openPage({ waitScene: true });
  await scrollToFigure(page, 'vitals');
  await page.waitForTimeout(800);
  const unexpected = [...hosts].filter((h) => h !== `localhost:${PORT}` && h !== 'api.github.com');
  assert(unexpected.length === 0, `unexpected hosts: ${unexpected.join(', ')}`);
  await context.close();
});

await test('accessible names, alt text, heading order and a working skip link', async () => {
  const { page, context, problems } = await openPage();
  const report = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('img').forEach((img) => img.hasAttribute('alt') || out.push(`img without alt: ${img.src}`));
    document.querySelectorAll('button, a[href]').forEach((el) => {
      const name = (el.getAttribute('aria-label') || el.textContent || '').trim();
      if (!name && !el.closest('[aria-hidden="true"]')) out.push(`unnamed ${el.tagName}`);
    });
    let last = 1;
    document.querySelectorAll('main h1, main h2, main h3, main h4').forEach((h) => {
      const level = Number(h.tagName[1]);
      if (level > last + 1) out.push(`heading skips from h${last} to h${level}: ${h.textContent.slice(0, 30)}`);
      last = level;
    });
    return out;
  });
  assert(report.length === 0, report.slice(0, 4).join(' | '));
  await page.keyboard.press('Tab');
  assert((await page.evaluate(() => document.activeElement?.className)) === 'skip', 'first tab stop is not the skip link');
  clean(problems);
  await context.close();
});

await browser.close();
server.kill();
console.log(`\n${passed} passed, ${failed.length} failed`);
if (failed.length) {
  console.log(failed.map((name) => `  - ${name}`).join('\n'));
  process.exit(1);
}
