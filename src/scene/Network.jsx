import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Plane, Raycaster, ShaderMaterial, Vector2, Vector3 } from 'three';
import { plural } from '../lib/format.js';
import { timeline } from '../lib/timeline.js';
import { colors, techClassColors } from '../lib/tokens.js';
import { toScreen, useCanvasPointer, useSlice } from './hooks.js';
import { NETWORK_Y, presence } from './layout.js';
import glyphFrag from './shaders/glyph.frag.glsl';
import glyphVert from './shaders/glyph.vert.glsl';
import lineFrag from './shaders/line.frag.glsl';
import pointFrag from './shaders/point.frag.glsl';

const KIND = { language: 1, framework: 2, infrastructure: 3, ai: 4 };

const EDGE_VERT = `
attribute float aAlpha; uniform float uOpacity; uniform vec3 uColor; uniform vec3 uHot; attribute float aHot;
varying vec3 vColor; varying float vAlpha;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vColor = mix(uColor, uHot, aHot); vAlpha = aAlpha * uOpacity;
}`;

const PULSE_VERT = `
uniform float uSize; uniform float uPixelRatio; uniform float uOpacity; uniform vec3 uColor; attribute float aAlpha;
varying vec3 vColor; varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vColor = uColor; vAlpha = uOpacity * aAlpha;
  gl_PointSize = uSize * uPixelRatio / max(0.5, -mv.z);
}`;

