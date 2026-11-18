import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Matrix4, ShaderMaterial, Vector3 } from 'three';
import { formatInt } from '../lib/format.js';
import { fibreAlpha, fibrePoint } from '../lib/hopf.js';
import { timeline } from '../lib/timeline.js';
import { colors, fileClassColors } from '../lib/tokens.js';
import { toriOrder } from '../lib/data.js';
import { toScreen, useCanvasPointer, useSlice } from './hooks.js';
import vertexShader from './shaders/core.vert.glsl';
import fragmentShader from './shaders/point.frag.glsl';

const MAX_SAMPLES = 72;
export const CORE_SAMPLES = { high: 72, medium: 44, low: 26 };
const GOLDEN = 0.6180339887498949;
const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// A rotation of 4-space built from plane rotations (row-major), matching rotate4 in
// src/lib/hopf.js: x–w by a and y–w by b re-fold the tori; x–y with z–w opposite spins them.
function plane(i, j, angle) {
  const m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  m[i * 4 + i] = c;
  m[i * 4 + j] = -s;
  m[j * 4 + i] = s;
  m[j * 4 + j] = c;
  return m;
}
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) for (let k = 0; k < 4; k += 1) o[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
  return o;
}
export function rotation4(a, b, d) {
  return mul(mul(plane(0, 3, a), plane(1, 3, b)), mul(plane(0, 1, d), plane(2, 3, -d)));
}

