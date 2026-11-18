import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  EdgesGeometry,
  IcosahedronGeometry,
  LineBasicMaterial,
  MeshBasicMaterial,
  ShaderMaterial,
  Vector3,
} from 'three';
import { filaments, specimens } from '../lib/data.js';
import { formatInt } from '../lib/format.js';
import { hasStageMarks, signaturePoint, stageParam } from '../lib/signatures.js';
import { timeline } from '../lib/timeline.js';
import { colors, fileClassColors } from '../lib/tokens.js';
import { toScreen, useCanvasPointer, useSlice } from './hooks.js';
import { presence } from './layout.js';
import dendriteVert from './shaders/dendrite.vert.glsl';
import lineFrag from './shaders/line.frag.glsl';
import pointFrag from './shaders/point.frag.glsl';

const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

const SIMPLE_POINT = `
uniform float uSize; uniform float uPixelRatio; uniform vec3 uColor; uniform float uOpacity;
varying vec3 vColor; varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vColor = uColor; vAlpha = uOpacity;
  gl_PointSize = uSize * uPixelRatio / max(0.5, -mv.z);
}`;

const pointMaterial = (color, size) =>
  new ShaderMaterial({
    vertexShader: SIMPLE_POINT,
    fragmentShader: pointFrag,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uSize: { value: size }, uPixelRatio: { value: 1 }, uColor: { value: new Color(color) }, uOpacity: { value: 1 } },
  });

// Builds line and point buffers for one dendrite, with the folder groups each vertex
// belongs to, so a layer of the architecture can be lit from the specimen plate.
function buildDendrite(d) {
  const n = d.kinds.length;
  const parent = new Int32Array(n).fill(-1);
  for (let i = 0; i < d.edges.length; i += 2) parent[d.edges[i + 1]] = d.edges[i];
  const groupIds = new Map();
  const groupNames = [];
  for (const [path, node] of Object.entries(d.dirs)) {
    if (path.split('/').length <= 2) {
      groupIds.set(node, groupNames.length);
      groupNames.push(path);
    }
  }
  const groups = new Float32Array(n * 2).fill(-1);
  for (let i = 0; i < n; i += 1) {
    for (let a = i; a >= 0; a = parent[a]) {
      if (!groupIds.has(a)) continue;
      if (d.depths[a] === 1) groups[i * 2] = groupIds.get(a);
      if (d.depths[a] === 2) groups[i * 2 + 1] = groupIds.get(a);
    }
  }
  const depthOf = (i) => d.depths[i] / Math.max(1, d.maxDepth);

  const edgeCount = d.edges.length / 2;
  const lp = new Float32Array(edgeCount * 6);
  const ld = new Float32Array(edgeCount * 2);
  const lc = new Float32Array(edgeCount * 2).fill(-1);
  const lg = new Float32Array(edgeCount * 4);
  for (let e = 0; e < edgeCount; e += 1) {
    const a = d.edges[e * 2];
    const b = d.edges[e * 2 + 1];
    lp.set(d.positions.slice(a * 3, a * 3 + 3), e * 6);
    lp.set(d.positions.slice(b * 3, b * 3 + 3), e * 6 + 3);
    ld[e * 2] = depthOf(a);
    ld[e * 2 + 1] = depthOf(b);
    lg.set([groups[b * 2], groups[b * 2 + 1], groups[b * 2], groups[b * 2 + 1]], e * 4);
  }
  const lines = new BufferGeometry();
  lines.setAttribute('position', new BufferAttribute(lp, 3));
  lines.setAttribute('aDepth', new BufferAttribute(ld, 1));
  lines.setAttribute('aClass', new BufferAttribute(lc, 1));
  lines.setAttribute('aGroup', new BufferAttribute(lg, 2));

  const files = [];
  for (let i = 0; i < n; i += 1) if (d.kinds[i] === 1) files.push(i);
  const pp = new Float32Array(files.length * 3);
  const pd = new Float32Array(files.length);
  const pc = new Float32Array(files.length);
  const pg = new Float32Array(files.length * 2);
  files.forEach((node, k) => {
    pp.set(d.positions.slice(node * 3, node * 3 + 3), k * 3);
    pd[k] = depthOf(node);
    pc[k] = d.classes[node];
    pg[k * 2] = groups[node * 2];
    pg[k * 2 + 1] = groups[node * 2 + 1];
  });
  const points = new BufferGeometry();
  points.setAttribute('position', new BufferAttribute(pp, 3));
  points.setAttribute('aDepth', new BufferAttribute(pd, 1));
  points.setAttribute('aClass', new BufferAttribute(pc, 1));
  points.setAttribute('aGroup', new BufferAttribute(pg, 2));
  return { lines, points, groupNames };
}

