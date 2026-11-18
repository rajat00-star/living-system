// FIG. 03, flow: every public contribution leaves its day and travels up the column to the
// repository it went to. Private or unattributable ones rise and fade with no destination,
// because none is public.

uniform float uTime;
uniform float uOn;
uniform float uPointSize;
uniform float uPixelRatio;
uniform vec3 uCyan;
uniform vec3 uBone;
uniform vec3 uMute;

attribute vec3 aFrom;
attribute vec3 aTo;
attribute float aSeed;
attribute float aPrivate;

varying vec3 vColor;
varying float vAlpha;

void main() {
  float k = fract(uTime * 0.09 + aSeed);
  vec3 ctrl = vec3(aFrom.x * 0.5, mix(aFrom.y, aTo.y, 0.45) + 1.5, aFrom.z * 0.5 + 1.0);
  vec3 p = (1.0 - k) * (1.0 - k) * aFrom + 2.0 * (1.0 - k) * k * ctrl + k * k * aTo;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float edge = smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(0.86, 1.0, k));
  vColor = aPrivate > 0.5 ? uMute : mix(uCyan, uBone, k);
  vAlpha = uOn * edge * (aPrivate > 0.5 ? 0.6 * (1.0 - k) : 0.95);
  gl_PointSize = uPointSize * uPixelRatio * (aPrivate > 0.5 ? 0.7 : 1.0) / max(0.5, -mv.z);
}
