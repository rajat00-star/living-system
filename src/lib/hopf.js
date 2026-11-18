// The Hopf fibration, shared by the README renderer, the no-WebGL plates and the 3D
// scene's pointer picking. The vertex shader in src/scene/shaders/core.vert does the same
// arithmetic on the GPU; keep the two in step.
//
// A point of the 3-sphere is a pair of complex numbers (z1, z2) with |z1|² + |z2|² = 1.
// Every fibre is a great circle: for a base point at latitude eta and longitude alpha,
//   z1 = sin(eta) · e^{i(t + alpha)},  z2 = cos(eta) · e^{i t},  t ∈ [0, 2π).
// Fibres with the same eta fill one torus. Stereographic projection from (0, 0, 0, 1)
// carries each fibre to a circle in ordinary space, and every pair of them stays linked.

export function fibrePoint(eta, alpha, t) {
  const s = Math.sin(eta);
  const c = Math.cos(eta);
  return [s * Math.cos(t + alpha), s * Math.sin(t + alpha), c * Math.cos(t), c * Math.sin(t)];
}

// A rotation of 4-space in the x–w plane by a and the y–w plane by b. Moving the
// projection pole is what makes the tori swell and re-fold.
export function rotate4([x, y, z, w], a, b) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const x1 = x * ca - w * sa;
  const w1 = x * sa + w * ca;
  const cb = Math.cos(b);
  const sb = Math.sin(b);
  return [x1, y * cb - w1 * sb, z, y * sb + w1 * cb];
}

// Stereographic projection to 3-space, turned so the tori lie flat with y up.
export function project([x, y, z, w]) {
  const k = 1 / (1 - w);
  return [x * k, z * k, -y * k];
}

// Fibre longitudes on a torus: evenly spaced, with a per-torus twist so the tori's
// seams never line up.
export const fibreAlpha = (index, count, torus) => (2 * Math.PI * index) / Math.max(1, count) + torus * 0.61;

// The circle a fibre projects to, as centre, radius and unit normal. Three points fix it.
export function fibreCircle(eta, alpha, a = 0, b = 0) {
  const p = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((t) => project(rotate4(fibrePoint(eta, alpha, t), a, b)));
  const u = sub(p[0], p[2]);
  const v = sub(p[1], p[2]);
  const n = cross(u, v);
  const nn = dot(n, n) || 1e-12;
  const centre = add(p[2], scale(cross(sub(scale(v, dot(u, u)), scale(u, dot(v, v))), n), 1 / (2 * nn)));
  return { centre, radius: Math.hypot(...sub(p[0], centre)), normal: scale(n, 1 / Math.sqrt(nn)) };
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Rotates a point about y (yaw) then x (pitch): the camera of the flat drawings.
export function view([x, y, z], yaw, pitch) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
}
