import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MeshBasicMaterial,
  Plane,
  Raycaster,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { snakeClock } from '../lib/actions.js';
import { calendarCells, describeAttribution, repoByName } from '../lib/data.js';
import { formatDate, plural } from '../lib/format.js';
import { timeline } from '../lib/timeline.js';
import { colors, levelColors } from '../lib/tokens.js';
import { toScreen, useCanvasPointer, useSlice } from './hooks.js';
import { GENOME_Y, presence } from './layout.js';
import flowVert from './shaders/flow.vert.glsl';
import genomeVert from './shaders/genome.vert.glsl';
import lineFrag from './shaders/line.frag.glsl';
import pointFrag from './shaders/point.frag.glsl';

const PITCH = 0.3;
const RADIUS = 1.35;
const RISE = 0.05;
const NEAR = 2.0;
// The same placements as the vertex shader, for picking, flows and the snake.
const helixY = (i, n) => (i - (n - 1)) * RISE + 2.6;
const terrainAt = (x, y, weeks) => [(y - 3) * PITCH, (weeks - 1 - x) * -PITCH + NEAR];
const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const columnHeight = (count) => (count > 0 ? 0.14 + Math.log(1 + count) * 0.62 : 0.035);

export function Genome({ store, snapshot, geometry, layout }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const snake = useSlice(store, (s) => s.snake);
  const dayFocus = useSlice(store, (s) => s.dayFocus);
  const motion = useSlice(store, (s) => s.prefs.motion);
  const cells = useMemo(() => calendarCells(snapshot), [snapshot]);
  const W = snapshot.calendar.weeks;
  const N = cells.length;

  const days = useMemo(() => {
    const eatenAt = new Map(geometry.snake.eats.map((e) => [`${e.x},${e.y}`, e.step]));
    const base = new BoxGeometry(1, 1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('normal', base.getAttribute('normal'));
    const index = new Float32Array(N);
    const cell = new Float32Array(N * 2);
    const count = new Float32Array(N);
    const level = new Float32Array(N);
    const before = new Float32Array(N);
    const eaten = new Float32Array(N);
    cells.forEach((c, i) => {
      index[i] = i;
      cell[i * 2] = c.x;
      cell[i * 2 + 1] = c.y;
      count[i] = c.count;
      level[i] = c.level;
      before[i] = c.beforeGenesis ? 1 : 0;
      eaten[i] = eatenAt.get(`${c.x},${c.y}`) ?? -1;
    });
    geo.setAttribute('aIndex', new InstancedBufferAttribute(index, 1));
    geo.setAttribute('aCell', new InstancedBufferAttribute(cell, 2));
    geo.setAttribute('aCount', new InstancedBufferAttribute(count, 1));
    geo.setAttribute('aLevel', new InstancedBufferAttribute(level, 1));
    geo.setAttribute('aBefore', new InstancedBufferAttribute(before, 1));
    geo.setAttribute('aEaten', new InstancedBufferAttribute(eaten, 1));
    geo.instanceCount = N;
    const material = new ShaderMaterial({
      vertexShader: genomeVert,
      fragmentShader: lineFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uMorph: { value: 0 },
        uDays: { value: N },
        uWeeks: { value: W },
        uSnake: { value: -1 },
        uFocus: { value: -1 },
        uOpacity: { value: 0 },
        uLevelColor: { value: levelColors.map((c) => new Color(c)) },
        uRed: { value: new Color(colors.red) },
      },
    });
    return { geo, material };
  }, [cells, geometry, N, W]);

  // Each public contribution becomes three particles bound for its repository's specimen.
  const flows = useMemo(() => {
    const from = [];
    const to = [];
    const seed = [];
    const priv = [];
    let n = 0;
    for (const day of snapshot.calendar.attribution) {
      const c = cells.find((x) => x.date === day.date);
      if (!c) continue;
      const [tx, tz] = terrainAt(c.x, c.y, W);
      const start = [tx, GENOME_Y + columnHeight(c.count), tz];
      const add = (target, isPrivate, times) => {
        for (let i = 0; i < times; i += 1) {
          from.push(...start);
          to.push(...target);
          seed.push(((n += 1) * 0.618034) % 1);
          priv.push(isPrivate);
        }
      };
      for (const part of day.parts) {
        const repo = repoByName(snapshot, part.repo);
        const at = repo && layout.get(repo.id);
        if (at) add(at.position, 0, part.count * 3);
      }
      if (day.unattributed) add([start[0] * 0.4, GENOME_Y + 9, start[2] - 2.5], 1, day.unattributed * 3);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(seed.length * 3), 3));
    geo.setAttribute('aFrom', new BufferAttribute(new Float32Array(from), 3));
    geo.setAttribute('aTo', new BufferAttribute(new Float32Array(to), 3));
    geo.setAttribute('aSeed', new BufferAttribute(new Float32Array(seed), 1));
    geo.setAttribute('aPrivate', new BufferAttribute(new Float32Array(priv), 1));
    const material = new ShaderMaterial({
      vertexShader: flowVert,
      fragmentShader: pointFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOn: { value: 0 },
        uPointSize: { value: 70 },
        uPixelRatio: { value: 1 },
        uCyan: { value: new Color(colors.cyan) },
        uBone: { value: new Color(colors.bone) },
        uMute: { value: new Color(colors.mute) },
      },
    });
    return { geo, material };
  }, [cells, layout, snapshot, W]);

  const backbone = useMemo(() => {
    const pts = new Float32Array(N * 2 * 3);
    const alpha = new Float32Array(N * 2);
    cells.forEach((c, i) => {
      const theta = i * 0.42;
      const y = helixY(i, N);
      for (let side = 0; side < 2; side += 1) {
        const a = theta + side * Math.PI;
        pts.set([RADIUS * Math.cos(a), y, RADIUS * Math.sin(a)], (i * 2 + side) * 3);
        alpha[i * 2 + side] = c.beforeGenesis ? 0.12 : 0.75;
      }
    });
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pts, 3));
    geo.setAttribute('aAlpha', new BufferAttribute(alpha, 1));
    const material = new ShaderMaterial({
      vertexShader: `uniform float uSize; uniform float uPixelRatio; uniform float uOpacity; uniform vec3 uColor; attribute float aAlpha;
        varying vec3 vColor; varying float vAlpha;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          vColor = uColor; vAlpha = uOpacity * aAlpha; gl_PointSize = uSize * uPixelRatio / max(0.5, -mv.z); }`,
      fragmentShader: pointFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uSize: { value: 38 }, uPixelRatio: { value: 1 }, uOpacity: { value: 0 }, uColor: { value: new Color(colors.bone) } },
    });
    return { geo, material };
  }, [cells, N]);

  const snakeParts = useMemo(() => {
    const geo = new BoxGeometry(PITCH * 0.86, 0.12, PITCH * 0.86);
    const head = new MeshBasicMaterial({ color: colors.red, transparent: true, blending: AdditiveBlending, depthWrite: false });
    const body = new MeshBasicMaterial({ color: colors.red, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false });
    return { geo, head, body };
  }, []);

  useEffect(
    () => () => {
      days.geo.dispose();
      days.material.dispose();
      flows.geo.dispose();
      flows.material.dispose();
      backbone.geo.dispose();
      backbone.material.dispose();
      snakeParts.geo.dispose();
      snakeParts.head.dispose();
      snakeParts.body.dispose();
    },
    [days, flows, backbone, snakeParts],
  );

  const group = useRef(null);
  const flowRef = useRef(null);
  const segments = useRef([]);
  const clock = useRef(0);
  const picked = useRef(null);

  const raycaster = useMemo(() => new Raycaster(), []);
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), -GENOME_Y), []);

  const pick = useCallback(
    (p) => {
      if (!p || timeline.t < 2.12 || timeline.t > 2.95) return null;
      if (days.material.uniforms.uMorph.value > 0.6) {
        raycaster.setFromCamera(new Vector2((p.x / size.width) * 2 - 1, -(p.y / size.height) * 2 + 1), camera);
        const hit = new Vector3();
        if (!raycaster.ray.intersectPlane(plane, hit)) return null;
        const cy = Math.round(hit.x / PITCH + 3);
        const cx = Math.round(W - 1 + (hit.z - NEAR) / PITCH);
        return cells.find((c) => c.x === cx && c.y === cy) ?? null;
      }
      const screen = { x: 0, y: 0, z: 0 };
      const v = new Vector3();
      let best = null;
      let bestD = 14 * 14;
      cells.forEach((c, i) => {
        const theta = i * 0.42;
        v.set(RADIUS * Math.cos(theta), GENOME_Y + helixY(i, N), RADIUS * Math.sin(theta));
        toScreen(v, camera, size, screen);
        if (screen.z > 1) return;
        const d = (screen.x - p.x) ** 2 + (screen.y - p.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      });
      return best;
    },
    [camera, cells, days, N, plane, raycaster, size, W],
  );

  const onMove = useCallback(
    (p) => {
      const cell = pick(p);
      const id = cell?.date ?? null;
      if (id === picked.current) return;
      picked.current = id;
      store.actions.focusDay(id);
      if (!cell) {
        if (store.get().hover?.kind === 'day') store.actions.hover(null);
        return;
      }
      const day = snapshot.calendar.attribution.find((d) => d.date === cell.date);
      const detail = cell.beforeGenesis ? 'before the account existed' : cell.count ? [plural(cell.count, 'contribution'), ...describeAttribution(snapshot, day)].join(' · ') : 'no contributions';
      store.actions.hover({ kind: 'day', id: cell.date, label: formatDate(cell.date), detail, source: 'scene' });
    },
    [pick, snapshot, store],
  );
  useCanvasPointer({ onMove });

  useFrame((_, delta) => {
    const t = timeline.t;
    const show = Math.max(presence(t, 2.14, 2.9, 0.3), presence(t, 4.2, 5.2, 0.3));
    if (group.current) group.current.visible = show > 0.001;
    if (flowRef.current) flowRef.current.visible = show > 0.001;
    if (show <= 0.001) return;
    const dt = Math.min(delta, 0.05);
    if (motion) clock.current += dt;
    const u = days.material.uniforms;
    // Playing or paused, the snake holds the terrain view; once done, the scroll leads again,
    // and the eaten days stay eaten until the snake is reset.
    const running = (snake === 'playing' || snake === 'paused') && t < 3.5;
    const eatenShown = snake !== 'idle' && t < 3.5;
    const goal = running ? 1 : t > 3.6 ? 0 : smooth(2.44, 2.6, t);
    u.uMorph.value = motion ? u.uMorph.value + (goal - u.uMorph.value) * Math.min(1, dt * 3) : goal;
    u.uOpacity.value = show;
    u.uSnake.value = eatenShown ? snakeClock.step : -1;
    u.uFocus.value = dayFocus ? cells.findIndex((c) => c.date === dayFocus) : -1;

    backbone.material.uniforms.uOpacity.value = show * (1 - u.uMorph.value);
    backbone.material.uniforms.uPixelRatio.value = dpr;
    flows.material.uniforms.uTime.value = clock.current;
    flows.material.uniforms.uOn.value = running ? 0 : smooth(2.7, 2.82, t) * (1 - smooth(3.0, 3.18, t));
    flows.material.uniforms.uPixelRatio.value = dpr;

    // The snake glides between cells on the terrain.
    const path = snakeClock.path;
    segments.current.forEach((mesh, j) => {
      if (!mesh) return;
      mesh.visible = Boolean(running && path);
      if (!mesh.visible) return;
      const s = Math.max(0, snakeClock.step - j);
      const a = path[Math.min(path.length - 1, Math.floor(s))];
      const b = path[Math.min(path.length - 1, Math.ceil(s))];
      const f = s - Math.floor(s);
      const x = a[0] + (b[0] - a[0]) * f;
      const y = a[1] + (b[1] - a[1]) * f;
      const [sx, sz] = terrainAt(x, y, W);
      mesh.position.set(sx, 0.08, sz);
    });
  });

  return (
    <>
      <group ref={group} position={[0, GENOME_Y, 0]}>
        <mesh geometry={days.geo} material={days.material} frustumCulled={false} />
        <points geometry={backbone.geo} material={backbone.material} frustumCulled={false} />
        {[0, 1, 2, 3].map((j) => (
          <mesh key={j} ref={(el) => (segments.current[j] = el)} geometry={snakeParts.geo} material={j === 0 ? snakeParts.head : snakeParts.body} visible={false} />
        ))}
      </group>
      <points ref={flowRef} geometry={flows.geo} material={flows.material} frustumCulled={false} />
    </>
  );
}
