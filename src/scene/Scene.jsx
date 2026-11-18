import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, LineBasicMaterial, Vector3 } from 'three';
import { loadGeometry } from '../lib/geometry.js';
import { timeline } from '../lib/timeline.js';
import { colors } from '../lib/tokens.js';
import { Core } from './Core.jsx';
import { Genome } from './Genome.jsx';
import { Network } from './Network.jsx';
import { Specimens } from './Specimens.jsx';
import { useSlice } from './hooks.js';
import { cameraAt, cameraKeys, presence, specimenLayout } from './layout.js';

const TIERS = ['low', 'medium', 'high'];
const MAX_DPR = { high: 2, medium: 1.5, low: 1 };

function initialQuality() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 8;
  return coarse || cores <= 4 || memory <= 4 ? 'medium' : 'high';
}

// Measured, not guessed: average frame time over windows of 90 frames. Slow windows step the
// quality down (fewer samples, lower resolution, then no post-processing); one fast window
// may step it back up. The first windows are ignored while shaders compile.
function Quality({ store }) {
  const setDpr = useThree((state) => state.setDpr);
  const quality = useSlice(store, (s) => s.quality);
  const acc = useRef({ frames: 0, time: 0, upgrades: 0, cooldown: 2 });

  useFrame((_, delta) => {
    if (document.hidden) return;
    const a = acc.current;
    a.frames += 1;
    a.time += Math.min(delta, 0.25);
    if (a.frames < 90) return;
    const average = a.time / a.frames;
    a.frames = 0;
    a.time = 0;
    if (a.cooldown > 0) {
      a.cooldown -= 1;
      return;
    }
    const i = TIERS.indexOf(store.get().quality);
    if (average > 1 / 40 && i > 0) {
      store.set({ quality: TIERS[i - 1] });
      a.cooldown = 2;
    } else if (average < 1 / 58 && i < TIERS.length - 1 && a.upgrades < 1) {
      store.set({ quality: TIERS[i + 1] });
      a.upgrades += 1;
      a.cooldown = 3;
    }
  });

  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio || 1, MAX_DPR[quality]));
  }, [quality, setDpr]);
  return null;
}

// The camera follows the scroll timeline through keyframes, eases toward a selected
// specimen, and leans a little with the pointer. With motion off it cuts instead of flying.
function Rig({ store, layout }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const motion = useSlice(store, (s) => s.prefs.motion);
  const selected = useSlice(store, (s) => s.selected);
  const keys = useMemo(() => cameraKeys(size.width / Math.max(1, size.height)), [size]);
  const r = useRef(null);
  if (!r.current) {
    r.current = { pos: new Vector3(), target: new Vector3(), goalPos: new Vector3(), goalTarget: new Vector3(), p: [0, 0, 0], q: [0, 0, 0], sp: [0, 0, 0], sq: [0, 0, 0], sel: 0, snake: 0, focus: new Vector3(), focusPos: new Vector3(), ready: false };
  }

  useFrame((_, delta) => {
    const s = r.current;
    const dt = Math.min(delta, 0.05);
    cameraAt(timeline.t, keys, s.p, s.q);
    s.goalPos.set(s.p[0], s.p[1], s.p[2]);
    s.goalTarget.set(s.q[0], s.q[1], s.q[2]);

    // While the snake runs, FIG. 03 holds the terrain view whatever the scroll says.
    const { snake } = store.get();
    const snaking = (snake === 'playing' || snake === 'paused') && timeline.t > 2.0 && timeline.t < 3.05;
    s.snake += ((snaking ? 1 : 0) - s.snake) * (motion ? 1 - Math.exp(-dt * 2.4) : 1);
    if (s.snake > 0.001) {
      cameraAt(2.66, keys, s.sp, s.sq);
      s.goalPos.lerp(new Vector3(...s.sp), s.snake);
      s.goalTarget.lerp(new Vector3(...s.sq), s.snake);
    }

    const at = selected ? layout.get(selected) : null;
    s.sel += ((at ? 1 : 0) - s.sel) * (motion ? 1 - Math.exp(-dt * 2.4) : 1);
    if (at) {
      const c = s.focus.set(...at.position);
      const out = new Vector3(c.x, 0, c.z).normalize();
      const dist = 4.3 * at.scale + 3;
      s.focusPos.copy(c).addScaledVector(out, dist).add(new Vector3(0, 0.9 * at.scale + 0.5, 0));
      const forward = new Vector3().subVectors(c, s.focusPos).normalize();
      const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
      if (size.width > 760) c.addScaledVector(right, dist * 0.16);
      else c.y -= dist * 0.28;
    }
    if (s.sel > 0.001) {
      s.goalPos.lerp(s.focusPos, s.sel);
      s.goalTarget.lerp(s.focus, s.sel);
    }
    if (motion && timeline.pointer.active) {
      s.goalPos.x += timeline.pointer.x * 0.5;
      s.goalPos.y -= timeline.pointer.y * 0.3;
    }
    if (!s.ready || !motion) {
      s.pos.copy(s.goalPos);
      s.target.copy(s.goalTarget);
      s.ready = true;
    } else {
      const k = 1 - Math.exp(-dt * 3.4);
      s.pos.lerp(s.goalPos, k);
      s.target.lerp(s.goalTarget, k);
    }
    camera.position.copy(s.pos);
    camera.lookAt(s.target);
  });
  return null;
}

