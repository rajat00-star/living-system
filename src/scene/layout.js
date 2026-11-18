// Where everything lives in the world, and where the camera stands for each moment of
// the scroll. One vertical column: the core and its specimens at the surface, the genome
// beneath them, the nervous system deepest, and a final view of the whole organism.
import { specimens } from '../lib/data.js';

export const GENOME_Y = -20;
export const NETWORK_Y = -38;

// Featured specimens on an inner ring, the other public repositories further out.
// Minor specimens are sized by how many files they hold.
export function specimenLayout(snapshot) {
  const list = specimens(snapshot);
  const featured = list.filter((s) => s.featured);
  const minor = list.filter((s) => !s.featured);
  const out = new Map();
  featured.forEach((s, i) => {
    const a = (i / featured.length) * Math.PI * 2 + 0.4;
    out.set(s.id, { position: [Math.cos(a) * 7, i % 2 ? 0.8 : -0.5, Math.sin(a) * 7], scale: 1.4, featured: true });
  });
  minor.forEach((s, i) => {
    const a = (i / Math.max(1, minor.length)) * Math.PI * 2 + 0.4 + Math.PI / Math.max(1, minor.length);
    const files = s.repo?.morphology.files ?? 1;
    out.set(s.id, { position: [Math.cos(a) * 11.5, i % 2 ? 1.8 : 0.3, Math.sin(a) * 11.5], scale: 0.55 + 0.33 * Math.log10(files + 1), featured: false });
  });
  return out;
}

const smooth = (x) => x * x * (3 - 2 * x);

// Camera keyframes along the scroll timeline t (0 to 5). Between keys the camera eases.
export function cameraKeys(aspect) {
  const narrow = aspect < 0.9;
  const d = narrow ? 1.9 : 1;
  const side = (x) => (narrow ? 0.45 : x);
  const low = (y) => (narrow ? y - 1.6 : y);
  const G = GENOME_Y;
  const N = NETWORK_Y;
  return [
    [0.0, [0, 1.6, 11 * d], [side(-1.35), low(0.2), 0]],
    [0.72, [0.9, 2.2, 10.4 * d], [side(-1.35), low(0.2), 0]],
    [1.24, [0, 9.2, 23.5 * d], [side(-2.8), low(-0.4), 0]],
    [1.86, [-8.6, 7.8, 22 * d], [side(-2.8), low(-0.4), 0]],
    [2.22, [5.2, G + 2.4, 8.4 * d], [side(-0.5), low(G + 0.4), 0]],
    [2.46, [3.6, G + 0.6, 8.2 * d], [side(-0.5), low(G + 0.1), 0]],
    [2.58, [3.4, G + 3.3, 6.6 * d], [side(-0.6), low(G + 0.2), -2.6]],
    [2.72, [2.6, G + 2.9, 5.9 * d], [side(-0.6), low(G + 0.2), -2.2]],
    [2.92, [0, G + 10, 27 * d], [0, G + 9, 0]],
    [3.24, [0, N + 2.2, 15 * d], [side(-1.8), low(N), 0]],
    [3.82, [3.5, N + 1.4, 14 * d], [side(-1.8), low(N), 0]],
    [4.26, [30, -14, 66 * d], [side(-13), -19, 0]],
    [5.0, [34, -12, 72 * d], [side(-13), -19, 0]],
  ];
}

export function cameraAt(t, keys, pos, target) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i += 1;
  const [t0, p0, q0] = keys[i];
  const [t1, p1, q1] = keys[i + 1];
  const k = smooth(Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
  for (let j = 0; j < 3; j += 1) {
    pos[j] = p0[j] + (p1[j] - p0[j]) * k;
    target[j] = q0[j] + (q1[j] - q0[j]) * k;
  }
}

// How present each figure is at time t: 0 outside its window, 1 inside, eased edges.
export function presence(t, from, to, fade = 0.25) {
  if (t < from - fade || t > to + fade) return 0;
  if (t < from) return smooth((t - (from - fade)) / fade);
  if (t > to) return smooth(1 - (t - to) / fade);
  return 1;
}
