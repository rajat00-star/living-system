import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fibreAlpha, fibreCircle, fibrePoint, project, rotate4 } from '../../src/lib/hopf.js';
import { signaturePoint, stageParam } from '../../src/lib/signatures.js';
import { normaliseText, verifyEntries } from '../evidence.mjs';
import { coreLayout, dendrite, networkLayout, solveSnake } from '../geometry.mjs';

// Replays a solved path and checks the rules the snake promises to keep.
function replay(result, cells, { strictOrder = true } = {}) {
  const { path, length, width, height, eats } = result;
  for (let i = 1; i < path.length; i += 1) {
    const [x0, y0] = path[i - 1];
    const [x1, y1] = path[i];
    assert.equal(Math.abs(x1 - x0) + Math.abs(y1 - y0), 1, `step ${i} is not one cell`);
    assert.ok(x1 >= -1 && x1 <= width && y1 >= -1 && y1 <= height, `step ${i} leaves the margin`);
    const body = path.slice(Math.max(0, i - length + 1), i).map((p) => p.join(','));
    assert.ok(!body.includes(path[i].join(',')), `step ${i} runs into its own body`);
  }
  assert.equal(eats.length, cells.length, 'every lit cell is eaten');
  for (const eat of eats) assert.deepEqual(path[eat.step], [eat.x, eat.y]);
  if (!strictOrder) return;
  const levels = eats.map((e) => e.level);
  assert.deepEqual(levels, [...levels].sort((a, b) => a - b), 'lightest cells first');
}

test('snake: eats every lit cell, lightest first, without ever crossing itself', () => {
  const cells = [
    { x: 0, y: 0, level: 4 },
    { x: 1, y: 0, level: 1 },
    { x: 1, y: 1, level: 2 },
    { x: 5, y: 6, level: 1 },
    { x: 52, y: 3, level: 3 },
    { x: 26, y: 3, level: 1 },
    { x: 27, y: 3, level: 1 },
    { x: 26, y: 4, level: 2 },
  ];
  replay(solveSnake(cells, 53, 7), cells);
});

// In a solid block, darker days wall lighter ones in, so the order may bend; nothing else may.
test('snake: a dense cluster still resolves, eating everything without crossing itself', () => {
  const cells = [];
  for (let x = 10; x < 16; x += 1) for (let y = 0; y < 7; y += 1) cells.push({ x, y, level: 1 + ((x + y) % 4) });
  replay(solveSnake(cells, 53, 7), cells, { strictOrder: false });
});

test('dendrite: one node per file and folder, a tree, unit radius, deterministic', () => {
  const paths = ['README.md', 'src/a.ts', 'src/b.ts', 'src/lib/c.ts', 'docs/d.md'];
  const d = dendrite(paths, 'repo');
  assert.equal(d.kinds.filter((k) => k === 1).length, 5);
  assert.equal(d.kinds.filter((k) => k === 0).length, 4); // root, src, src/lib, docs
  assert.equal(d.edges.length / 2, d.kinds.length - 1);
  const radius = Math.max(...Array.from({ length: d.kinds.length }, (_, i) => Math.hypot(d.positions[i * 3], d.positions[i * 3 + 1], d.positions[i * 3 + 2])));
  assert.ok(Math.abs(radius - 1) < 0.002);
  assert.deepEqual(dendrite(paths, 'repo'), d);
  assert.ok('src/lib' in d.dirs && 'docs' in d.dirs);
});

test('core: larger repositories on outer tori, one fibre per file', () => {
  const tori = coreLayout([
    { name: 'small', paths: ['a'] },
    { name: 'big', paths: ['a', 'b', 'c.md'] },
  ]);
  assert.deepEqual(tori.map((t) => t.repo), ['big', 'small']);
  assert.ok(tori[0].eta < tori[1].eta);
  // Paths in sorted order: 'a' and 'b' have no known type (3), 'c.md' is documentation (1).
  assert.equal(tori[0].classes, '331');
  assert.equal(tori[0].fibres, 3);
});

test('network layout is deterministic and bounded', () => {
  const graph = {
    nodes: [
      { id: 'react', class: 'framework' },
      { id: 'lang-python', class: 'language' },
    ],
    edges: [
      { repo: 'a', tech: 'react', weight: 1 },
      { repo: 'b', tech: 'lang-python', weight: 1 },
      { repo: 'a', tech: 'lang-python', weight: 0.5 },
    ],
  };
  const one = networkLayout(graph, ['a', 'b', 'lonely']);
  assert.deepEqual(networkLayout(graph, ['a', 'b', 'lonely']), one);
  for (const p of Object.values(one.positions)) assert.ok(Math.hypot(...p) <= 6.2 + 1e-6);
});

test('Hopf fibration: fibres lie on the 3-sphere, and map to one base point each', () => {
  const hopf = ([x, y, z, w]) => [2 * (x * z + y * w), 2 * (y * z - x * w), x * x + y * y - z * z - w * w];
  for (const [eta, alpha] of [
    [0.9, 0.3],
    [1.2, 2.5],
  ]) {
    const base = hopf(fibrePoint(eta, alpha, 0));
    for (let t = 0; t < 6.28; t += 0.7) {
      const p = fibrePoint(eta, alpha, t);
      assert.ok(Math.abs(Math.hypot(...p) - 1) < 1e-12);
      hopf(p).forEach((v, i) => assert.ok(Math.abs(v - base[i]) < 1e-12));
    }
  }
});

test('Hopf fibration: every projected fibre is an exact circle', () => {
  const eta = 0.95;
  const alpha = fibreAlpha(3, 10, 1);
  const { centre, radius } = fibreCircle(eta, alpha, 0.2, -0.14);
  for (let t = 0; t < 6.28; t += 0.5) {
    const p = project(rotate4(fibrePoint(eta, alpha, t), 0.2, -0.14));
    assert.ok(Math.abs(Math.hypot(p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]) - radius) < 1e-9);
  }
});

test('signature stage marks lie on their curves', () => {
  for (const kind of ['perimeter', 'trajectory', 'loop']) {
    const p = signaturePoint(kind, stageParam(2, 5), 5);
    assert.ok(p.every(Number.isFinite));
  }
  // A perimeter's stages sit exactly on its vertices.
  const [x, y] = signaturePoint('perimeter', stageParam(0, 5), 5);
  assert.ok(Math.abs(x) < 1e-12 && Math.abs(y + 1) < 1e-12);
});

test('evidence: quotes match through line breaks and emphasis, and nothing else', async () => {
  assert.equal(normaliseText('A **bold**\n  `claim`  here'), 'A bold claim here');
  const file = 'The core loop is **Understand → Plan**,\nand then some.';
  const result = await verifyEntries(
    {
      stages: { path: 'README.md', quote: 'The core loop is Understand → Plan', items: ['Understand', 'Plan'] },
      notes: [
        { title: 'kept', path: 'README.md', quote: 'and then some.' },
        { title: 'gone', path: 'README.md', quote: 'a sentence that is not there' },
        { title: 'missing file', path: 'NOPE.md', quote: 'anything' },
      ],
    },
    async (path) => (path === 'README.md' ? file : null),
    { blobUrl: (path) => `https://github.com/o/r/blob/sha/${path}` },
  );
  assert.ok(result.stages);
  assert.deepEqual(result.notes.map((n) => n.title), ['kept']);
  assert.deepEqual(result.dropped.map((d) => d.reason).sort(), ['file not found', 'quote no longer in the file']);
});
