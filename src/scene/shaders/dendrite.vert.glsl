// FIG. 02: a repository's directory tree, grown from its root. Used for both the branches
// (lines) and the files (points). Each vertex knows its depth, so the tree can grow
// outward as the specimen arrives, and its top-level folders, so a layer named in the
// specimen plate can light up exactly the branches it describes.

uniform float uGrow;        // 0 seed, 1 fully grown
uniform float uOpacity;
uniform float uHot;         // hovered or selected: brighter
uniform float uFocus;       // folder group to light, or -1
uniform float uPointSize;
uniform float uPixelRatio;
uniform vec3 uBase;
uniform vec3 uCyan;
uniform vec3 uRed;
uniform vec3 uClassColor[4];
uniform float uIsPoints;

attribute float aDepth;     // 0 at the root, 1 at the deepest file
attribute float aClass;     // file class for points, -1 for branches
attribute vec2 aGroup;      // ids of the depth-1 and depth-2 folders this vertex sits in

varying vec3 vColor;
varying float vAlpha;

void main() {
  float shown = smoothstep(aDepth, aDepth + 0.18, uGrow * 1.18);
  vec3 p = position * (0.35 + 0.65 * shown);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float focused = uFocus < 0.0 ? 0.0 : max(step(abs(aGroup.x - uFocus), 0.5), step(abs(aGroup.y - uFocus), 0.5));
  float dim = uFocus < 0.0 ? 1.0 : mix(0.25, 1.0, focused);

  vec3 base = aClass < 0.0 ? uBase : uClassColor[int(aClass + 0.5)];
  vColor = mix(mix(base, uCyan, uHot * 0.35), uRed, focused * 0.9);
  float strength = aClass < 0.0 ? 0.26 : 0.8;
  vAlpha = uOpacity * shown * dim * strength * (1.0 + uHot * 0.9 + focused * 1.6);
  gl_PointSize = uIsPoints * uPointSize * uPixelRatio * (1.0 + focused * 0.6) / max(0.5, -mv.z);
}
