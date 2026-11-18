# GITHUB // THE LIVING SYSTEM — concept, architecture and interaction model

Written before implementation, as the brief asks. Nothing here is built yet. Every number below was read from
the GitHub API or the public contribution calendar on **2026-11-18** and will be re-read by the data pipeline on
every build, never typed by hand.

---

## 1. What I studied

### The portfolio

| Trait | What it is today |
| --- | --- |
| Subject | Rajat himself: a relit black-and-white portrait in front of an oversized name |
| Material | **Fire.** The portrait burns into embers along a noise front on scroll (hand-written WebGL2) |
| Signature effect | A swarm of labelled cursors that rebuilds the page, Figma-style |
| Type | Anton (heavy condensed poster), Manrope (body), Caveat (handwriting: "Hello, I'm") |
| Colour | Warm black `#090909`, warm white `#f2efeb`, **red `#e32b3c` dominant**, cyan `#2fc7ff` as rim light |
| Rule | "Red means signal, blue means system" |
| Sound | Web Audio, synthesised, off by default: pentatonic mallet, key clicks, whoosh, crackle |
| Stack | React 19, esbuild with a custom build and **static prerender**, vanilla CSS, Motion, Playwright e2e, Lighthouse, a `check` script |
| Ethos | Every claim carries a `verifiedOn` date and traces to the repository's own docs. "Evidence over assertion." |

### Your GitHub (`rajat00-star`), as the public sees it

| Fact | Value |
| --- | --- |
| Account created | 2026-08-06 (104 days ago) |
| Public repositories | 7: OmniPilot, SafeCircle, pramaan, CodeForge, Hand-Tracking-Using-OpenCV, Leetcode, rajat00-star |
| Files in public repositories | 1,085 (353 OmniPilot, 333 SafeCircle, 224 CodeForge, 155 pramaan, 15 profile, 3 Hand-Tracking, 2 Leetcode) |
| Source measured by GitHub | 2,641,407 bytes in 10 languages (Python 1,070,545 · TypeScript 1,049,205 · JavaScript 289,342 · CSS 174,704 · HTML 44,412 · C++ 4,804 · Dockerfile 4,560 · Makefile 1,977 · Mako 1,408 · Shell 450) |
| Contributions, last year | 29 on 13 days. First 2026-08-06, busiest 2026-08-26 (9), longest streak 3 days (15–17 Aug) |
| Stars / forks / followers | 0 / 0 / 2 |
| Existing profile README | Space-mission theme in violet, cyan, green, amber and pink; two external image services; **two broken placeholder links** (`YOUR-LINKEDIN-USERNAME`, `YOUR-LEETCODE-USERNAME`); a working daily snake workflow (`Platane/snk@v3` → `output` branch) |

**Three facts that shape the design:**

1. **Ultramatrix is a private repository.** Its metadata cannot be shown without publishing private data.
2. **There is no repository called Sentinel** on your account, public or private, and the portfolio never mentions it.
3. **The history is young and sparse** (29 contributions). The design has to make honest sparse data beautiful, not inflate it.
   The six private contributions already appear on your public graph only as anonymous counts; the pipeline reads the
   public calendar, so it can never show more than visitors already see.

---

## 2. The concept

> **A specimen atlas of a young software organism.**
> Your public GitHub, rendered as one living computational system: every file you have published folded through four
> dimensions into a core; each repository a specimen whose shape is grown from its real directory tree; your
> contribution history as a genome; your technologies as a nervous system; the live API as vital signs.
> The system is 104 days old. **Its geometry is a function of the data, so it becomes more complex as the work grows.**

### Why it is a different visual language from the portfolio

| | Portfolio | The Living System |
| --- | --- | --- |
| Subject | The person | The work. No portrait, no name as poster type |
| Material | Fire, embers, photograph | Light, filament, topology |
| Composition | Poster hero | Numbered specimen plates: `FIG. 01`, legends, scale bars, coordinates, leader lines |
| Type | Anton + Manrope + Caveat | **Instrument Serif** (editorial display, italic for emphasis) + **IBM Plex Mono** (every measurement and label). No handwriting |
| Colour | Red dominant on warm black | Cold black `#030405`, bone white `#e9eef1`, **cyan `#6fe3ff` for structure**, **red `#ff3b4e` only for live signals and selection** |
| Motion | Burn, swarm | Continuous 4D rotation, flow along fibres, morphs between projections of the same data |
| Sound | Mallet, clicks, crackle | Sine and FM glass: a near-silent drone, pings tuned by category, a fifth on selection |

