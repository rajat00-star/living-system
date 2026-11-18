// Glyphs as signed distances: ring and dot for a repository, then disc (language),
// square (framework), ring (infrastructure) and triangle (AI/ML). Shape carries the class,
// so it never depends on colour alone.
varying vec3 vColor;
varying float vAlpha;
varying float vKind;

float triangle(vec2 p, float r) {
  const float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  p.y = -p.y;
  float r = length(p);
  float a;
  if (vKind < 0.5) {
    a = max(smoothstep(0.09, 0.0, abs(r - 0.8)), smoothstep(0.32, 0.2, r));
  } else if (vKind < 1.5) {
    a = smoothstep(0.62, 0.5, r);
  } else if (vKind < 2.5) {
    vec2 q = abs(p);
    a = smoothstep(0.56, 0.46, max(q.x, q.y));
  } else if (vKind < 3.5) {
    a = smoothstep(0.11, 0.0, abs(r - 0.5));
  } else {
    a = smoothstep(0.05, -0.04, triangle(p + vec2(0.0, 0.12), 0.62));
  }
  gl_FragColor = vec4(vColor, a * vAlpha);
  #include <colorspace_fragment>
}
