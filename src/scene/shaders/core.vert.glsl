// FIG. 01, the Core: one point per sample of each Hopf fibre, placed entirely on the GPU.
// Same arithmetic as src/lib/hopf.js:
//   z1 = sin(eta) e^{i(t + alpha)},  z2 = cos(eta) e^{i t}, rotated in 4-space, then
//   projected stereographically from (0, 0, 0, 1) and turned so the tori lie flat.

uniform float uFlow;          // advances along every fibre: the particles' circulation
uniform mat4 uRot4;           // 4-space rotation: slow drift plus the pointer
uniform float uScale;
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uOpacity;
uniform float uDissociate;    // 0 nested core, 1 every torus at its specimen
uniform vec3 uSlots[TORI];    // where each torus goes when the core separates; TORI is set from the data
uniform float uHighlight;     // index of the torus under the pointer, or -1
uniform vec3 uClassColor[4];
uniform float uClassAlpha[4];
uniform vec3 uRed;

attribute float aT;           // position along the fibre, with a per-fibre phase
attribute float aClass;       // 0 source, 1 docs, 2 config, 3 media

varying vec3 vColor;
varying float vAlpha;

// `position` carries the fibre, not a point: (eta, alpha, torus index).
void main() {
  float eta = position.x;
  float alpha = position.y;
  float torus = position.z;
  float speed = 0.55 + 0.45 * fract(sin(alpha * 91.7 + torus * 13.1) * 43758.5453);
  float t = aT + uFlow * speed;

  vec4 p = vec4(sin(eta) * cos(t + alpha), sin(eta) * sin(t + alpha), cos(eta) * cos(t), cos(eta) * sin(t));
  p = uRot4 * p;
  float k = 1.0 / max(1.0 - p.w, 0.04);
  vec3 pos = vec3(p.x, p.z, -p.y) * k * uScale;

  int ti = int(torus + 0.5);
  pos = mix(pos, uSlots[ti] + pos * 0.3, uDissociate);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  int ci = int(aClass + 0.5);
  float lit = uHighlight < 0.0 ? 1.0 : (abs(torus - uHighlight) < 0.5 ? 1.0 : 0.22);
  float hot = uHighlight >= 0.0 && abs(torus - uHighlight) < 0.5 ? 1.0 : 0.0;
  // Points thrown far out through the projection pole fade, so the core stays legible.
  float reach = clamp(3.4 / k, 0.0, 1.0);
  vColor = mix(uClassColor[ci], uRed, hot * 0.85);
  vAlpha = uOpacity * reach * reach * lit * uClassAlpha[ci];
  gl_PointSize = uPointSize * uPixelRatio * (1.0 + 0.5 * hot) / max(0.5, -mv.z);
}
