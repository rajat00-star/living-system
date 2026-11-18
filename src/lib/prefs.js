// Visitor preferences: motion, sound and 3D. Each is remembered in this browser only, and
// every storage call is guarded: private windows and blocked storage simply forget.
export const KEYS = { motion: 'living-system:motion', sound: 'living-system:sound', three: 'living-system:3d' };

export function readPref(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
}

// Runs before first paint (inlined in <head>). It decides motion and whether the 3D layer
// will run, so the layout never shifts when JavaScript arrives. WebGL 2 is required (three.js
// no longer supports WebGL 1). Only the API's presence is checked here: creating a context
// to test it would block the first paint, and a context that fails later is caught by the
// stage, which falls back to the still plates.
export const earlyScript = `(function(){var d=document.documentElement;d.classList.add('js');function g(k){try{return localStorage.getItem(k)}catch(e){return null}}var m=g(${JSON.stringify(KEYS.motion)});var on=m==='on'||(m!=='off'&&!matchMedia('(prefers-reduced-motion: reduce)').matches);d.dataset.motion=on?'on':'off';var gl=!!window.WebGL2RenderingContext;d.dataset.webgl=gl?'yes':'no';if(gl&&g(${JSON.stringify(KEYS.three)})!=='off')d.classList.add('has-3d');setTimeout(function(){if(!d.classList.contains('hydrated'))d.classList.add('no-hydrate')},8000)})();`;

export function initialPrefs() {
  if (typeof document === 'undefined') return { motion: true, sound: false, three: true };
  const d = document.documentElement;
  return {
    motion: d.dataset.motion !== 'off',
    sound: false, // sound always starts off; the audio engine is created only after a click
    three: d.classList.contains('has-3d'),
  };
}
