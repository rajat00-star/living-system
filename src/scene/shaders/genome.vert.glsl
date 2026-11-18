// FIG. 03: the real calendar, one instanced box per day, placed twice on the GPU:
//   helix    a ladder of rungs, one per day, newest at the top; lit rungs are the days
//            with contributions, and the account's whole life sits in the upper turns
//   terrain  GitHub's own grid, weekdays across and weeks receding into the distance,
//            today nearest; height from the day's count
// uMorph moves every day from one to the other, unwinding from the newest day back.

uniform float uMorph;
uniform float uDays;
uniform float uWeeks;
uniform float uSnake;       // the snake's step, fractional; -1 when it is not running
uniform float uFocus;       // index of the day under the pointer, or -1
uniform float uOpacity;
uniform vec3 uLevelColor[5];
uniform vec3 uRed;

attribute float aIndex;
attribute vec2 aCell;       // week, weekday
attribute float aCount;
attribute float aLevel;
attribute float aBefore;    // 1 for days before the account existed
attribute float aEaten;     // the snake step that eats this day, or -1

varying vec3 vColor;
varying float vAlpha;

const float PITCH = 0.3;
const float RADIUS = 1.35;
const float RISE = 0.05;
const float NEAR = 2.0;

void main() {
  float isLit = step(0.5, aCount);

  // Helix: a rung through the axis, turned by the day's angle.
  float theta = aIndex * 0.42;
  float y = (aIndex - (uDays - 1.0)) * RISE + 2.6;
  float thick = mix(0.026, 0.075, isLit);
  vec3 local = position * vec3(2.0 * RADIUS * mix(0.92, 1.0, isLit), thick, thick);
  float c = cos(theta);
  float s = sin(theta);
  vec3 helix = vec3(local.x * c - local.z * s, local.y + y, local.x * s + local.z * c);

  // Terrain: the calendar grid. Eaten days collapse to the floor.
  float eaten = (aEaten >= 0.0 && uSnake >= aEaten) ? 1.0 : 0.0;
  float h = isLit > 0.5 ? 0.14 + log(1.0 + aCount) * 0.62 : 0.035;
  h = mix(h, 0.02, eaten);
  vec3 terrain = vec3((aCell.y - 3.0) * PITCH, h * 0.5, NEAR - (uWeeks - 1.0 - aCell.x) * PITCH) + position * vec3(PITCH * 0.78, h, PITCH * 0.78);

  float k = clamp(uMorph * 1.7 - (1.0 - aIndex / uDays) * 0.7, 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  vec3 p = mix(helix, terrain, k);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);

  vec3 colour = uLevelColor[int(aLevel + 0.5)];
  float flash = aEaten >= 0.0 && uSnake >= aEaten ? clamp(1.0 - (uSnake - aEaten) / 5.0, 0.0, 1.0) : 0.0;
  float focus = step(abs(aIndex - uFocus), 0.5);
  colour = mix(colour, uRed, max(flash, focus));
  float alpha = aBefore > 0.5 ? 0.05 : (isLit > 0.5 ? 0.95 : 0.16);
  alpha = mix(alpha, 0.1 + flash * 0.9, eaten);
  // A little shading from the box's faces, so the terrain reads as volume.
  float shade = 0.62 + 0.38 * abs(normal.y) + 0.12 * normal.x;
  vColor = colour * shade;
  vAlpha = uOpacity * max(alpha, focus);
}
