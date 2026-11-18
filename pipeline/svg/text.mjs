// Type for SVGs that GitHub shows as <img>. An image cannot load web fonts, so text is
// set from the site's own font files as vector outlines. Each glyph is outlined once per
// image and reused with <use>, which keeps text-heavy plates small. The words stay
// available to assistive technology through every image's alt text and <title>.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import opentype from 'opentype.js';

const require = createRequire(import.meta.url);
const fonts = {};
const UNIT = 100; // glyphs are outlined at this size and scaled per use

const FILES = {
  serif: '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff',
  serifItalic: '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff',
  mono: '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff',
  monoMedium: '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff',
};
const KEYS = Object.keys(FILES);

export async function loadFonts() {
  for (const [name, file] of Object.entries(FILES)) {
    if (fonts[name]) continue;
    const buffer = await readFile(require.resolve(file));
    fonts[name] = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  }
}

export const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n1 = (value) => Math.round(value * 10) / 10;
const n3 = (value) => Math.round(value * 1000) / 1000;

// The Latin subsets of these fonts have no arrows, so → is drawn here, sized to sit on
// the mono font's middle line. It is an outline at the UNIT size, like every other glyph.
const SYMBOLS = {
  '→': { d: 'M8 -31.5H44V-26.5H8ZM39 -40L55 -29L39 -18L36 -21.5L47 -29L36 -36.5Z', advance: 60 },
};

// Lays a line out glyph by glyph (one per character, so no ligature can hide a symbol),
// with the font's kerning and any letter spacing. Positions are in UNIT space.
function layout(font, value, tracking) {
  const f = fonts[font];
  const scale = UNIT / f.unitsPerEm;
  const chars = [...value];
  const items = [];
  let x = 0;
  let previous = null;
  for (const char of chars) {
    const glyph = f.charToGlyph(char);
    const missing = !glyph || glyph.index === 0;
    if (previous && !missing) x += f.getKerningValue(previous, glyph) * scale;
    if (missing && SYMBOLS[char]) {
      items.push({ symbol: char, x });
      x += SYMBOLS[char].advance;
      previous = null;
    } else {
      items.push({ glyph, x });
      x += glyph.advanceWidth * scale;
      previous = glyph;
    }
    x += tracking * UNIT;
  }
  return { items, width: x - (chars.length ? tracking * UNIT : 0) };
}

export function measure(content, { font = 'mono', size = 12, tracking = 0, upper = false } = {}) {
  const value = upper ? String(content).toUpperCase() : String(content);
  return (layout(font, value, tracking).width * size) / UNIT;
}

export function wrap(content, width, options = {}) {
  const words = String(content).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, options) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// One typesetter per image: it remembers which glyphs were used and emits their
// outlines once, in <defs>.
export function typesetter() {
  const used = new Map();

  function glyphId(fontKey, glyph) {
    const id = `g${KEYS.indexOf(fontKey)}-${glyph.index}`;
    if (!used.has(id)) used.set(id, glyph.getPath(0, 0, UNIT).toPathData(1));
    return id;
  }

  function text(content, x, y, { font = 'mono', size = 12, fill = '#e9eef1', opacity = 1, anchor = 'start', tracking = 0, upper = false } = {}) {
    const value = upper ? String(content).toUpperCase() : String(content);
    if (!value) return '';
    const { items, width: unitWidth } = layout(font, value, tracking);
    const width = (unitWidth * size) / UNIT;
    const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
    const uses = [];
    for (const item of items) {
      if (item.symbol) {
        const id = `s${item.symbol.codePointAt(0)}`;
        if (!used.has(id)) used.set(id, SYMBOLS[item.symbol].d);
        uses.push(`<use href="#${id}" x="${n1(item.x)}"/>`);
      } else if (item.glyph.path?.commands?.length) {
        uses.push(`<use href="#${glyphId(font, item.glyph)}" x="${n1(item.x)}"/>`);
      }
    }
    const k = n3(size / UNIT);
    return `<g transform="translate(${n1(left)} ${n1(y)}) scale(${k})" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}>${uses.join('')}</g>`;
  }

  function paragraph(content, x, y, width, { lineHeight = 1.4, maxLines = Infinity, ...options } = {}) {
    let lines = wrap(content, width, options);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[maxLines - 1];
      while (last && measure(`${last}…`, options) > width) last = last.split(' ').slice(0, -1).join(' ');
      lines[maxLines - 1] = `${last}…`;
    }
    const size = options.size ?? 12;
    return {
      svg: lines.map((line, i) => text(line, x, y + i * size * lineHeight, options)).join(''),
      height: lines.length * size * lineHeight,
      lines: lines.length,
    };
  }

  const defs = () => [...used].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('');

  return { text, paragraph, defs };
}
