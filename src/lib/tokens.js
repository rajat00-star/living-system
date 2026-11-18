// The Living System's palette. CSS mirrors these as custom properties in
// src/styles/tokens.css; the shaders and the README plates read them from here.
//
// Cyan and white carry structure. Red is reserved for live signals and selection,
// the inverse of the portfolio, where red dominates.
export const colors = {
  void: '#030405',
  ink: '#090b0d',
  panel: '#0c0f12',
  bone: '#e9eef1',
  bone2: '#b9c2c8',
  mute: '#7d8a93',
  faint: '#3a444b',
  cyan: '#6fe3ff',
  cyanDeep: '#1d6f82',
  red: '#ff3b4e',
};

// What each file class looks like in the Core: source bright, documentation cyan,
// configuration grey, media and the rest faint.
export const fileClassColors = [colors.bone, colors.cyan, colors.mute, colors.faint];
export const fileClassNames = ['source', 'documentation', 'configuration and data', 'media and other'];

// The contribution levels GitHub assigns, as a cyan ramp ending in white.
export const levelColors = ['#0d1215', '#12424d', '#1d8aa0', '#6fe3ff', '#e9fbff'];

// Technology classes differ first by glyph (disc, square, ring, triangle) and only then
// by tone, so they stay distinct without spending red, which means "live" or "selected".
export const techClassColors = {
  language: colors.bone,
  framework: colors.cyan,
  infrastructure: colors.mute,
  ai: '#c8f6ff',
};
export const techClassGlyphs = { language: 'disc', framework: 'square', infrastructure: 'ring', ai: 'triangle' };
