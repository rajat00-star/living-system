// FIG. 04: one point per node of the technology network. Repositories are larger rings;
// technologies take their class's glyph. aState is set on the CPU when focus changes:
// 0 normal, 1 focused, 2 linked to the focus, 3 dimmed.

uniform float uPointSize;
uniform float uPixelRatio;
uniform float uOpacity;
uniform vec3 uKindColor[5];   // repository, language, framework, infrastructure, AI/ML
uniform vec3 uRed;

attribute float aKind;
attribute float aSize;
attribute float aState;

varying vec3 vColor;
varying float vAlpha;
varying float vKind;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float focused = step(abs(aState - 1.0), 0.5);
  float dim = step(2.5, aState);
  vColor = mix(uKindColor[int(aKind + 0.5)], uRed, focused);
  vAlpha = uOpacity * mix(1.0, 0.22, dim);
  vKind = aKind;
  gl_PointSize = uPointSize * aSize * uPixelRatio * (1.0 + focused * 0.45) / max(0.5, -mv.z);
}
