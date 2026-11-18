// A soft round point for additive blending. Shared by the Core, the dendrites and the flows.
varying vec3 vColor;
varying float vAlpha;

void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, r);
  gl_FragColor = vec4(vColor, a * a * vAlpha);
  #include <colorspace_fragment>
}
