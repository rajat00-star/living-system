// Builds the Living System, following the portfolio's build: esbuild bundles the client,
// React prerenders the whole document to static HTML, and dist/ is written for any static
// host. Two additions: the 3D scene is a separate chunk loaded after first paint, and the
// network layout runs in a module worker with its own hashed file.
// `--dev` adds watch mode, a server and live reload.
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const cacheDir = path.join(root, 'node_modules', '.cache', 'living-system');
// Development output stays apart from dist/, so a running dev server never overwrites a build.
const dist = dev ? path.join(cacheDir, 'dev') : path.join(root, 'dist');
const port = Number(process.env.PORT || 5174);

const env = { 'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production') };
const target = ['es2022', 'chrome108', 'firefox108', 'safari15.4'];

const exists = (file) =>
  stat(file).then(
    () => true,
    () => false,
  );

const rel = (file) => path.relative(dist, path.join(root, file)).split(path.sep).join('/');

// Inline JSON must never be able to close its own <script> element.
const safeJson = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

async function buildWorker() {
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: { 'network-worker': 'src/workers/network.worker.js' },
    outdir: path.join(dist, 'assets'),
    entryNames: dev ? '[name]' : '[name]-[hash]',
    bundle: true,
    format: 'esm',
    target,
    minify: !dev,
    metafile: true,
    legalComments: 'none',
    define: env,
    logLevel: 'warning',
  });
  const file = Object.keys(result.metafile.outputs).find((name) => name.endsWith('.js'));
  return rel(file);
}

async function prerender(metafile) {
  const ssrFile = path.join(cacheDir, 'ssr.mjs');
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['src/entry-server.jsx'],
    outfile: ssrFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    jsx: 'automatic',
    define: env,
    loader: { '.css': 'empty', '.woff2': 'empty', '.woff': 'empty', '.glsl': 'empty' },
    logLevel: 'silent',
    // The 3D scene never renders on the server, so three.js stays out of the prerender.
    plugins: [
      {
        name: 'no-scene',
        setup(b) {
          b.onResolve({ filter: /\/scene\/Scene\.jsx$/ }, () => ({ path: 'scene', namespace: 'no-scene' }));
          b.onLoad({ filter: /.*/, namespace: 'no-scene' }, () => ({ contents: 'export const Scene = () => null;', loader: 'js' }));
        },
      },
    ],
  });
  const { renderApp, renderHead, earlyScript, site } = await import(`${pathToFileURL(ssrFile).href}?t=${Date.now()}`);

  const snapshot = JSON.parse(await readFile(path.join(root, 'data', 'snapshot.json'), 'utf8'));

  const outputs = Object.entries(metafile.outputs).map(([file, meta]) => ({ file: rel(file), meta }));
  const entry = outputs.find((o) => o.meta.entryPoint?.endsWith('src/main.jsx'));
  const css = outputs.find((o) => o.file.endsWith('.css'));
  // The stylesheet is small enough to inline, which removes a render-blocking request.
  // Its font URLs are relative to assets/, so they are rewritten for the page.
  const cssText = css
    ? (await readFile(path.join(dist, css.file), 'utf8')).replace(/url\((["']?)\.?\/?([^"')]+\.woff2?)\1\)/g, (_, quote, name) => `url(${quote}assets/${name}${quote})`)
    : '';
  // The display serif and the mono face are on screen from the first paint.
  const fonts = [/instrument-serif-latin-400-normal.*\.woff2$/, /ibm-plex-mono-latin-400-normal.*\.woff2$/]
    .map((pattern) => outputs.find((o) => pattern.test(o.file))?.file)
    .filter(Boolean);

  // A Content-Security-Policy as a meta tag, because static hosts such as GitHub Pages
  // cannot set headers. The one inline script is allowed by its hash, not by 'unsafe-inline'.
  const scriptHash = createHash('sha256').update(earlyScript).digest('base64');
  const csp = dev
    ? ''
    : [
        "default-src 'self'",
        `script-src 'self' 'sha256-${scriptHash}'`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self' https://api.github.com",
        "worker-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ].join('; ');

  const template = await readFile(path.join(root, 'index.html'), 'utf8');
  const reload = dev ? `<script>new EventSource('/esbuild').addEventListener('change',()=>location.reload())</script>` : '';
  const html = template
    .replace('<!--lang-->', site.language)
    .replace('<!--csp-->', () => (csp ? `<meta http-equiv="Content-Security-Policy" content="${csp}" />` : ''))
    .replace('<!--head-->', () => renderHead({ cssText, fonts, entry: entry?.file, snapshot }))
    .replace('<!--app-->', () => renderApp(snapshot))
    .replace(
      '<!--scripts-->',
      () => `<script id="snapshot" type="application/json">${safeJson(snapshot)}</script><script type="module" src="${entry.file}"></script>${reload}`,
    );

  await writeFile(path.join(dist, 'index.html'), html);

  const base = site.websiteUrl?.replace(/\/$/, '');
  await writeFile(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`);
  if (base) {
    await writeFile(
      path.join(dist, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc><lastmod>${snapshot.generatedAt.slice(0, 10)}</lastmod></url></urlset>\n`,
    );
  }
}

const prerenderPlugin = {
  name: 'prerender',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length || !result.metafile) return;
      const started = Date.now();
      try {
        await prerender(result.metafile);
        console.log(`prerendered in ${Date.now() - started}ms`);
      } catch (error) {
        console.error('prerender failed:', error);
        if (!dev) process.exitCode = 1;
      }
    });
  },
};

if (!(await exists(path.join(root, 'data', 'snapshot.json')))) {
  console.error('data/snapshot.json is missing. Run `npm run data` first.');
  process.exit(1);
}

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'assets'), { recursive: true });
await mkdir(path.join(dist, 'data'), { recursive: true });
await mkdir(cacheDir, { recursive: true });
if (await exists(path.join(root, 'public'))) await cp(path.join(root, 'public'), dist, { recursive: true });
// The geometry is only needed by the 3D scene, so it stays out of the HTML and loads with it.
await cp(path.join(root, 'data', 'geometry.json'), path.join(dist, 'data', 'geometry.json'));

const workerUrl = await buildWorker();

const options = {
  absWorkingDir: root,
  entryPoints: { main: 'src/main.jsx' },
  outdir: path.join(dist, 'assets'),
  entryNames: '[name]-[hash]',
  chunkNames: '[name]-[hash]',
  assetNames: '[name]-[hash]',
  bundle: true,
  splitting: true,
  format: 'esm',
  target,
  jsx: 'automatic',
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  metafile: true,
  legalComments: 'none',
  define: { ...env, 'process.env.WORKER_URL': JSON.stringify(workerUrl) },
  loader: { '.woff2': 'file', '.woff': 'file', '.glsl': 'text' },
  logLevel: 'info',
  plugins: [prerenderPlugin],
};

if (dev) {
  const context = await esbuild.context(options);
  await context.watch();
  const { port: bound } = await context.serve({ servedir: dist, port });
  console.log(`dev server: http://localhost:${bound}`);
} else {
  const result = await esbuild.build(options);
  const sizes = Object.entries(result.metafile.outputs)
    .filter(([file]) => /\.(js|css)$/.test(file))
    .map(([file, meta]) => `${path.basename(file).padEnd(40)} ${(meta.bytes / 1024).toFixed(1)} KB`);
  console.log(sizes.join('\n'));
  if (process.exitCode) process.exit(process.exitCode);
}