// The signature curve in 3D: each kind lies in its own plane around the dendrite.
function signature3d(kind, t, sides, r) {
  const [x, y] = signaturePoint(kind, t, sides);
  if (kind === 'trajectory') return [x * r, y * r * 0.32, y * r];
  if (kind === 'loop') return [x * r, y * r * 0.9, Math.sin(2 * t) * r * 0.22];
  return [x * r, 0, y * r];
}

function buildSignature(kind, stages) {
  if (!kind) return null;
  const r = 1.16;
  if (kind === 'lattice') {
    const s = 1.0;
    const ticks = [-s, -s / 2, 0, s / 2, s];
    const v = [];
    for (const a of ticks) {
      for (const b of ticks) {
        v.push(-s, a, b, s, a, b);
        v.push(a, -s, b, a, s, b);
        v.push(a, b, -s, a, b, s);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(v), 3));
    return { kind, grid: g, marks: null, r: s };
  }
  const sides = Math.max(5, stages?.items.length ?? 5);
  const samples = kind === 'perimeter' ? sides : 160;
  const pts = [];
  for (let i = 0; i <= samples; i += 1) pts.push(...signature3d(kind, kind === 'perimeter' ? stageParam(i, sides) : (i / samples) * Math.PI * 2, sides, r));
  const curve = new BufferGeometry();
  curve.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
  let marks = null;
  if (stages && hasStageMarks(kind)) {
    const n = stages.items.length;
    const m = [];
    for (let i = 0; i < n; i += 1) m.push(...signature3d(kind, stageParam(i, kind === 'perimeter' ? sides : n), sides, r));
    marks = new BufferGeometry();
    marks.setAttribute('position', new BufferAttribute(new Float32Array(m), 3));
  }
  const shell = kind === 'perimeter' ? new EdgesGeometry(new IcosahedronGeometry(1.26, 1)) : null;
  return { kind, curve, marks, shell, sides, r };
}

