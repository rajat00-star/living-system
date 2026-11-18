// Geometry computed at build time from the data, so the browser does no layout work on
// load. Every function here is deterministic: the same repositories give the same shapes.
import { forceCenter, forceLink, forceManyBody, forceSimulation, forceX, forceY, forceZ } from 'd3-force-3d';
import { fileClass } from './derive.mjs';

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const r3 = (value) => Math.round(value * 1000) / 1000;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Vectors

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// The i-th of n directions on a spherical cap of half-angle `spread` around `axis`,
// laid out on a Fibonacci spiral so siblings never bunch together.
function capDirection(axis, i, n, spread, twist) {
  const cosMin = Math.cos(spread);
  const z = 1 - (1 - cosMin) * ((i + 0.5) / n);
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  const phi = i * GOLDEN + twist;
  const local = [r * Math.cos(phi), r * Math.sin(phi), z];
  const helper = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(helper, axis));
  const v = cross(axis, u);
  return norm(add(add(scale(u, local[0]), scale(v, local[1])), scale(axis, local[2])));
}

// ---------------------------------------------------------------------------
// Dendrites: a repository's real directory tree, grown as a 3D organism.
// Folders branch; files are terminal points. Longer branches carry more files.

export function dendrite(paths, seed) {
  const root = { path: '', children: new Map(), files: [], weight: 0 };
  for (const file of [...paths].sort()) {
    const parts = file.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (!node.children.has(parts[i])) node.children.set(parts[i], { path: parts.slice(0, i + 1).join('/'), children: new Map(), files: [], weight: 0 });
      node = node.children.get(parts[i]);
    }
    node.files.push(file);
  }
  const weigh = (node) => (node.weight = node.files.length + [...node.children.values()].reduce((sum, child) => sum + weigh(child), 0));
  weigh(root);
  const total = Math.max(2, root.weight);
  const random = mulberry32(hashString(seed));

  const positions = [];
  const kinds = [];
  const depths = [];
  const classes = [];
  const edges = [];
  const dirs = {};

  const push = (p, kind, depth, cls) => {
    positions.push(p);
    kinds.push(kind);
    depths.push(depth);
    classes.push(cls);
    return positions.length - 1;
  };

  function grow(node, at, axis, depth, parent, spread) {
    const index = push(at, 0, depth, -1);
    if (parent >= 0) edges.push(parent, index);
    if (node.path && depth <= 3) dirs[node.path] = index;
    const children = [...node.children.values()].sort((a, b) => b.weight - a.weight || a.path.localeCompare(b.path));
    const items = [...children.map((child) => ({ dir: child })), ...node.files.map((file) => ({ file }))];
    const twist = random() * Math.PI * 2;
    items.forEach((item, i) => {
      const direction = depth === 0 ? capDirection([0, 1, 0], i, items.length, Math.PI, twist) : capDirection(axis, i, items.length, spread, twist);
      if (item.dir) {
        const reach = 0.5 * 0.8 ** depth * (0.55 + 0.45 * (Math.log1p(item.dir.weight) / Math.log1p(total)));
        grow(item.dir, add(at, scale(direction, reach)), direction, depth + 1, index, Math.max(0.42, spread * 0.78));
      } else {
        const leaf = push(add(at, scale(direction, 0.13 * 0.86 ** depth)), 1, depth + 1, fileClass(item.file));
        edges.push(index, leaf);
      }
    });
  }
  grow(root, [0, 0, 0], [0, 1, 0], 0, -1, Math.PI);

  // Normalise to a unit radius so every specimen can be scaled by its own size.
  const radius = Math.max(...positions.map((p) => Math.hypot(p[0], p[1], p[2]))) || 1;
  return {
    positions: positions.flatMap((p) => p.map((v) => r3(v / radius))),
    kinds,
    depths,
    classes,
    edges,
    dirs,
    maxDepth: Math.max(...depths),
  };
}

// ---------------------------------------------------------------------------
// The technology network, settled once here so it appears in place on first paint.
// The browser's worker re-runs the same forces only when someone drags a node.

export function networkLayout(graph, repoNames) {
  const nodes = [
    ...repoNames.map((name) => ({ id: `repo:${name}`, kind: 'repo' })),
    ...graph.nodes.map((node) => ({ id: node.id, kind: 'tech' })),
  ];
  const links = graph.edges.map((edge) => ({ source: `repo:${edge.repo}`, target: edge.tech, weight: edge.weight }));
  const simulation = forceSimulation(nodes, 3);
  if (typeof simulation.randomSource === 'function') simulation.randomSource(mulberry32(42));
  simulation
    .force('link', forceLink(links).id((d) => d.id).distance(1.5).strength(0.55))
    .force('charge', forceManyBody().strength((d) => (d.kind === 'repo' ? -34 : -9)))
    .force('center', forceCenter(0, 0, 0))
    // A weak pull to the middle keeps a repository with no detected technology from drifting off.
    .force('x', forceX(0).strength(0.04))
    .force('y', forceY(0).strength(0.04))
    .force('z', forceZ(0).strength(0.04))
    .stop();
  for (let i = 0; i < 500; i += 1) simulation.tick();
  // Scaled by a robust radius (85th percentile), so one isolated node cannot squash the rest;
  // the few beyond are drawn in to the rim.
  const radii = nodes.map((n) => Math.hypot(n.x, n.y, n.z)).sort((a, b) => a - b);
  const k = 4.6 / (radii[Math.floor(radii.length * 0.85)] || 1);
  const positions = Object.fromEntries(
    nodes.map((n) => {
      let p = [n.x * k, n.y * k, n.z * k];
      const r = Math.hypot(...p);
      if (r > 6.2) p = p.map((v) => (v * 6.2) / r);
      return [n.id, p.map(r3)];
    }),
  );
  return { positions, scale: r3(k) };
}

