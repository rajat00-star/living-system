# GitHub // The Living System

Rajat Sanger's public GitHub as one interactive computational organism: every file in every public repository folded
through four dimensions into a core, each repository grown into a specimen from its real directory tree, the
contribution calendar as a genome, the technologies as a nervous system, and the live API as vital signs.

**Live:** https://rajat00-star.github.io/living-system/ — the profile README at
[github.com/rajat00-star](https://github.com/rajat00-star) is drawn from the same pipeline.

The design reasoning, written before implementation, is in [docs/CONCEPT.md](docs/CONCEPT.md).

## Run it

Needs Node 20 or later.

```bash
npm install
```

```bash
npm run data
```

```bash
npm run dev
```

The dev server runs at http://localhost:5174. `npm run data` reads GitHub; it borrows `gh auth token` if the GitHub
CLI is signed in, and runs unauthenticated (60 requests an hour, no contribution attribution) if not.

| Command | What it does |
| --- | --- |
| `npm run data` | Reads the GitHub API, verifies the field notes and writes `data/` and the plates in `public/` |
| `npm run build` | Production build in `dist/` |
| `npm run preview` | Serves `dist/` at http://localhost:4174, gzipped as a static host would |
| `npm run check` | Builds, then fails on tokens, placeholders, broken references, private data or size over budget |
| `npm run test:unit` | Pipeline unit tests: parsers, calendar maths, the snake solver, the Hopf geometry |
| `npm run test:e2e` | Interaction, responsive, fallback and resilience suite in Chrome, with GitHub's API mocked |
| `npm run lighthouse` | Lighthouse on mobile and desktop. Run `npm run build` first |

## Edit what it shows

| To change | Edit |
| --- | --- |
| Account, display name, links, featured systems, sealed (private) specimens, hidden repositories | `content/config.mjs` |
| Architecture notes on the specimen plates (each one a verbatim quote, checked on every build) | `content/field-notes.mjs` |
| Which dependencies count as technologies | `pipeline/tech-catalog.mjs` |
| Colours | `src/lib/tokens.js` and `src/styles/base.css` |

A featured repository that does not exist yet (Sentinel, today) is left out and reported by the pipeline; it joins
the next build after it is published. A private one appears only as a sealed specimen with the text in `config.mjs`.

## How it works

- **Data.** `pipeline/run.mjs` reads GitHub's REST and GraphQL APIs, validates everything with zod, refuses private
  repositories, and writes `data/snapshot.json` (inlined into the page) and `data/geometry.json` (loaded with the 3D
  scene). Requests use ETags, so an unchanged resource costs no quota, and back off on rate limits. If anything fails,
  the last good snapshot stays. The contribution calendar is read exactly as a signed-out visitor sees it.
- **Evidence.** Every field note quotes its repository. The pipeline fetches the cited file at the commit being
  published and drops any note whose quote is gone, so the site cannot claim what a repository no longer says.
- **No tokens in the browser.** In CI the only credential is the token GitHub issues to each workflow run. The browser
  makes three unauthenticated reads for live counts, cached for ten minutes; `npm run check` fails if anything
  token-shaped reaches `dist/`. A Content-Security-Policy allows scripts from this site only.
- **Prerendered.** `scripts/build.mjs` (the portfolio's build pattern) renders the whole document to static HTML. It
  reads completely without JavaScript and without WebGL, with still plates drawn by the same code as the README images.
- **3D.** React Three Fiber and three.js, loaded as a separate chunk after first paint. The Core is a Hopf fibration
  computed in a vertex shader; the genome is one instanced mesh placed twice on the GPU (helix and terrain); the network
  re-settles in a Web Worker when a node is dragged. Quality steps down from measured frame times.
- **Scrolling is native.** Pinned stages use `position: sticky`; scroll position drives the camera and the morphs.
- **Motion and sound.** Motion follows `prefers-reduced-motion` and the header switch. Sound is synthesised with the
  Web Audio API, off at the start of every visit, and the audio engine is created only after a click.

## Deploy

Push to a public repository named `living-system` and set **Settings → Pages → Source** to **GitHub Actions**.
`.github/workflows/deploy.yml` builds and publishes on every push and every six hours. If the address changes, update
`websiteUrl` in `content/config.mjs` and the image URLs in the profile README.

## Credits

Type: Instrument Serif and IBM Plex Mono, under the SIL Open Font License. Rendering: three.js, React Three Fiber
and postprocessing, under the MIT License. The README snake is drawn by [Platane/snk](https://github.com/Platane/snk).
