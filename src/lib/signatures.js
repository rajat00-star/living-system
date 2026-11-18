// Each specimen's signature as a closed curve in the unit plane, shared by the README
// plates and the 3D scene. Its stages, quoted from the repository, sit at evenly spaced
// parameters along the curve, so the marks always lie on the line they belong to.
//
//   perimeter   SafeCircle: a polygon with one vertex per stage of the attack chain
//   trajectory  OmniPilot: a tilted orbit, the flight path through its checkpoints
//   loop        CodeForge: a figure-of-eight, the edit–test–repair loop
//   lattice     PraMaan: a rigid grid, the deterministic rule engine (no stage marks)

const lerp = (a, b, f) => a + (b - a) * f;

export function signaturePoint(kind, t, sides = 5) {
  if (kind === 'perimeter') {
    const n = Math.max(3, sides);
    const seg = (2 * Math.PI) / n;
    const u = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const k = Math.floor(u / seg);
    const f = (u - k * seg) / seg;
    const a0 = k * seg - Math.PI / 2;
    const a1 = (k + 1) * seg - Math.PI / 2;
    return [lerp(Math.cos(a0), Math.cos(a1), f), lerp(Math.sin(a0), Math.sin(a1), f)];
  }
  if (kind === 'trajectory') {
    const x = 1.08 * Math.cos(t);
    const y = 0.42 * Math.sin(t);
    const a = -0.24;
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  }
  if (kind === 'loop') {
    const s = Math.sin(t);
    const c = Math.cos(t);
    const d = 1 + s * s;
    return [(1.12 * c) / d, (1.5 * s * c) / d];
  }
  return [Math.cos(t), Math.sin(t)];
}

// The parameter of stage i of n. A perimeter starts its stages at the top vertex.
export const stageParam = (i, n) => (2 * Math.PI * i) / Math.max(1, n);

export const hasStageMarks = (kind) => kind === 'perimeter' || kind === 'trajectory' || kind === 'loop';