function Pointer() {
  useEffect(() => {
    const move = (event) => {
      timeline.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      timeline.pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
      timeline.pointer.active = event.pointerType !== 'touch';
    };
    const leave = () => {
      timeline.pointer.active = false;
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, []);
  return null;
}

// Red means live: when the browser has fresh data from GitHub, the whole organism shows
// a slow heartbeat in the final view, a ring leaving the core every few seconds.
function Heartbeat({ store }) {
  const live = useSlice(store, (s) => s.live.status === 'ok');
  const motion = useSlice(store, (s) => s.prefs.motion);
  const ring = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 96; i += 1) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(Math.cos(a), 0, Math.sin(a));
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
    return { geometry, material: new LineBasicMaterial({ color: colors.red, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }) };
  }, []);
  useEffect(() => () => (ring.geometry.dispose(), ring.material.dispose()), [ring]);
  const ref = useRef(null);
  const clock = useRef(0);
  useFrame((_, delta) => {
    const show = live ? presence(timeline.t, 4.25, 5.2, 0.3) : 0;
    if (ref.current) ref.current.visible = show > 0.001;
    if (show <= 0.001) return;
    if (motion) clock.current += Math.min(delta, 0.05);
    const k = motion ? (clock.current / 3.2) % 1 : 0.35;
    ref.current.scale.setScalar(2.4 + k * 9);
    ring.material.opacity = show * (1 - k) * 0.85;
  });
  return <lineLoop ref={ref} geometry={ring.geometry} material={ring.material} frustumCulled={false} />;
}

// Reports readiness once real frames of the scene have been drawn, so the still plate
// hands over to the living one without a blank moment.
function Ready({ store }) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 3) store.set({ sceneReady: true, webgl: 'ready' });
  });
  return null;
}

function Post({ quality }) {
  if (quality === 'low') return null;
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur intensity={quality === 'high' ? 1.05 : 0.8} luminanceThreshold={0.14} luminanceSmoothing={0.3} radius={0.72} />
      <Noise opacity={0.03} premultiply />
      <Vignette offset={0.2} darkness={0.8} />
    </EffectComposer>
  );
}

export function Scene({ store, snapshot }) {
  const [geometry, setGeometry] = useState(null);
  const quality = useSlice(store, (s) => s.quality);
  const layout = useMemo(() => specimenLayout(snapshot), [snapshot]);

  useEffect(() => {
    store.set({ quality: initialQuality() });
    let cancelled = false;
    loadGeometry(snapshot.generatedAt)
      .then((g) => !cancelled && setGeometry(g))
      .catch(() => !cancelled && store.set({ webgl: 'unavailable' }));
    return () => {
      cancelled = true;
      store.set({ sceneReady: false });
    };
  }, [snapshot, store]);

  return (
    <Canvas
      flat
      dpr={1}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }}
      camera={{ fov: 36, near: 0.1, far: 400, position: [0, 1.5, 9.4] }}
      onCreated={({ gl }) => {
        gl.setClearColor(colors.void, 1);
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          store.set({ webgl: 'lost', sceneReady: false });
        });
      }}
    >
      <Pointer />
      <Quality store={store} />
      <Rig store={store} layout={layout} />
      {geometry ? (
        <>
          <Core store={store} snapshot={snapshot} geometry={geometry} layout={layout} quality={quality} />
          <Specimens store={store} snapshot={snapshot} geometry={geometry} layout={layout} />
          <Genome store={store} snapshot={snapshot} geometry={geometry} layout={layout} />
          <Network store={store} snapshot={snapshot} geometry={geometry} />
          <Heartbeat store={store} />
          <Ready store={store} />
        </>
      ) : null}
      <Post quality={quality} />
    </Canvas>
  );
}
