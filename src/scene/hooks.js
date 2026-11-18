import { useThree } from '@react-three/fiber';
import { useEffect, useSyncExternalStore } from 'react';
import { Vector3 } from 'three';
import { timeline } from '../lib/timeline.js';

// The page's store, read from inside the Canvas. Selectors return primitives.
export function useSlice(store, selector) {
  const read = () => selector(store.get());
  return useSyncExternalStore(store.subscribe, read, read);
}

// Pointer and click on the canvas, in CSS pixels, for the figures' own picking.
// Picking is analytic (projected centres, a ray on a plane), never a scene-wide raycast.
export function useCanvasPointer({ onMove, onClick, onDown, onUp } = {}) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const el = gl.domElement;
    const rect = () => el.getBoundingClientRect();
    const local = (event) => {
      const r = rect();
      return { x: event.clientX - r.left, y: event.clientY - r.top, w: r.width, h: r.height };
    };
    const move = (event) => onMove?.(local(event), event);
    const leave = () => onMove?.(null);
    const click = (event) => onClick?.(local(event), event);
    const down = (event) => onDown?.(local(event), event);
    const up = (event) => onUp?.(local(event), event);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('click', click);
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('click', click);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
    };
  }, [gl, onMove, onClick, onDown, onUp]);
}

const scratch = new Vector3();

// A world point to CSS pixels on the canvas; z > 1 means behind the camera.
export function toScreen(point, camera, size, out = { x: 0, y: 0, z: 0 }) {
  scratch.copy(point).project(camera);
  out.x = (scratch.x * 0.5 + 0.5) * size.width;
  out.y = (-scratch.y * 0.5 + 0.5) * size.height;
  out.z = scratch.z;
  return out;
}

// Which figure is on screen, as a weight from 0 to 1, for the current scroll time.
export const figureTime = () => timeline.t;