The two share one idea on purpose — red is signal, cyan is system — but invert the dominance.

---

## 3. The experience: five figures on one continuous scroll

One fixed WebGL canvas sits behind a prerendered HTML document. Each figure is a pinned section on native scroll
(`position: sticky`, as in the portfolio). Scroll progress drives the camera and the geometry; nothing hijacks the wheel.

### `00` Handshake (under a second)
Real request lines as the snapshot loads: `GET /users/rajat00-star 200`, snapshot time, `fold S³ → R³`. Skipped
instantly with reduced motion. Nothing on this screen is decorative fiction.

### `FIG. 01` The Core — central computational structure
- **Geometry:** a Hopf fibration. Each of the 1,085 files becomes one great circle of the 3-sphere, projected
  stereographically into 3D. Files of the same repository share one torus, so **seven nested tori are the seven repositories**,
  each woven from its own files (353 fibres for OmniPilot, 2 for Leetcode). Fibres sorted by path, so folders cluster.
- **Evolves continuously:** a slow rotation in four dimensions makes the tori breathe and turn through each other; particles
  stream along every fibre.
- **Mouse:** the pointer tilts the 4D rotation itself, not just the camera, so the whole structure re-folds under your hand.
- **Rendering:** positions are computed analytically in the vertex shader from `(torus, fibre, t)`; no CPU work per frame.
  Additive points plus a hairline pass, bloom and a little grain.
- **Overlay:** "The Living System" in serif; mono readout of repositories, files, bytes, languages and age.

### `FIG. 02` Specimens — repository constellation
- **Transition:** the tori un-nest. Each flies outward to its orbit and grows into its repository's specimen: the Core
  literally separates into the systems it is made of.
- **Distinct geometry, from data:** each specimen is a dendrite grown from the repository's real directory tree
  (folders branch, files are terminal points), so no two can look alike. Each also carries a signature taken from what its
  README says it does:
  - **OmniPilot** — a flight path through checkpoints: plan → execute → observe → verify
  - **SafeCircle Guardian** — a faceted perimeter shell; red intercepts travel the attack chain
  - **PraMaan** — a rigid lattice (the deterministic rule engine) with evidence boxes
  - **Ultramatrix** — a sealed, unlit monolith labelled *Private repository* (see decisions)
  - CodeForge, Hand-Tracking, Leetcode and the profile repo orbit further out as minor specimens
- **Interaction:** hover shows a leader-line label. Click, tap or Enter flies the camera in and opens a **specimen plate**:
  description, licence, default branch, created and last-push dates, commit count, a byte-exact language bar,
  morphology (files, folders, depth, top-level folders), dependencies read from its manifests, and **field notes on its
  architecture where every sentence cites a file in the repository**. ←/→ moves between specimens, Esc returns.

### `FIG. 03` Contribution Genome
- **Real calendar, three projections of the same instanced voxels, morphing on scroll:**
  1. *Genome* — days wound into a helix, one turn per week; active days extend as lit base pairs
  2. *Terrain* — the familiar 53 × 7 grid as a voxel heightfield
  3. *Flow* — each contribution leaves its day as a particle and travels to the repository it went to
     (from GraphQL `commitContributionsByRepository`)
- Honest annotations: 29 contributions, 13 active days, 104 days since genesis, longest streak 3.
- **Snake protocol:** an original snake solver runs on the real grid: it eats every lit cell in order of level using
  breadth-first pathfinding, without hitting itself, and each voxel collapses as it is eaten. Play, pause, replay.
  The README keeps the separate `Platane/snk` snake.

### `FIG. 04` Nervous System — technology network
- **Nodes:** ~35 technologies, each one evidenced by a file: languages from GitHub's byte counts; frameworks and
  infrastructure from `package.json`, `requirements*.txt`, `pyproject.toml`, `Dockerfile`, compose files, workflow files
  and `manifest.json`. Already found: React, Next.js, Vite, Express, FastAPI, SQLAlchemy, Alembic, Pydantic, Playwright,
  Zod, Three.js, React Native/Expo, Tailwind, Monaco, the Anthropic SDK, scikit-learn, NumPy/SciPy, OpenCV, Tesseract,
  Docker, PostgreSQL, Redis, GitHub Actions, Chrome MV3, Vitest, Pytest, Jest.
- **Four classes, each a glyph:** language, framework, infrastructure, AI/ML.
- **Edges:** repository → technology, weighted by bytes or dependency use. Hover a technology to light its repositories
  and its evidence file; drag nodes and the 3D force layout re-settles in a **Web Worker**.

