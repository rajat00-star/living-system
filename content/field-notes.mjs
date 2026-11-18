// Architecture notes for the specimen plates.
//
// Every entry quotes its repository word for word. On each build the pipeline fetches the
// cited file at the current commit and drops any entry whose quote is no longer there, so the
// site can never claim something the repository has stopped saying. Matching ignores line
// breaks, repeated spaces, Markdown emphasis and backticks, and nothing else.
//
// - stages: the system's own pipeline, used for the specimen's signature geometry.
// - layers: what a folder or layer does; `dir` links it to a branch of the 3D dendrite.
// - notes: design decisions and stated limits, each with a short title in my words.

export const fieldNotes = {
  OmniPilot: {
    stages: {
      path: 'README.md',
      quote: 'The core loop is **Understand → Plan → Execute → Observe → Verify → Deliver**',
      items: ['Understand', 'Plan', 'Execute', 'Observe', 'Verify', 'Deliver'],
    },
    layers: [
      { dir: 'server', name: 'server/', path: 'README.md', quote: 'server/            Express + TypeScript backend' },
      { dir: 'server/core', name: 'server/core/', path: 'README.md', quote: 'core/            engine, planner, state machine, extraction, analysis, artifacts, verifier, store, vision (screenshot reading)' },
      { dir: 'server/tools', name: 'server/tools/', path: 'README.md', quote: 'tools/           registered tool allowlist (browser.*, research.collect, analysis.compare, artifact.*, verifier.check, report.finalize)' },
      { dir: 'server/browser', name: 'server/browser/', path: 'README.md', quote: 'browser/         Playwright lifecycle, navigation, extraction script, offline render' },
      { dir: 'server/security', name: 'server/security/', path: 'README.md', quote: 'security/        URL/redirect policy, artifact path confinement' },
      { dir: 'server/llm', name: 'server/llm/', path: 'README.md', quote: 'llm/             Claude client, structured outputs, untrusted-content wrapping' },
      { dir: 'web', name: 'web/', path: 'README.md', quote: 'web/               React + Vite UI: workspace, Judge Mode and dashboard' },
      { dir: 'tests', name: 'tests/', path: 'README.md', quote: 'tests/             Vitest unit + integration tests, Playwright UI end-to-end script' },
    ],
    notes: [
      { title: 'Intent in', path: 'README.md', quote: 'You describe an outcome in plain language.' },
      { title: 'Approval gate', path: 'README.md', quote: 'Nothing runs before approval.' },
      { title: 'Independent verification', path: 'README.md', quote: 'It then independently verifies every file and every quoted fact before it reports back.' },
      { title: 'Cited reasoning', path: 'README.md', quote: 'Every claim must cite observation ids that exist; uncited claims are discarded and counted.' },
      { title: 'No invented zeros', path: 'README.md', quote: 'Missing prices are reported as "Not found", never as zero.' },
      { title: 'Stated limit', path: 'README.md', quote: 'Verification proves file integrity and that quotes match the stored pages. It does not prove that vendor claims are true or current.' },
    ],
  },

  SafeCircle: {
    stages: {
      path: 'README.md',
      quote: 'Approach → Pressure → Harvest → Control → Extraction',
      items: ['Approach', 'Pressure', 'Harvest', 'Control', 'Extraction'],
    },
    layers: [
      { dir: 'backend', name: 'backend/', path: 'README.md', quote: 'backend/        FastAPI app, detector, models, Alembic migrations, tests' },
      { dir: 'frontend', name: 'frontend/', path: 'README.md', quote: 'frontend/       Next.js 15 + TypeScript dashboard (static export served by the API)' },
      { dir: 'extension', name: 'extension/', path: 'README.md', quote: 'extension/      Chrome/Edge Manifest V3 extension' },
      { dir: 'evaluation', name: 'evaluation/', path: 'README.md', quote: 'evaluation/     training + evaluation scripts, datasets, results' },
      { dir: 'e2e', name: 'e2e/', path: 'README.md', quote: 'e2e/            Playwright end-to-end and extension tests' },
      { dir: 'presentation', name: 'presentation/', path: 'README.md', quote: 'presentation/   PS02 pitch deck (.pptx, 10 slides + appendix) and the interactive 3D architecture site' },
    ],
    notes: [
      { title: 'A case, not a message', path: 'README.md', quote: 'Add messages, call notes, links and screenshots as they arrive; each one re-evaluates the case.' },
      { title: 'Local OCR', path: 'README.md', quote: 'a screenshot read **locally with Tesseract** (image never stored)' },
      { title: 'Payments untouched', path: 'README.md', quote: 'It never sees, blocks or approves a real payment, and it consults no bank or NPCI data.' },
      { title: 'Alert discipline', path: 'README.md', quote: 'unchanged evidence is suppressed; alerts fire only when risk rises or a new high-weight tactic appears' },
      { title: 'No paid model', path: 'README.md', quote: 'No paid API, API key or external model is needed.' },
      { title: 'Measured, with its caveat', path: 'README.md', quote: 'precision 0.885 (23/26), recall 0.958 (23/24), false-positive rate 0.111 (3/27); keyword baseline 0.826 / 0.792 / 0.148. Synthetic results do not show real-world accuracy.' },
      { title: 'Stated limit', path: 'README.md', quote: 'Risk scores are heuristic indicators from transparent rules, not calibrated probabilities of fraud.' },
    ],
  },

  pramaan: {
    stages: {
      path: 'README.md',
      quote: 'Product photo → preprocessing → label region → multilingual OCR → field extraction → deterministic rule engine (versioned rule pack) → verdict → evidence + legal clause → confidence gate → human review → audit trail',
      items: ['Photo', 'Preprocessing', 'Label region', 'OCR', 'Extraction', 'Rule engine', 'Verdict', 'Evidence', 'Confidence gate', 'Human review', 'Audit trail'],
    },
    layers: [
      { name: 'API', path: 'README.md', quote: 'FastAPI, JWT auth, role-based authorization on every protected route' },
      { name: 'Pipeline', path: 'README.md', quote: 'Preprocessing (OpenCV) → label detection (honest full-image fallback) → OCR (real Tesseract) → extraction (regex, English + Hindi keywords) → rule engine → verdict' },
      { dir: 'frontend/mobile', name: 'Mobile app', path: 'README.md', quote: 'React Native + Expo + TypeScript, one app for both Citizen and Inspector roles' },
      { name: 'Data', path: 'README.md', quote: 'SQLAlchemy ORM; SQLite for local dev, PostgreSQL verified for production' },
    ],
    notes: [
      { title: 'The central principle', path: 'README.md', quote: 'AI/CV does observation ("what text appears to be on this label?"); it never decides law.' },
      { title: 'No LLM in the verdict', path: 'README.md', quote: 'No LLM is anywhere in that decision path' },
      { title: 'Law as data', path: 'README.md', quote: 'Every legal number (tolerance percentages, band thresholds) is **data** in `rule_pack_v1.json`, not a Python constant.' },
      { title: 'Replayable verdicts', path: 'README.md', quote: 'Every scan stores `rule_pack_version` + a SHA-256 `rule_pack_hash` of the exact file bytes used.' },
      { title: 'Uncertainty goes to a person', path: 'README.md', quote: 'a field below `CONFIDENCE_THRESHOLD` (default 60%) or not found at all becomes `REVIEW`, never a silently-invented PASS/FAIL.' },
      { title: 'Tests', path: 'README.md', quote: '117 tests, 117 passing, 1 intentionally skipped' },
      { title: 'Stated limit', path: 'README.md', quote: 'OCR-level determinism is NOT guaranteed across different Tesseract builds' },
    ],
  },

  CodeForge: {
    stages: {
      path: 'README.md',
      quote: "it analyzes the codebase, plans a fix, edits files through an audited tool layer, runs the repository's real test suite, diagnoses failures, repairs its own implementation across bounded retries, and reports a real diff",
      items: ['Analyze', 'Plan', 'Edit', 'Test', 'Diagnose', 'Repair', 'Report'],
    },
    layers: [],
    notes: [
      { title: 'Core principle', path: 'README.md', quote: "never simulate an operation that didn't actually happen." },
      { title: 'Sandbox', path: 'README.md', quote: 'non-root, no network, read-only root filesystem, resource limits, dropped capabilities' },
      { title: 'No guessed costs', path: 'README.md', quote: 'an unpriced model reports `null`, never a guessed cost' },
    ],
  },
};