// ---------------------------------------------------------------------------
// The snake: eats every lit day of the real calendar, lightest first, by breadth-first
// search that knows when each body segment will have moved out of the way.

export function solveSnake(cells, width, height, { length = 4 } = {}) {
  // cells: [{ x, y, level }] with level > 0. The grid gets a one-cell margin all round.
  const minX = -1;
  const maxX = width;
  const minY = -1;
  const maxY = height;
  const inside = (x, y) => x >= minX && x <= maxX && y >= minY && y <= maxY;
  const key = (x, y) => `${x},${y}`;

  let body = Array.from({ length }, (_, i) => [-1 - i, -1]); // head first, waiting above-left of the grid
  const path = [body[0]];
  const eats = [];
  const remaining = new Map(cells.map((cell) => [key(cell.x, cell.y), cell]));

  const step = (next) => {
    body = [next, ...body.slice(0, -1)];
    path.push(next);
    const cell = remaining.get(key(next[0], next[1]));
    if (cell) {
      eats.push({ step: path.length - 1, x: cell.x, y: cell.y, level: cell.level });
      remaining.delete(key(cell.x, cell.y));
    }
  };

  // Shortest route from the head to any cell in `targets`, avoiding the body unless a
  // segment will already have moved on by the time the head arrives, and avoiding the
  // darker cells still waiting their turn (`avoid`), so the order stays lightest first.
  function route(targets, avoid = new Set()) {
    const occupied = new Map(body.map((segment, index) => [key(segment[0], segment[1]), index]));
    const start = body[0];
    const previous = new Map([[key(start[0], start[1]), null]]);
    let frontier = [start];
    let distance = 0;
    while (frontier.length) {
      distance += 1;
      const next = [];
      for (const [x, y] of frontier) {
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          const k = key(nx, ny);
          if (!inside(nx, ny) || previous.has(k)) continue;
          const segment = occupied.get(k);
          if (segment !== undefined && distance < length - segment) continue;
          if (avoid.has(k) && !targets.has(k)) continue;
          previous.set(k, key(x, y));
          if (targets.has(k)) {
            const out = [];
            for (let at = k; at && at !== key(start[0], start[1]); at = previous.get(at)) out.unshift(at.split(',').map(Number));
            return out;
          }
          next.push([nx, ny]);
        }
      }
      frontier = next;
    }
    return null;
  }

  const levels = [...new Set(cells.map((cell) => cell.level))].sort((a, b) => a - b);
  for (const level of levels) {
    for (;;) {
      const targets = new Set([...remaining.values()].filter((cell) => cell.level === level).map((cell) => key(cell.x, cell.y)));
      if (!targets.size) break;
      const later = new Set([...remaining.values()].filter((cell) => cell.level > level).map((cell) => key(cell.x, cell.y)));
      // Only if darker cells wall the target in does the snake cross one early.
      const found = route(targets, later) ?? route(targets);
      if (!found) throw new Error('snake: no route to the remaining cells');
      for (const point of found) step(point);
    }
  }
  // Finish on the margin, off the calendar, by the same collision-aware search.
  const margin = new Set();
  for (let x = minX; x <= maxX; x += 1) margin.add(key(x, minY)).add(key(x, maxY));
  for (let y = minY; y <= maxY; y += 1) margin.add(key(minX, y)).add(key(maxX, y));
  if (!margin.has(key(body[0][0], body[0][1]))) {
    const out = route(margin);
    if (out) for (const point of out) step(point);
  }

  return { length, width, height, path, eats };
}

// ---------------------------------------------------------------------------
// The Core: one torus of the Hopf fibration per repository, one fibre per file.
// eta is the torus's latitude on the 3-sphere: larger repositories sit on the outer tori.

export function coreLayout(repos) {
  const sorted = [...repos].sort((a, b) => b.paths.length - a.paths.length || a.name.localeCompare(b.name));
  const etaOuter = Math.PI / 4 + 0.06;
  const etaInner = Math.PI / 2 - 0.12;
  return sorted.map((repo, i) => ({
    repo: repo.name,
    eta: r3(sorted.length === 1 ? etaOuter : etaOuter + (etaInner - etaOuter) * (i / (sorted.length - 1))),
    fibres: repo.paths.length,
    // File classes in path order, so folders cluster around each torus.
    classes: [...repo.paths].sort().map(fileClass).join(''),
  }));
}