### `FIG. 05` Vital Signs — live engineering intelligence
- Public repositories, stars, forks, followers, open issues, contributions, languages, latest pushes and repository
  updates, with the data's age always on screen: *snapshot 06:00 UTC · live 2 min ago*.
- The camera pulls back to the whole system at once: core, specimens, genome and network in one frame.
- Ends on links: GitHub, LinkedIn, portfolio (when it has a URL).

---

## 4. Interaction model

| Input | What it does |
| --- | --- |
| Scroll | Moves through figures; drives camera path and morphs. Native, never hijacked |
| Pointer move | Re-folds the Core in 4D; small camera parallax; hover labels |
| Click / tap | Selects a specimen, a day or a technology; flies the camera; opens its plate |
| Drag | Rotates the Core in 4D; moves network nodes |
| Keyboard | Tab through a visible index that mirrors every 3D object · ←/→ specimens · Enter open · Esc close · 1–5 figures · M sound |
| Sound toggle | Off by default; audio engine created only after a click; choice remembered |
| Motion toggle | Starts from `prefers-reduced-motion`: no camera flights, no flow, cross-fades instead of morphs |
| Mobile | Same figures, single column, bottom-sheet plates, tap to select, drag to rotate, lower particle budget |

Every 3D object has an HTML twin (a button in the index, a row in a table), so screen readers and keyboard users get the
same information, and the 3D layer is never the only way to reach anything.

---

## 5. Architecture

### Two connected deliverables

```text
rajat00-star/living-system  (new, public)          rajat00-star/rajat00-star  (your profile, updated)
├─ pipeline/   GitHub API → validated snapshot     ├─ README.md       new identity, links to the system
├─ content/    field notes, each claim cited       └─ .github/workflows/snake.yml   restyled palette
├─ src/        React 19 + React Three Fiber
├─ scripts/    esbuild build + prerender (as portfolio)        README images are served by the
├─ data/       last good snapshot (committed)                   Living System itself (/readme/*.svg),
└─ .github/workflows/deploy.yml                                  drawn by the same renderers
      every 6 h + on push: pipeline → build → GitHub Pages      → one pipeline, one identity
```

### Stack

Mirrors the portfolio so it feels like your codebase: **React 19, esbuild with a custom build and static prerender,
vanilla CSS, self-hosted `@fontsource` fonts, Playwright, Lighthouse, a `check` script.** Added for 3D:
**three 0.187, @react-three/fiber 9.8, @react-three/postprocessing 3.2**, raw GLSL shaders, instanced meshes,
`d3-force-3d` inside a worker. Current versions confirmed on npm today.

### Data pipeline and security

```text
GitHub REST + GraphQL ──► fetch (ETag cache, backoff) ──► validate (zod) ──► derive ──► evidence check ──► snapshot.json
        ▲                                                                                        │
  GITHUB_TOKEN of the                                                         site bundle + README SVGs +
  Actions run only                                                            no-WebGL fallback SVGs
```

- **No token ever reaches the browser.** The pipeline runs in GitHub Actions with the built-in `GITHUB_TOKEN`
  (no personal access token is created or stored anywhere). Locally it borrows `gh auth token` through an environment
  variable that is never written to disk. A check fails the build if any token pattern appears in `dist/`.
- **Rate limits:** conditional requests with ETags (a 304 costs nothing), a quota check before starting, exponential
  backoff that honours `retry-after` and `x-ratelimit-reset`, and if anything fails the **last good snapshot ships**,
  never an empty page.
- **Validation:** every field schema-checked; repositories asserted `private === false` before inclusion, so
  a private repository can never leak even if a token could see it.
- **Evidence check:** each field note stores `{ repo, path, quote }`. The pipeline fetches the file at the current commit
  and fails if the quote is no longer there. The site can't claim what the repository no longer says.
- **Live layer in the browser:** two unauthenticated GETs (`/users/rajat00-star`, `/users/rajat00-star/events/public`),
  cached with ETags for 10 minutes, silent fallback to the snapshot on 403/429.
- **CSP:** `script-src 'self'`, `connect-src 'self' https://api.github.com`, fonts self-hosted, no third-party scripts.

### Rendering and performance

- **Paint first, 3D second.** The prerendered HTML is the complete page; the 3D chunk loads after first paint and fades in.
- One renderer, one scene; objects outside the current figure are culled; geometry built once, animated in shaders.
- **Adaptive quality** from measured frame time: device pixel ratio, particles per fibre, bloom and specimen detail
  step down on slower devices and back up when there is headroom.