export function Core({ store, snapshot, geometry, layout, quality }) {
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);
  const dpr = useThree((state) => state.viewport.dpr);
  const hover = useSlice(store, (s) => s.hover);
  const motion = useSlice(store, (s) => s.prefs.motion);
  const tori = useMemo(() => toriOrder(snapshot), [snapshot]);

  // Fibres in geometry order (largest torus first), samples ordered so that any prefix of
  // the buffer covers every fibre evenly: lower quality just draws fewer samples.
  const { buffer, fibres, count } = useMemo(() => {
    const list = [];
    geometry.core.forEach((torus, ti) => {
      for (let j = 0; j < torus.fibres; j += 1) list.push({ eta: torus.eta, alpha: fibreAlpha(j, torus.fibres, ti), torus: ti, cls: Number(torus.classes[j]), phase: (j * GOLDEN + ti * 0.37) % 1 });
    });
    const F = list.length;
    const position = new Float32Array(F * MAX_SAMPLES * 3);
    const aT = new Float32Array(F * MAX_SAMPLES);
    const aClass = new Float32Array(F * MAX_SAMPLES);
    for (let s = 0; s < MAX_SAMPLES; s += 1) {
      for (let f = 0; f < F; f += 1) {
        const i = s * F + f;
        const fibre = list[f];
        position[i * 3] = fibre.eta;
        position[i * 3 + 1] = fibre.alpha;
        position[i * 3 + 2] = fibre.torus;
        aT[i] = Math.PI * 2 * ((s * GOLDEN + fibre.phase) % 1);
        aClass[i] = fibre.cls;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(position, 3));
    geo.setAttribute('aT', new BufferAttribute(aT, 1));
    geo.setAttribute('aClass', new BufferAttribute(aClass, 1));
    return { buffer: geo, fibres: list, count: F };
  }, [geometry]);

  const slots = useMemo(
    () =>
      geometry.core.map((torus) => {
        const repo = snapshot.repos.find((r) => r.name === torus.repo);
        const at = repo && layout.get(repo.id);
        return at ? new Vector3(...at.position) : new Vector3();
      }),
    [geometry, layout, snapshot],
  );

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        // One slot per torus, however many public repositories there are.
        defines: { TORI: Math.max(1, slots.length) },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uFlow: { value: 0 },
          uRot4: { value: new Matrix4() },
          uScale: { value: 1 },
          uPointSize: { value: 26 },
          uPixelRatio: { value: 1 },
          uOpacity: { value: 1 },
          uDissociate: { value: 0 },
          uSlots: { value: slots.length ? slots : [new Vector3()] },
          uHighlight: { value: -1 },
          uClassColor: { value: fileClassColors.map((c) => new Color(c)) },
          uClassAlpha: { value: [0.62, 0.66, 0.34, 0.16] },
          uRed: { value: new Color(colors.red) },
        },
      }),
    [slots],
  );

  useEffect(() => () => (buffer.dispose(), material.dispose()), [buffer, material]);

  useEffect(() => {
    buffer.setDrawRange(0, count * (CORE_SAMPLES[quality] ?? CORE_SAMPLES.high));
  }, [buffer, count, quality]);

  const points = useRef(null);
  const state = useRef({ clock: 0, flow: 0, px: 0, py: 0, rot: rotation4(0, 0, 0), picked: -1 });

  // Which torus does the pointer touch? Projects six samples per fibre through the same
  // rotation the shader uses; only while FIG. 01 is on screen.
  const pick = useCallback(
    (p) => {
      if (!p || timeline.t > 0.85 || !points.current) return -1;
      const R = state.current.rot;
      const v = new Vector3();
      const screen = { x: 0, y: 0, z: 0 };
      let best = 18 * 18;
      let found = -1;
      for (let f = 0; f < fibres.length; f += 2) {
        const fibre = fibres[f];
        for (let s = 0; s < 6; s += 1) {
          const q = fibrePoint(fibre.eta, fibre.alpha, (s / 6) * Math.PI * 2);
          const x = R[0] * q[0] + R[1] * q[1] + R[2] * q[2] + R[3] * q[3];
          const y = R[4] * q[0] + R[5] * q[1] + R[6] * q[2] + R[7] * q[3];
          const z = R[8] * q[0] + R[9] * q[1] + R[10] * q[2] + R[11] * q[3];
          const w = R[12] * q[0] + R[13] * q[1] + R[14] * q[2] + R[15] * q[3];
          const k = 1 / Math.max(1 - w, 0.04);
          if (k > 3.4) continue;
          v.set(x * k, z * k, -y * k).applyMatrix4(points.current.matrixWorld);
          toScreen(v, camera, size, screen);
          if (screen.z > 1) continue;
          const d = (screen.x - p.x) ** 2 + (screen.y - p.y) ** 2;
          if (d < best) {
            best = d;
            found = fibre.torus;
          }
        }
      }
      return found;
    },
    [camera, fibres, size],
  );

  const onMove = useCallback(
    (p) => {
      const current = store.get().hover;
      if (current && current.source === 'list') return;
      const index = pick(p);
      if (index === state.current.picked) return;
      state.current.picked = index;
      const repo = index >= 0 ? snapshot.repos.find((r) => r.name === geometry.core[index].repo) : null;
      store.actions.hover(repo ? { kind: 'torus', id: repo.name, label: repo.displayName, detail: `T${tori.indexOf(repo) + 1} · ${formatInt(repo.morphology.files)} fibres, one per file`, source: 'scene' } : null);
    },
    [geometry, pick, snapshot, store, tori],
  );
  const onClick = useCallback(
    (p) => {
      const index = pick(p);
      if (index < 0) return;
      const repo = snapshot.repos.find((r) => r.name === geometry.core[index].repo);
      if (repo) store.actions.select(repo.id);
    },
    [geometry, pick, snapshot, store],
  );
  useCanvasPointer({ onMove, onClick });

  useFrame((_, delta) => {
    const s = state.current;
    const t = timeline.t;
    const u = material.uniforms;
    const visible = t < 1.45 || t > 3.95;
    if (points.current) points.current.visible = visible;
    if (!visible) return;

    const dt = Math.min(delta, 0.05);
    if (motion) {
      s.clock += dt;
      s.flow += dt * 0.32;
    }
    const target = timeline.pointer;
    const ease = motion ? 1 - Math.exp(-dt * 2.4) : 1;
    s.px += ((target.active ? target.x : 0) - s.px) * ease;
    s.py += ((target.active ? target.y : 0) - s.py) * ease;
    const T = s.clock;
    const a = 0.2 * Math.sin(T * 0.12) + 0.34 * s.px + 0.12;
    const b = 0.16 * Math.cos(T * 0.1) - 0.3 * s.py - 0.08;
    s.rot = rotation4(a, b, T * 0.035);
    u.uRot4.value.set(...s.rot);
    u.uFlow.value = s.flow;
    u.uPixelRatio.value = dpr;

    const out = t < 3 ? smooth(0.68, 1.22, t) : 1 - smooth(4.0, 4.45, t);
    u.uDissociate.value = out;
    u.uOpacity.value = t < 3 ? 1 - smooth(0.92, 1.3, t) : 0.75 * smooth(3.98, 4.4, t);

    let highlight = -1;
    if (hover && (hover.kind === 'torus' || hover.kind === 'specimen')) {
      const name = hover.kind === 'torus' ? hover.id : snapshot.repos.find((r) => r.id === hover.id)?.name;
      highlight = geometry.core.findIndex((torus) => torus.repo === name);
    }
    u.uHighlight.value = highlight;
  });

  return <points ref={points} geometry={buffer} material={material} frustumCulled={false} />;
}