function Specimen({ spec, at, geometry, index, store, dpr }) {
  const group = useRef(null);
  const pulse = useRef(null);
  const hover = useSlice(store, (s) => (s.hover && s.hover.kind === 'specimen' && s.hover.id === spec.id) || s.selected === spec.id);
  const layerFocus = useSlice(store, (s) => s.layerHover ?? s.layerPinned);
  const motion = useSlice(store, (s) => s.prefs.motion);

  const built = useMemo(() => (spec.repo ? buildDendrite(geometry.dendrites[spec.repo.name]) : null), [geometry, spec]);
  const sig = useMemo(() => (spec.repo ? buildSignature(spec.repo.signature, spec.repo.stages) : null), [spec]);

  const materials = useMemo(() => {
    const uniforms = () => ({
      uGrow: { value: 0 },
      uOpacity: { value: 0 },
      uHot: { value: 0 },
      uFocus: { value: -1 },
      uPointSize: { value: at.featured ? 34 : 26 },
      uPixelRatio: { value: 1 },
      uBase: { value: new Color(colors.bone) },
      uCyan: { value: new Color(colors.cyan) },
      uRed: { value: new Color(colors.red) },
      uClassColor: { value: fileClassColors.map((c) => new Color(c)) },
      uIsPoints: { value: 0 },
    });
    const lines = new ShaderMaterial({ vertexShader: dendriteVert, fragmentShader: lineFrag, transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: uniforms() });
    const points = new ShaderMaterial({ vertexShader: dendriteVert, fragmentShader: pointFrag, transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: uniforms() });
    points.uniforms.uIsPoints.value = 1;
    return {
      lines,
      points,
      curve: new LineBasicMaterial({ color: colors.cyan, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
      shell: new LineBasicMaterial({ color: colors.bone, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
      marks: pointMaterial(colors.cyan, 60),
      pulse: pointMaterial(spec.repo?.signature === 'perimeter' ? colors.red : colors.bone, 110),
      sealed: new MeshBasicMaterial({ color: '#050607' }),
      sealedEdges: new LineBasicMaterial({ color: colors.bone, transparent: true, opacity: 0.3 }),
    };
  }, [at.featured, spec]);

  const sealedGeo = useMemo(() => (spec.sealed ? { solid: new IcosahedronGeometry(1, 0), edges: new EdgesGeometry(new IcosahedronGeometry(1, 0)) } : null), [spec]);
  const pulseGeo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(3), 3));
    return g;
  }, []);

  useEffect(
    () => () => {
      Object.values(materials).forEach((m) => m.dispose());
      built?.lines.dispose();
      built?.points.dispose();
      sig?.curve?.dispose();
      sig?.grid?.dispose();
      sig?.marks?.dispose();
      sig?.shell?.dispose();
      sealedGeo?.solid.dispose();
      sealedGeo?.edges.dispose();
      pulseGeo.dispose();
    },
    [materials, built, sig, sealedGeo, pulseGeo],
  );

  const focusGroup = useMemo(() => {
    if (!built || !layerFocus) return -1;
    const [repo, dir] = layerFocus.split(':');
    return repo === spec.repo?.name ? built.groupNames.indexOf(dir) : -1;
  }, [built, layerFocus, spec]);

  const clock = useRef(index * 1.7);

  useFrame((_, delta) => {
    const t = timeline.t;
    const show = Math.max(presence(t, 1.05, 2.05, 0.28), presence(t, 4.2, 5.2, 0.3));
    if (group.current) group.current.visible = show > 0.001;
    if (show <= 0.001) return;
    const dt = Math.min(delta, 0.05);
    if (motion) clock.current += dt;
    const grow = t > 3 ? 1 : smooth(0.98 + index * 0.05, 1.42 + index * 0.05, t);
    const hot = hover ? 1 : 0;
    for (const m of [materials.lines, materials.points]) {
      m.uniforms.uGrow.value = grow;
      m.uniforms.uOpacity.value = show;
      m.uniforms.uHot.value += (hot - m.uniforms.uHot.value) * Math.min(1, dt * 6);
      m.uniforms.uFocus.value = focusGroup;
      m.uniforms.uPixelRatio.value = dpr;
    }
    materials.curve.opacity = show * grow * (0.32 + hot * 0.4);
    materials.shell.opacity = show * grow * (0.07 + hot * 0.08);
    materials.marks.uniforms.uOpacity.value = show * grow;
    materials.marks.uniforms.uPixelRatio.value = dpr;
    materials.pulse.uniforms.uOpacity.value = show * grow;
    materials.pulse.uniforms.uPixelRatio.value = dpr;
    materials.sealedEdges.opacity = show * (0.22 + hot * 0.4);
    if (group.current && motion && !hover) group.current.rotation.y += dt * (at.featured ? 0.06 : 0.09);

    if (sig && sig.curve && pulse.current) {
      const p = signature3d(sig.kind, (clock.current * 0.45) % (Math.PI * 2), sig.sides, sig.r);
      pulseGeo.attributes.position.array.set(p);
      pulseGeo.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={group} position={at.position} scale={at.scale}>
      {built ? (
        <>
          <lineSegments geometry={built.lines} material={materials.lines} frustumCulled={false} />
          <points geometry={built.points} material={materials.points} frustumCulled={false} />
        </>
      ) : null}
      {sig?.grid ? <lineSegments geometry={sig.grid} material={materials.shell} /> : null}
      {sig?.curve ? <lineLoop geometry={sig.curve} material={materials.curve} /> : null}
      {sig?.shell ? <lineSegments geometry={sig.shell} material={materials.shell} /> : null}
      {sig?.marks ? <points geometry={sig.marks} material={materials.marks} frustumCulled={false} /> : null}
      {sig?.curve ? <points ref={pulse} geometry={pulseGeo} material={materials.pulse} frustumCulled={false} /> : null}
      {sealedGeo ? (
        <group rotation={[0.4, 0.3, 0.1]}>
          <mesh geometry={sealedGeo.solid} material={materials.sealed} />
          <lineSegments geometry={sealedGeo.edges} material={materials.sealedEdges} />
        </group>
      ) : null}
    </group>
  );
}

// Curved filaments between specimens that share technologies; brighter for more shared.
function Filaments({ snapshot, layout, store }) {
  const hover = useSlice(store, (s) => (s.hover?.kind === 'specimen' ? s.hover.id : s.selected));
  const items = useMemo(() => {
    const byName = new Map(snapshot.repos.map((r) => [r.name, r]));
    return filaments(snapshot).map(({ a, b, shared }) => {
      const ra = byName.get(a);
      const rb = byName.get(b);
      const pa = new Vector3(...layout.get(ra.id).position);
      const pb = new Vector3(...layout.get(rb.id).position);
      const ctrl = pa.clone().add(pb).multiplyScalar(0.22).add(new Vector3(0, 2.2, 0));
      const pts = [];
      for (let i = 0; i <= 40; i += 1) {
        const k = i / 40;
        pts.push(...[0, 1, 2].map((j) => (1 - k) ** 2 * pa.getComponent(j) + 2 * (1 - k) * k * ctrl.getComponent(j) + k ** 2 * pb.getComponent(j)));
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
      const material = new LineBasicMaterial({ color: colors.cyan, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
      return { ids: [ra.id, rb.id], weight: Math.min(1, shared.length / 12), geometry, material };
    });
  }, [layout, snapshot]);
  useEffect(() => () => items.forEach((f) => (f.geometry.dispose(), f.material.dispose())), [items]);

  useFrame(() => {
    const t = timeline.t;
    const show = Math.max(presence(t, 1.15, 2.05, 0.28), presence(t, 4.2, 5.2, 0.3));
    for (const f of items) {
      const lit = hover && f.ids.includes(hover);
      f.material.opacity = show * (hover ? (lit ? 0.5 + f.weight * 0.4 : 0.03) : 0.05 + f.weight * 0.16);
    }
  });

  return items.map((f, i) => <line key={i} geometry={f.geometry} material={f.material} frustumCulled={false} />);
}

export function Specimens({ store, snapshot, geometry, layout }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const list = useMemo(() => specimens(snapshot), [snapshot]);
  const picked = useRef(null);

  const pick = useCallback(
    (p) => {
      if (!p || timeline.t < 0.95 || timeline.t > 2.1) return null;
      const screen = { x: 0, y: 0, z: 0 };
      const v = new Vector3();
      const tanHalf = Math.tan(((camera.fov ?? 36) * Math.PI) / 360);
      let best = null;
      let bestD = Infinity;
      for (const spec of list) {
        const at = layout.get(spec.id);
        v.set(...at.position);
        const dist = v.distanceTo(camera.position);
        toScreen(v, camera, size, screen);
        if (screen.z > 1) continue;
        const radius = Math.max(22, ((at.scale * 1.25) / (dist * tanHalf)) * (size.height / 2));
        const d = Math.hypot(screen.x - p.x, screen.y - p.y);
        if (d < radius && d < bestD) {
          bestD = d;
          best = spec;
        }
      }
      return best;
    },
    [camera, layout, list, size],
  );

  const onMove = useCallback(
    (p) => {
      const current = store.get().hover;
      if (current && current.source === 'list') return;
      const spec = pick(p);
      if ((spec?.id ?? null) === picked.current) return;
      picked.current = spec?.id ?? null;
      if (!spec) {
        if (current?.kind === 'specimen') store.actions.hover(null);
        return;
      }
      const detail = spec.repo ? `${spec.plate} · ${formatInt(spec.repo.morphology.files)} files · ${spec.repo.primaryLanguage ?? 'no language detected'}` : `${spec.plate} · sealed · private repository`;
      store.actions.hover({ kind: 'specimen', id: spec.id, label: spec.name, detail, source: 'scene' });
    },
    [pick, store],
  );
  const onClick = useCallback(
    (p) => {
      const spec = pick(p);
      if (spec) store.actions.select(spec.id, { scroll: false });
    },
    [pick, store],
  );
  useCanvasPointer({ onMove, onClick });

  return (
    <group>
      {list.map((spec, i) => (
        <Specimen key={spec.id} spec={spec} at={layout.get(spec.id)} geometry={geometry} index={i} store={store} dpr={dpr} />
      ))}
      <Filaments snapshot={snapshot} layout={layout} store={store} />
    </group>
  );
}