export function Network({ store, snapshot, geometry }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);
  const dpr = useThree((state) => state.viewport.dpr);
  const motion = useSlice(store, (s) => s.prefs.motion);
  const techFocus = useSlice(store, (s) => s.techFocus);
  const techClass = useSlice(store, (s) => s.techClass);
  const hoverId = useSlice(store, (s) => (s.hover?.kind === 'tech' ? s.hover.id : null));

  const model = useMemo(() => {
    const nodes = [
      ...snapshot.repos.map((r) => ({ id: `repo:${r.name}`, label: r.displayName, kind: 0, size: 2.3, repo: r })),
      ...snapshot.tech.nodes.map((n) => ({ id: n.id, label: n.label, kind: KIND[n.class], size: 1 + Math.min(4, n.repos.length) * 0.24, tech: n })),
    ];
    const index = new Map(nodes.map((n, i) => [n.id, i]));
    const edges = snapshot.tech.edges.map((e) => [index.get(`repo:${e.repo}`), index.get(e.tech)]).filter(([a, b]) => a !== undefined && b !== undefined);
    const positions = new Float32Array(nodes.length * 3);
    nodes.forEach((n, i) => positions.set(geometry.network[n.id] ?? [0, 0, 0], i * 3));

    const nodeGeo = new BufferGeometry();
    nodeGeo.setAttribute('position', new BufferAttribute(positions, 3));
    nodeGeo.setAttribute('aKind', new BufferAttribute(new Float32Array(nodes.map((n) => n.kind)), 1));
    nodeGeo.setAttribute('aSize', new BufferAttribute(new Float32Array(nodes.map((n) => n.size)), 1));
    nodeGeo.setAttribute('aState', new BufferAttribute(new Float32Array(nodes.length), 1));

    const edgeGeo = new BufferGeometry();
    edgeGeo.setAttribute('position', new BufferAttribute(new Float32Array(edges.length * 6), 3));
    edgeGeo.setAttribute('aAlpha', new BufferAttribute(new Float32Array(edges.length * 2).fill(0.13), 1));
    edgeGeo.setAttribute('aHot', new BufferAttribute(new Float32Array(edges.length * 2), 1));

    const pulseGeo = new BufferGeometry();
    pulseGeo.setAttribute('position', new BufferAttribute(new Float32Array(edges.length * 3), 3));
    pulseGeo.setAttribute('aAlpha', new BufferAttribute(new Float32Array(edges.length).fill(1), 1));

    const kindColors = [colors.bone, techClassColors.language, techClassColors.framework, techClassColors.infrastructure, techClassColors.ai].map((c) => new Color(c));
    const nodeMat = new ShaderMaterial({
      vertexShader: glyphVert,
      fragmentShader: glyphFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uPointSize: { value: 64 }, uPixelRatio: { value: 1 }, uOpacity: { value: 0 }, uKindColor: { value: kindColors }, uRed: { value: new Color(colors.red) } },
    });
    const edgeMat = new ShaderMaterial({
      vertexShader: EDGE_VERT,
      fragmentShader: lineFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uOpacity: { value: 0 }, uColor: { value: new Color(colors.cyan) }, uHot: { value: new Color(colors.red) } },
    });
    const pulseMat = new ShaderMaterial({
      vertexShader: PULSE_VERT,
      fragmentShader: pointFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uSize: { value: 40 }, uPixelRatio: { value: 1 }, uOpacity: { value: 0 }, uColor: { value: new Color(colors.cyan) } },
    });
    return { nodes, index, edges, positions, nodeGeo, edgeGeo, pulseGeo, nodeMat, edgeMat, pulseMat };
  }, [geometry, snapshot]);

  useEffect(
    () => () => {
      for (const key of ['nodeGeo', 'edgeGeo', 'pulseGeo', 'nodeMat', 'edgeMat', 'pulseMat']) model[key].dispose();
    },
    [model],
  );

  // Highlight state, recomputed only when the focus or the class filter changes.
  const focusIndex = model.index.get(hoverId ?? techFocus) ?? -1;
  useEffect(() => {
    const { nodes, edges, nodeGeo, edgeGeo } = model;
    const state = nodeGeo.attributes.aState.array;
    const alpha = edgeGeo.attributes.aAlpha.array;
    const hot = edgeGeo.attributes.aHot.array;
    const linked = new Set();
    if (focusIndex >= 0) edges.forEach(([a, b]) => (a === focusIndex ? linked.add(b) : b === focusIndex ? linked.add(a) : null));
    nodes.forEach((n, i) => {
      let s = 0;
      if (techClass && n.tech && n.tech.class !== techClass) s = 3;
      if (focusIndex >= 0) s = i === focusIndex ? 1 : linked.has(i) ? 2 : 3;
      state[i] = s;
    });
    edges.forEach(([a, b], e) => {
      const touches = focusIndex >= 0 && (a === focusIndex || b === focusIndex);
      const inClass = !techClass || nodes[b].tech?.class === techClass;
      const value = focusIndex >= 0 ? (touches ? 0.8 : 0.03) : inClass ? (techClass ? 0.4 : 0.13) : 0.03;
      alpha[e * 2] = alpha[e * 2 + 1] = value;
      hot[e * 2] = hot[e * 2 + 1] = touches ? 0.35 : 0;
    });
    nodeGeo.attributes.aState.needsUpdate = true;
    edgeGeo.attributes.aAlpha.needsUpdate = true;
    edgeGeo.attributes.aHot.needsUpdate = true;
  }, [focusIndex, model, techClass]);

  // Labels: plain text in the stage's (hidden from assistive technology) overlay.
  const labels = useRef([]);
  useEffect(() => {
    const host = document.getElementById('scene-labels');
    if (!host) return undefined;
    labels.current = model.nodes.map((n) => {
      const el = document.createElement('span');
      el.className = `scene-label${n.kind === 0 ? ' scene-label--repo' : ''}`;
      el.textContent = n.label;
      host.appendChild(el);
      return el;
    });
    return () => labels.current.forEach((el) => el.remove());
  }, [model]);

  // Which labels show at rest: every repository, and technologies used by two or more.
  const restingLabel = useMemo(() => model.nodes.map((n) => (n.kind === 0 ? 0.9 : n.tech.repos.length >= 2 ? 0.5 : 0)), [model]);

  // The worker re-settles the graph while a node is dragged. It starts on the first drag.
  const worker = useRef(null);
  const dirty = useRef(true);
  const ensureWorker = useCallback(() => {
    if (worker.current) return worker.current;
    const w = new Worker(process.env.WORKER_URL, { type: 'module' });
    const p = model.positions;
    w.postMessage({
      type: 'init',
      nodes: model.nodes.map((n, i) => ({ id: n.id, kind: n.kind === 0 ? 'repo' : 'tech', x: p[i * 3], y: p[i * 3 + 1], z: p[i * 3 + 2] })),
      links: model.edges.map(([a, b]) => ({ source: model.nodes[a].id, target: model.nodes[b].id })),
      scale: geometry.networkScale ?? 1,
    });
    w.onmessage = ({ data }) => {
      if (data.type === 'tick') {
        model.positions.set(data.positions);
        model.nodeGeo.attributes.position.needsUpdate = true;
        dirty.current = true;
      }
    };
    worker.current = w;
    return w;
  }, [model]);
  useEffect(() => () => worker.current?.terminate(), []);

  const group = useRef(null);
  const drag = useRef(null);
  const picked = useRef(null);
  const raycaster = useMemo(() => new Raycaster(), []);

  const active = () => timeline.t > 3.12 && timeline.t < 3.92;

  const pick = useCallback(
    (p) => {
      if (!p || !active() || !group.current) return -1;
      const v = new Vector3();
      const screen = { x: 0, y: 0, z: 0 };
      let best = -1;
      let bestD = 18 * 18;
      for (let i = 0; i < model.nodes.length; i += 1) {
        v.fromArray(model.positions, i * 3).applyMatrix4(group.current.matrixWorld);
        toScreen(v, camera, size, screen);
        if (screen.z > 1) continue;
        const d = (screen.x - p.x) ** 2 + (screen.y - p.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
    [camera, model, size],
  );

  const describe = (n) =>
    n.repo
      ? { kind: 'tech', id: n.id, label: n.label, detail: `repository · ${plural(model.edges.filter(([a]) => model.nodes[a] === n).length, 'technology', 'technologies')}`, source: 'scene' }
      : { kind: 'tech', id: n.id, label: n.label, detail: `${snapshot.tech.classes[n.tech.class]} · used by ${plural(n.tech.repos.length, 'repository', 'repositories')}`, source: 'scene' };

  const onMove = useCallback(
    (p, event) => {
      const d = drag.current;
      if (d && p && group.current) {
        if (Math.hypot(p.x - d.x, p.y - d.y) > 4) d.moved = true;
        if (!d.moved) return;
        raycaster.setFromCamera(new Vector2((p.x / size.width) * 2 - 1, -(p.y / size.height) * 2 + 1), camera);
        const hit = new Vector3();
        if (raycaster.ray.intersectPlane(d.plane, hit)) {
          group.current.worldToLocal(hit);
          ensureWorker().postMessage({ type: 'drag', id: model.nodes[d.index].id, x: hit.x, y: hit.y, z: hit.z });
        }
        event?.preventDefault();
        return;
      }
      const current = store.get().hover;
      if (current && current.source === 'list') return;
      const i = pick(p);
      if (i === picked.current) return;
      picked.current = i;
      gl.domElement.style.cursor = i >= 0 ? 'grab' : '';
      if (i < 0) {
        if (current?.kind === 'tech') store.actions.hover(null);
        return;
      }
      store.actions.hover(describe(model.nodes[i]));
    },
    [camera, ensureWorker, gl, model, pick, raycaster, size, store],
  );

  const onDown = useCallback(
    (p, event) => {
      const i = pick(p);
      if (i < 0 || !group.current) return;
      const world = new Vector3().fromArray(model.positions, i * 3).applyMatrix4(group.current.matrixWorld);
      const normal = new Vector3();
      camera.getWorldDirection(normal);
      drag.current = { index: i, x: p.x, y: p.y, moved: false, plane: new Plane().setFromNormalAndCoplanarPoint(normal, world) };
      gl.domElement.setPointerCapture?.(event.pointerId);
      gl.domElement.style.cursor = 'grabbing';
    },
    [camera, gl, model, pick],
  );

  const onUp = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    gl.domElement.style.cursor = '';
    const n = model.nodes[d.index];
    if (d.moved) {
      worker.current?.postMessage({ type: 'release', id: n.id });
      return;
    }
    if (n.repo) store.actions.select(n.repo.id);
    else store.actions.focusTech(store.get().techFocus === n.id ? null : n.id);
  }, [gl, model, store]);

  useCanvasPointer({ onMove, onDown, onUp });

  const clock = useRef(0);
  const screen = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
  const v = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    const t = timeline.t;
    const show = Math.max(presence(t, 3.16, 3.88, 0.3), 0.7 * presence(t, 4.2, 5.2, 0.3));
    const g = group.current;
    if (g) g.visible = show > 0.001;
    const labelsOn = presence(t, 3.18, 3.86, 0.18);
    if (show <= 0.001) {
      if (labels.current[0]?.style.opacity !== '0') labels.current.forEach((el) => (el.style.opacity = '0'));
      return;
    }
    const dt = Math.min(delta, 0.05);
    if (motion) clock.current += dt;
    if (g && motion && !drag.current) g.rotation.y += dt * 0.035;

    model.nodeMat.uniforms.uOpacity.value = show;
    model.nodeMat.uniforms.uPixelRatio.value = dpr;
    model.edgeMat.uniforms.uOpacity.value = show;
    model.pulseMat.uniforms.uOpacity.value = show * (focusIndex >= 0 ? 1 : 0.7);
    model.pulseMat.uniforms.uPixelRatio.value = dpr;

    const p = model.positions;
    if (dirty.current) {
      const ep = model.edgeGeo.attributes.position.array;
      model.edges.forEach(([a, b], e) => {
        ep.set(p.subarray(a * 3, a * 3 + 3), e * 6);
        ep.set(p.subarray(b * 3, b * 3 + 3), e * 6 + 3);
      });
      model.edgeGeo.attributes.position.needsUpdate = true;
      dirty.current = false;
    }
    // Signals travel from each repository to the technologies it uses.
    const pp = model.pulseGeo.attributes.position.array;
    const pa = model.pulseGeo.attributes.aAlpha.array;
    const edgeAlpha = model.edgeGeo.attributes.aAlpha.array;
    model.edges.forEach(([a, b], e) => {
      const k = (clock.current * 0.22 + e * 0.6180339) % 1;
      for (let j = 0; j < 3; j += 1) pp[e * 3 + j] = p[a * 3 + j] + (p[b * 3 + j] - p[a * 3 + j]) * k;
      pa[e] = Math.min(1, edgeAlpha[e * 2] * 4) * Math.sin(k * Math.PI);
    });
    model.pulseGeo.attributes.position.needsUpdate = true;
    model.pulseGeo.attributes.aAlpha.needsUpdate = true;

    if (!g || !labels.current.length) return;
    const state = model.nodeGeo.attributes.aState.array;
    labels.current.forEach((el, i) => {
      if (labelsOn <= 0.01) {
        if (el.style.opacity !== '0') el.style.opacity = '0';
        return;
      }
      v.fromArray(p, i * 3).applyMatrix4(g.matrixWorld);
      toScreen(v, camera, size, screen);
      if (screen.z > 1) {
        el.style.opacity = '0';
        return;
      }
      const s = state[i];
      const inClass = techClass && model.nodes[i].tech?.class === techClass;
      const strength = s === 1 ? 1 : s === 2 ? 0.95 : s === 3 ? (model.nodes[i].kind === 0 ? 0.3 : 0) : inClass ? 0.85 : restingLabel[i];
      el.style.opacity = String(strength * labelsOn);
      el.classList.toggle('is-hot', s === 1);
      el.style.transform = `translate3d(${Math.round(screen.x + 9)}px, ${Math.round(screen.y - 7)}px, 0)`;
    });
  });

  return (
    <group ref={group} position={[0, NETWORK_Y, 0]}>
      <lineSegments geometry={model.edgeGeo} material={model.edgeMat} frustumCulled={false} />
      <points geometry={model.pulseGeo} material={model.pulseMat} frustumCulled={false} />
      <points geometry={model.nodeGeo} material={model.nodeMat} frustumCulled={false} />
    </group>
  );
}
