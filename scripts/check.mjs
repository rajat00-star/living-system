// Static checks on the production build. Run with `npm run check` (it builds first).
// Fails if a token or a private repository could reach the shipped files, if the page lost
// its structure or its numbers, if a local reference is broken, or if a budget is exceeded.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { config } from '../content/config.mjs';
import { formatBytes, formatInt } from '../src/lib/format.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const failures = [];
const notes = [];

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])))).flat();
};
const exists = (file) =>
  stat(file).then(
    () => true,
    () => false,
  );
const gz = (buffer) => gzipSync(buffer, { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const files = await walk(dist);
const textFiles = files.filter((f) => /\.(html|js|css|svg|json|txt|xml)$/.test(f));
const html = await readFile(path.join(dist, 'index.html'), 'utf8');
const snapshot = JSON.parse(await readFile(path.join(root, 'data', 'snapshot.json'), 'utf8'));
const publicRepos = new Set(snapshot.repos.map((r) => r.name.toLowerCase()));

// 1. Nothing secret, nothing private.
const secretPatterns = [/\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /\bGITHUB_TOKEN\b/, /\bGH_TOKEN\b/];
// The only email address the site may carry is the public one in content/config.mjs.
const allowedEmails = new Set([config.links.email.toLowerCase()].filter(Boolean));
for (const file of textFiles) {
  const name = path.relative(dist, file);
  const content = await readFile(file, 'utf8');
  for (const pattern of secretPatterns) if (pattern.test(content)) failures.push(`${name} contains a secret-shaped string: ${pattern}`);
  if (/\.(html|json|svg|txt|xml)$/.test(name)) {
    for (const [address] of content.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi)) {
      if (!allowedEmails.has(address.toLowerCase())) failures.push(`${name} contains an email address that is not the public one: ${address}`);
    }
  }
  // Every repository link must point at a public repository from the snapshot.
  const login = config.login.replace(/[-]/g, '\\-');
  for (const match of content.matchAll(new RegExp(`github\\.com/${login}/([A-Za-z0-9._-]+)`, 'gi'))) {
    if (!publicRepos.has(match[1].toLowerCase())) failures.push(`${name} links to a repository that is not public: ${match[1]}`);
  }
}

// 2. The document's structure.
const h1 = (html.match(/<h1[\s>]/g) || []).length;
if (h1 !== 1) failures.push(`expected exactly one <h1>, found ${h1}`);
for (const tag of ['<main', '<header', '<footer', '<nav', 'lang="en"', '<title>', 'name="description"', 'application/ld+json', 'http-equiv="Content-Security-Policy"', 'id="snapshot"', 'class="skip"']) {
  if (!html.includes(tag)) failures.push(`index.html is missing ${tag}`);
}
const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
if (/script-src[^;]*'unsafe-inline'/.test(csp)) failures.push("the policy allows inline scripts");
if (!/connect-src 'self' https:\/\/api\.github\.com/.test(csp)) failures.push('the policy does not pin connections to this site and api.github.com');

const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
for (const pattern of [/YOUR-[A-Z]/, /lorem ipsum/i, /\bTODO\b/, /\bFIXME\b/, /\bNaN\b/, /\bundefined\b/, /\[object Object\]/]) {
  if (pattern.test(visible)) failures.push(`visible text contains ${pattern}`);
}

// 3. The numbers on the page are the snapshot's.
const expected = [formatInt(snapshot.totals.files), formatBytes(snapshot.totals.bytes), formatInt(snapshot.totals.commits), ...snapshot.repos.map((r) => r.displayName), ...snapshot.sealed.map((s) => s.name)];
for (const value of expected) if (!visible.includes(value)) failures.push(`the page does not show ${value}`);
const articles = (html.match(/<article id="specimen-/g) || []).length;
if (articles !== snapshot.order.length) failures.push(`expected ${snapshot.order.length} specimen plates, found ${articles}`);

// 4. Every local reference resolves.
const refs = new Set();
for (const m of html.matchAll(/\s(?:src|href)="([^"#][^"]*)"/g)) refs.add(m[1]);
for (const m of html.matchAll(/url\((["']?)([^"')]+)\1\)/g)) refs.add(m[2]);
for (const ref of refs) {
  if (/^(https?:|mailto:|data:|#)/.test(ref)) continue;
  const clean = ref.split(/[?#]/)[0];
  if (!(await exists(path.join(dist, clean)))) failures.push(`broken local reference: ${ref}`);
}
for (const needed of ['data/geometry.json', 'favicon.svg', 'robots.txt', 'readme/core.svg', 'readme/vitals.svg', 'readme/network.svg', ...snapshot.order.map((id) => `readme/specimen-${id}.svg`), ...snapshot.order.map((id) => `plates/specimen-${id}.svg`)]) {
  if (!(await exists(path.join(dist, needed)))) failures.push(`missing ${needed}`);
}

// 5. Budgets, gzipped as a static host serves them.
const assets = files.filter((f) => f.includes(`${path.sep}assets${path.sep}`));
const main = assets.find((f) => /main-[A-Z0-9]+\.js$/.test(f));
const mainCode = await readFile(main, 'utf8');
const staticImports = [...mainCode.matchAll(/from\s*"\.\/([^"]+\.js)"/g)].map((m) => path.join(path.dirname(main), m[1]));
const initial = (await Promise.all([main, ...staticImports].map(async (f) => gz(await readFile(f))))).reduce((a, b) => a + b, 0);
const scene = assets.find((f) => /Scene-[A-Z0-9]+\.js$/.test(f));
const worker = assets.find((f) => /network-worker-[A-Z0-9]+\.js$/.test(f));
const budgets = [
  ['initial JavaScript', initial, 92 * 1024],
  ['3D chunk', gz(await readFile(scene)), 330 * 1024],
  ['network worker', gz(await readFile(worker)), 20 * 1024],
  ['index.html (with inline CSS and data)', gz(Buffer.from(html)), 70 * 1024],
  ['geometry.json', gz(await readFile(path.join(dist, 'data', 'geometry.json'))), 40 * 1024],
];
for (const svg of files.filter((f) => f.endsWith('.svg'))) budgets.push([path.relative(dist, svg), gz(await readFile(svg)), 60 * 1024]);
for (const [label, size, limit] of budgets) {
  if (size > limit) failures.push(`${label} is ${kb(size)} gzipped, over its ${kb(limit)} budget`);
  else if (!label.endsWith('.svg')) notes.push(`${label.padEnd(40)} ${kb(size).padStart(9)} of ${kb(limit)}`);
}
const largestSvg = budgets.filter(([l]) => l.endsWith('.svg')).sort((a, b) => b[1] - a[1])[0];
notes.push(`${`largest plate (${largestSvg[0]})`.padEnd(40)} ${kb(largestSvg[1]).padStart(9)} of ${kb(largestSvg[2])}`);

console.log(`\ncheck: ${textFiles.length} text files, ${refs.size} local references, ${publicRepos.size} public repositories`);
for (const note of notes) console.log(`  ${note}`);
if (failures.length) {
  console.error(`\n${failures.length} problem(s):`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log('  all checks passed\n');
