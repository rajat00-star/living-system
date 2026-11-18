// Sound, synthesised with the Web Audio API: no audio files. Off at the start of every
// visit; the audio engine is created only after a click on the sound switch.
//
// The palette is glass and sine, not the portfolio's mallet and crackle: a near-silent
// drone, a soft FM ping tuned by what is under the pointer, a fifth when something opens,
// a filtered sweep between figures, and a click when the snake eats.

let ctx = null;
let master = null;
let drone = null;
let enabled = false;
let lastPing = 0;

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16]; // major pentatonic over two octaves

function engine() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  master.connect(comp).connect(ctx.destination);
  return ctx;
}

function startDrone() {
  if (!ctx || drone) return;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 0.006;
  lfo.connect(lfoGain).connect(gain.gain);
  const oscs = [55, 82.41, 110.3].map((f, i) => {
    const o = ctx.createOscillator();
    o.type = i === 2 ? 'triangle' : 'sine';
    o.frequency.value = f;
    o.detune.value = i * 4;
    o.connect(filter);
    o.start();
    return o;
  });
  filter.connect(gain).connect(master);
  lfo.start();
  gain.gain.setTargetAtTime(0.014, ctx.currentTime, 1.5);
  drone = { gain, oscs, lfo };
}

function stopDrone() {
  if (!drone || !ctx) return;
  const { gain, oscs, lfo } = drone;
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  setTimeout(() => {
    oscs.forEach((o) => o.stop());
    lfo.stop();
  }, 1200);
  drone = null;
}

export function setSound(on) {
  enabled = on;
  if (on) {
    if (!engine()) return false;
    ctx.resume?.();
    startDrone();
  } else {
    stopDrone();
  }
  return true;
}

function tone({ freq, type = 'sine', attack = 0.005, decay = 0.25, gain = 0.05, fm = 0, at = 0 }) {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (fm) {
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    mod.frequency.value = freq * 2.01;
    modGain.gain.setValueAtTime(freq * fm, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + decay);
    mod.connect(modGain).connect(osc.frequency);
    mod.start(t);
    mod.stop(t + decay + 0.05);
  }
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

export const sfx = {
  // Hover: rate-limited so sweeping across many objects never chatters.
  ping(step = 0) {
    const now = performance.now();
    if (now - lastPing < 70) return;
    lastPing = now;
    tone({ freq: 523.25 * 2 ** (SCALE[Math.abs(step) % SCALE.length] / 12), decay: 0.22, gain: 0.03, fm: 1.2 });
  },
  open() {
    tone({ freq: 392, attack: 0.03, decay: 0.9, gain: 0.045 });
    tone({ freq: 587.33, attack: 0.05, decay: 1.1, gain: 0.035, at: 0.06 });
  },
  close() {
    tone({ freq: 587.33, attack: 0.01, decay: 0.3, gain: 0.03 });
    tone({ freq: 392, attack: 0.01, decay: 0.4, gain: 0.025, at: 0.05 });
  },
  sweep() {
    if (!enabled || !ctx) return;
    const t = ctx.currentTime;
    const length = 0.7;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * length), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(380, t);
    filter.frequency.exponentialRampToValueAtTime(2600, t + length);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.03, t + 0.2);
    env.gain.linearRampToValueAtTime(0, t + length);
    source.connect(filter).connect(env).connect(master);
    source.start(t);
  },
  bite(level = 1) {
    tone({ freq: 196 * 2 ** ((level * 3) / 12), type: 'triangle', decay: 0.12, gain: 0.05 });
  },
};
