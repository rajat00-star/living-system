// Runs Lighthouse against the production build and prints a summary. Run `npm run build`
// first. Lighthouse is fetched on demand with npx, so it is not a project dependency.
// node scripts/lighthouse.mjs [outDir]
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] ?? mkdtempSync(path.join(tmpdir(), 'lighthouse-'));
const PORT = 4198;

const server = spawn('node', ['scripts/preview.mjs'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((resolve) => setTimeout(resolve, 600));

for (const preset of ['mobile', 'desktop']) {
  const output = path.join(outDir, `${preset}.json`);
  spawnSync(
    'npx',
    [
      '--yes',
      'lighthouse@latest',
      `http://localhost:${PORT}/`,
      '--quiet',
      '--chrome-flags=--headless=new --use-angle=metal --ignore-gpu-blocklist',
      '--only-categories=performance,accessibility,best-practices,seo',
      '--output=json',
      `--output-path=${output}`,
      ...(preset === 'desktop' ? ['--preset=desktop'] : []),
    ],
    { stdio: 'ignore', cwd: outDir },
  );
  const { categories, audits } = JSON.parse(readFileSync(output, 'utf8'));
  console.log(preset.padEnd(8), Object.values(categories).map((c) => `${c.id}: ${Math.round(c.score * 100)}`).join('  '));
  console.log(
    '        ',
    ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index'].map((id) => `${audits[id].title.replace(/ *\(.*/, '')}: ${audits[id].displayValue}`).join(' · '),
  );
  const flagged = Object.values(audits).filter((a) => a.score !== null && a.score < 0.9 && !['informative', 'notApplicable', 'manual'].includes(a.scoreDisplayMode));
  console.log('          flagged:', flagged.map((a) => `${a.id} (${a.displayValue ?? a.score})`).join(', ') || 'none');
}
server.kill();