- Heavy layout (dendrites, initial network positions, snake path) computed at **build time** and baked into the
  snapshot: zero runtime cost. The worker only runs when you drag the network.
- Budgets enforced by `check`: initial JS ≤ 90 KB gzip; 3D chunk ≤ 320 KB gzip; Lighthouse mobile performance ≥ 90.

### Fallback

No WebGL, a lost context, or 3D switched off: the same document shows **static SVG plates drawn by the same
renderers** — the Core projected to 2D, each specimen's dendrite, the calendar grid, the technology list. Everything stays
readable and navigable. The SVGs are not presented as interactive.

---

## 6. The new profile README

- **Header plate:** the Core flattened to an animated SVG, captioned as an image: *"A drawing of the Core. The interactive
  system is here →"* with the link outside the image.
- **Vital signs plate** generated from the snapshot (repositories, files, bytes, languages, contributions, stars, forks).
- **Specimen cards** for each featured repository, each showing its real dendrite, linked to the repository.
- **Contribution genome:** the existing `Platane/snk` workflow, restyled to the cyan and red palette, dark and light variants.
- **Technology plate**, then links: the Living System, LinkedIn (`rajatsanger`, from the portfolio), email.
- Every image has alt text with the actual numbers. The two external services and the broken placeholder links go away.
- The current README stays in git history.

---

## 7. Decisions — defaults I'll use unless you say otherwise

| Question | Default |
| --- | --- |
| **Sentinel** has no repository | Left out. It joins automatically the moment `rajat00-star/sentinel` (or a name you give) exists publicly |
| **Ultramatrix** is private | Shown as a sealed specimen labelled *Private repository*, with only the summary your portfolio already publishes. No private metadata read. If you make it public it becomes a full specimen with no code changes |
| Existing README | Replaced (kept in git history) |
| Hosting | GitHub Pages: `https://rajat00-star.github.io/living-system/` |
| Fonts | Instrument Serif + IBM Plex Mono, self-hosted, both SIL Open Font License |

## 8. Build plan

1. Scaffold with the portfolio's build pattern; tokens, fonts, document shell
2. Data pipeline against the real API; snapshot; cited field notes with evidence checks
3. Prerendered document and the shared SVG renderers (fallback + README)
4. Scene foundation: canvas, scroll timeline, camera rig, adaptive quality, post-processing
5. FIG. 01 Core · FIG. 02 Specimens and plates · FIG. 03 Genome and snake · FIG. 04 Network and worker · FIG. 05 Vital signs
6. Sound, keyboard, reduced motion, mobile
7. README, restyled snake, deploy workflow
8. Validation: real-data audit, e2e on desktop, mobile, reduced motion and no-WebGL, Lighthouse, token scan, visual review

**Publishing is the last step and only with your go-ahead:** creating `living-system`, enabling Pages, and pushing the
new README are public actions, so I'll ask before each.

---

## 9. As built (2026-11-18)

What changed between this plan and the build, and why:

| Plan | Built | Why |
| --- | --- | --- |
| Terrain as a flat 53-week grid | Weeks recede into the distance, today nearest | A flat year is too wide to sit between the text columns; the recession also puts the living weeks up front |
| Helix of the whole year | Newest day at the top, the year's days below, two backbone strands | The account's whole life is the last 105 days; the camera frames them and the strands make the double helix legible |
| WebGL probed before first paint | API presence checked before paint; a context that fails later falls back to still plates | Creating a context to test it blocked the first paint for 700 ms on a throttled phone |
| 3D loads after first paint everywhere | On touch devices it loads on the first scroll or touch | The still plate is already on screen; phones spend nothing on 3D until the reader engages |
| Snake eats strictly lightest first | Lightest first unless a darker day walls the way; never across its own body | A dense calendar can wall a light day in; the page states the rule it actually keeps |
| Signatures for three specimens | Four: CodeForge got its edit–test–repair loop | Its README describes a bounded repair loop worth drawing |

Measured on the production build:

- Lighthouse mobile: performance 98, accessibility 100, best practices 100, SEO 100 (total blocking time 0 ms)
- Lighthouse desktop: 100, 100, 100, 100
- Initial JavaScript 84.6 KB gzipped; 3D chunk 301.5 KB; worker 8.6 KB; the page with its data 33.9 KB
- 22 unit tests and 23 end-to-end tests pass, the latter in real Chrome with GitHub's API mocked
- Every displayed commit count, file count and byte count re-derived independently from the GitHub API: all match
