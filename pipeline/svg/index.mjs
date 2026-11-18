// The plates: flat drawings of the Living System for the GitHub README and for visitors
// without WebGL. Drawn from the same snapshot as the 3D scene, in the same type and colour.
// They are images and say so; none of them pretends to be interactive.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { formatBytes, formatDate, formatInt, percent, plateNumber, plural } from '../../src/lib/format.js';
import { fibreAlpha, fibreCircle, view } from '../../src/lib/hopf.js';
import { hasStageMarks, signaturePoint, stageParam } from '../../src/lib/signatures.js';
import { colors, fileClassColors, fileClassNames, levelColors } from '../../src/lib/tokens.js';
import { esc, loadFonts, measure, typesetter } from './text.mjs';

const n1 = (value) => Math.round(value * 10) / 10;
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const LABEL = { font: 'mono', size: 11.5, tracking: 0.12, upper: true, fill: colors.mute };

function frame(w, h) {
  const m = 20;
  const c = 12;
  const marks = [
    `M${m} ${m + c}V${m}H${m + c}`,
    `M${w - m - c} ${m}H${w - m}V${m + c}`,
    `M${m} ${h - m - c}V${h - m}H${m + c}`,
    `M${w - m - c} ${h - m}H${w - m}V${h - m - c}`,
  ].join('');
  let ticks = '';
  for (let x = 60; x < w - 40; x += 20) ticks += `M${x} ${h - m}v${x % 100 === 0 ? -6 : -3}`;
  return `<path d="${marks}" fill="none" stroke="${colors.bone}" stroke-opacity="0.3"/><path d="${ticks}" stroke="${colors.bone}" stroke-opacity="0.12"/>`;
}

function plate(width, height, { title, desc, style = '' }, build) {
  const t = typesetter();
  const body = build(t);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title desc">` +
    `<title id="title">${esc(title)}</title><desc id="desc">${esc(desc)}</desc>` +
    (style ? `<style>${style}</style>` : '') +
    `<defs>${t.defs()}</defs><rect width="${width}" height="${height}" rx="16" fill="${colors.void}"/>${frame(width, height)}${body}</svg>\n`
  );
}

// GitHub's own words: no licence file, or a file it could not match to one licence.
export const licenceLabel = (spdx) => (!spdx ? 'no licence file' : spdx === 'NOASSERTION' ? 'licence: other' : `licence ${spdx}`);

const header = (t, w, left, right) => t.text(left, 48, 62, LABEL) + (right ? t.text(right, w - 48, 62, { ...LABEL, anchor: 'end' }) : '');

// ---------------------------------------------------------------------------
// FIG. 01: the Core, every file as one fibre.

// The fibres of the Core as SVG ellipses. Stereographic projection maps every fibre to an
// exact circle, so each one is a single ellipse under this orthographic view.
const FLOW_STYLE =
  '.f{fill:none;stroke-width:1.3;stroke-linecap:round;stroke-dasharray:.4 9.6;animation:flow 18s linear infinite}' +
  '.f1{animation-duration:24s;animation-delay:-7s}.f2{animation-duration:31s;animation-delay:-13s}' +
  '@keyframes flow{to{stroke-dashoffset:-100}}@media (prefers-reduced-motion:reduce){.f{animation:none}}';

function coreFibres(geometry, { cx, cy, radius, a = 0.2, b = -0.14, yaw = 0.42, pitch = 1.02, width = 0.55 }) {
  const items = [];
  geometry.core.forEach((torus, ti) => {
    for (let j = 0; j < torus.fibres; j += 1) {
      const circle = fibreCircle(torus.eta, fibreAlpha(j, torus.fibres, ti), a, b);
      items.push({ c: view(circle.centre, yaw, pitch), r: circle.radius, n: view(circle.normal, yaw, pitch), cls: Number(torus.classes[j]), flow: j % 3 === 0 });
    }
  });
  const reach = Math.max(...items.map((it) => Math.max(Math.abs(it.c[0]), Math.abs(it.c[1])) + it.r));
  const S = radius / reach;
  const groups = new Map();
  const flows = [[], [], []];
  items
    .sort((p, q) => p.c[2] - q.c[2])
    .forEach((it, i) => {
      const x = n1(cx + it.c[0] * S);
      const y = n1(cy - it.c[1] * S);
      const rx = n1(it.r * S);
      const ry = n1(Math.max(0.3, it.r * S * Math.abs(it.n[2])));
      const angle = Math.hypot(it.n[0], it.n[1]) < 1e-6 ? 0 : n1((Math.atan2(it.n[0], it.n[1]) * 180) / Math.PI);
      const shape = `<ellipse transform="translate(${x} ${y}) rotate(${angle})" rx="${rx}" ry="${ry}"`;
      const depth = clamp((it.c[2] + 2.2) / 4.4, 0, 1);
      const opacity = Math.round([0.5, 0.55, 0.3, 0.16][it.cls] * (0.35 + 0.65 * depth) * 20) / 20;
      const key = `${it.cls}|${opacity}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(`${shape}/>`);
      if (it.flow && it.cls <= 1) flows[i % 3].push(`${shape} pathLength="100"/>`);
    });
  let out = `<g fill="none" stroke-width="${width}">`;
  for (const [key, shapes] of groups) {
    const [cls, opacity] = key.split('|');
    out += `<g stroke="${fileClassColors[cls]}" stroke-opacity="${opacity}">${shapes.join('')}</g>`;
  }
  out += '</g>';
  flows.forEach((shapes, i) => {
    out += `<g class="f${i ? ` f${i}` : ''}" stroke="${i === 1 ? colors.cyan : colors.bone}" stroke-opacity="0.85">${shapes.join('')}</g>`;
  });
  return out;
}

function corePlate({ snapshot, geometry }) {
  const W = 1280;
  const H = 640;
  const { totals, profile, links, generatedAt } = snapshot;
  const style = FLOW_STYLE;

  return plate(
    W,
    H,
    {
      title: 'The Living System: a still drawing of the Core',
      desc: `${formatInt(totals.files)} files from ${totals.repos} public repositories of ${profile.login}, each drawn as one fibre of a Hopf fibration, one torus per repository. This is an image; the interactive system is at ${links.site}`,
      style,
    },
    (t) => {
      let out = coreFibres(geometry, { cx: 860, cy: 330, radius: 300 });
      out += header(t, W, 'GitHub // The Living System', 'Fig. 01 — the Core');
      out += t.text('The Living', 46, 238, { font: 'serif', size: 104 });
      out += t.text('System', 46, 334, { font: 'serifItalic', size: 104 });
      out += t.text(profile.login, 50, 392, { font: 'monoMedium', size: 15, fill: colors.cyan });
      out += t.text(`${totals.repos} public repositories · ${formatInt(totals.files)} files · ${totals.ageDays} days old`, 50, 418, { size: 15, fill: colors.bone2 });

      const legendY = H - 104;
      fileClassNames.forEach((name, i) => {
        const x = 50 + i * 150;
        out += `<line x1="${x}" y1="${legendY - 4}" x2="${x + 18}" y2="${legendY - 4}" stroke="${fileClassColors[i]}" stroke-width="1.6"/>`;
        out += t.text(name.split(' ')[0], x + 26, legendY, { size: 11.5, fill: colors.mute });
      });
      out += t.text('Each fibre is one file. Each torus is one repository.', 50, H - 70, { size: 12, fill: colors.bone2 });
      out += t.text('A still drawing. The interactive system is linked beside this image.', 50, H - 50, { size: 12, fill: colors.mute });
      out += t.text(`snapshot ${formatDate(generatedAt)}`, W - 48, H - 50, { size: 12, fill: colors.mute, anchor: 'end' });
      return out;
    },
  );
}

// ---------------------------------------------------------------------------
// FIG. 05: vital signs.

function vitalsPlate({ snapshot }) {
  const W = 1280;
  const H = 400;
  const { totals, languages, generatedAt } = snapshot;
  const cells = [
    [formatInt(totals.repos), 'public repositories'],
    [formatInt(totals.files), 'files'],
    [formatBytes(totals.bytes), 'of source'],
    [formatInt(totals.languages), 'languages'],
    [formatInt(totals.technologies), 'technologies'],
    [formatInt(totals.commits), 'commits'],
    [formatInt(totals.contributions), 'contributions, 1 year'],
    [formatInt(totals.activeDays), 'active days'],
    [formatInt(totals.stars), 'stars'],
    [formatInt(totals.forks), 'forks'],
    [formatInt(totals.followers), 'followers'],
    [formatInt(totals.ageDays), 'days since genesis'],
  ];
  const desc = cells.map(([value, label]) => `${value} ${label}`).join(', ');
  return plate(W, H, { title: 'Vital signs', desc: `${desc}. Snapshot ${formatDate(generatedAt)}.` }, (t) => {
    let out = header(t, W, 'Fig. 05 — vital signs', `snapshot ${formatDate(generatedAt)}`);
    cells.forEach(([value, label], i) => {
      const col = i % 6;
      const row = Math.floor(i / 6);
      const x = 48 + col * 198;
      const y = 150 + row * 110;
      out += t.text(value, x, y, { font: 'serif', size: 58 });
      out += t.text(label, x + 2, y + 26, { ...LABEL, size: 10.5 });
    });
    const barY = 330;
    const barW = W - 96;
    let x = 48;
    const tones = [colors.cyan, colors.bone, '#5fa8b8', colors.mute, colors.faint];
    languages.forEach((lang, i) => {
      const w = Math.max(1, lang.share * barW);
      out += `<rect x="${n1(x)}" y="${barY}" width="${n1(Math.max(0.5, w - 2))}" height="6" fill="${tones[Math.min(i, tones.length - 1)]}"/>`;
      x += w;
    });
    let lx = 48;
    for (const [i, lang] of languages.slice(0, 5).entries()) {
      const label = `${lang.name} ${percent(lang.share)}`;
      out += `<rect x="${lx}" y="${barY + 24}" width="8" height="8" fill="${tones[i]}"/>`;
      out += t.text(label, lx + 16, barY + 32, { size: 12, fill: colors.bone2 });
      lx += 32 + measure(label, { size: 12 });
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// Specimens: each repository grown from its real directory tree.

// The tree is centred on its own bounding box and scaled to fit `fit` pixels, so
// lopsided repositories still sit in the middle of their plate.
function dendriteMarkup(d, cx, cy, S, { yaw = 0.55, pitch = 0.32, fit = 300 } = {}) {
  const raw = [];
  for (let i = 0; i < d.kinds.length; i += 1) raw.push(view([d.positions[i * 3], d.positions[i * 3 + 1], d.positions[i * 3 + 2]], yaw, pitch));
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min(S, fit / Math.max(maxX - minX, maxY - minY, 1e-6));
  const ox = (minX + maxX) / 2;
  const oy = (minY + maxY) / 2;
  const pts = raw.map((p) => [n1(cx + (p[0] - ox) * k), n1(cy - (p[1] - oy) * k), p[2]]);
  let edges = '';
  for (let i = 0; i < d.edges.length; i += 2) {
    const [x1, y1] = pts[d.edges[i]];
    const [x2, y2] = pts[d.edges[i + 1]];
    edges += `M${x1} ${y1}L${x2} ${y2}`;
  }
  const dots = [[], [], [], []];
  pts.forEach(([x, y], i) => {
    if (d.kinds[i] === 1) dots[d.classes[i]].push(`M${x} ${y}h0`);
  });
  let out = `<path d="${edges}" fill="none" stroke="${colors.bone}" stroke-opacity="0.22" stroke-width="0.8"/>`;
  dots.forEach((list, cls) => {
    if (list.length) out += `<path d="${list.join('')}" stroke="${fileClassColors[cls]}" stroke-opacity="${cls === 3 ? 0.55 : 0.9}" stroke-width="2.4" stroke-linecap="round"/>`;
  });
  return out;
}

function signatureMarkup(kind, cx, cy, r, stages) {
  const ring = `stroke="${colors.cyan}" stroke-opacity="0.5" fill="none" stroke-width="0.9"`;
  const count = stages?.items.length ?? 0;
  if (!kind) return '';
  if (kind === 'lattice') {
    let grid = '';
    for (let i = -2; i <= 2; i += 1) grid += `M${n1(cx + (i * r) / 2)} ${n1(cy - r)}V${n1(cy + r)}M${n1(cx - r)} ${n1(cy + (i * r) / 2)}H${n1(cx + r)}`;
    return `<path d="${grid}" stroke="${colors.cyan}" stroke-opacity="0.16" stroke-width="0.8"/>`;
  }
  const sides = Math.max(5, count);
  const at = (t) => {
    const [x, y] = signaturePoint(kind, t, sides);
    return [n1(cx + x * r), n1(cy + y * r)];
  };
  const samples = kind === 'perimeter' ? sides : 160;
  const d = Array.from({ length: samples }, (_, i) => at(kind === 'perimeter' ? stageParam(i, sides) : (i / samples) * Math.PI * 2));
  let out = `<path d="M${d.map((p) => p.join(' ')).join('L')}Z" ${ring}${kind === 'perimeter' ? ' stroke-dasharray="3 5"' : ''}/>`;
  if (count && hasStageMarks(kind)) {
    for (let i = 0; i < count; i += 1) {
      const [x, y] = at(stageParam(i, kind === 'perimeter' ? sides : count));
      out += `<circle cx="${x}" cy="${y}" r="2.6" fill="${colors.cyan}"/>`;
    }
  }
  return out;
}

function specimenPlate({ snapshot, geometry }, repo, index) {
  const W = 1280;
  const H = 420;
  const d = geometry.dendrites[repo.name];
  const stack = repo.tech
    .map((tech) => snapshot.tech.nodes.find((node) => node.id === tech.id)?.label)
    .filter(Boolean);
  const stats = `${plural(repo.morphology.files, 'file')} · ${plural(repo.morphology.directories, 'folder')} · ${plural(repo.commits.count, 'commit')} · created ${formatDate(repo.createdAt)} · last push ${formatDate(repo.pushedAt)}`;
  const desc = `${repo.displayName}: ${repo.description ?? 'no description'}. ${stats}. Languages: ${repo.languages.map((l) => `${l.name} ${percent(l.share)}`).join(', ') || 'none detected'}.`;
  return plate(W, H, { title: `Specimen ${plateNumber(index)}: ${repo.displayName}`, desc }, (t) => {
    let out = '';
    out += signatureMarkup(repo.signature, 236, 216, 150, repo.stages);
    out += dendriteMarkup(d, 236, 214, 176);

    const x = 470;
    const width = W - x - 48;
    out += t.text(`${plateNumber(index)} · specimen`, x, 62, { ...LABEL, fill: colors.cyan });
    out += t.text(`public · ${licenceLabel(repo.license)} · ${repo.defaultBranch}`, W - 48, 62, { ...LABEL, anchor: 'end' });
    out += t.text(repo.displayName, x - 2, 128, { font: 'serif', size: 58 });
    const para = t.paragraph(repo.description ?? 'No description on GitHub.', x, 170, width, { font: 'serif', size: 21, fill: colors.bone2, lineHeight: 1.28, maxLines: 3 });
    out += para.svg;
    let y = 170 + para.height + 14;
    out += t.text(stats, x, y, { size: 12.5, fill: colors.bone });

    y += 28;
    let bx = x;
    const tones = [colors.cyan, colors.bone, '#5fa8b8', colors.mute, colors.faint];
    repo.languages.forEach((lang, i) => {
      const w = Math.max(1, lang.share * width);
      out += `<rect x="${n1(bx)}" y="${y}" width="${n1(Math.max(1, w - 2))}" height="5" fill="${tones[Math.min(i, tones.length - 1)]}"/>`;
      bx += w;
    });
    y += 24;
    let lx = x;
    for (const [i, lang] of repo.languages.slice(0, 4).entries()) {
      const label = `${lang.name} ${percent(lang.share)}`;
      out += `<rect x="${lx}" y="${y - 8}" width="7" height="7" fill="${tones[i]}"/>`;
      out += t.text(label, lx + 13, y, { size: 11.5, fill: colors.bone2 });
      lx += 30 + measure(label, { size: 11.5 });
    }

    // Each block starts below the measured height of the one before it.
    const LINE = 12.5 * 1.4;
    if (repo.stages) {
      y += 34;
      out += t.text('Pipeline', x, y, LABEL);
      const block = t.paragraph(repo.stages.items.join(' → '), x + 96, y, width - 96, { size: 12.5, fill: colors.cyan, maxLines: 2 });
      out += block.svg;
      y += block.height - LINE;
    }
    if (stack.length) {
      y += 30;
      out += t.text('Stack', x, y, LABEL);
      out += t.paragraph(stack.join(' · '), x + 96, y, width - 96, { size: 12.5, fill: colors.bone2, maxLines: H - y > 60 ? 2 : 1 }).svg;
    }
    return out;
  });
}

function sealedPlate(sealed, index) {
  const W = 1280;
  const H = 420;
  return plate(W, H, { title: `Specimen ${plateNumber(index)}: ${sealed.name}, sealed`, desc: `${sealed.name} is a private repository. ${sealed.summary} Source: ${sealed.source}` }, (t) => {
    let out = '';
    const cx = 236;
    const cy = 214;
    const r = 118;
    const hex = Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
      return [n1(cx + Math.cos(angle) * r), n1(cy + Math.sin(angle) * r * 1.12)];
    });
    out += `<polygon points="${hex.map((p) => p.join(',')).join(' ')}" fill="${colors.ink}" stroke="${colors.bone}" stroke-opacity="0.35"/>`;
    out += `<path d="M${hex[0].join(' ')}L${cx} ${cy}L${hex[2].join(' ')}M${cx} ${cy}L${hex[4].join(' ')}" stroke="${colors.bone}" stroke-opacity="0.14" fill="none"/>`;
    const x = 470;
    out += t.text(`${plateNumber(index)} · sealed specimen`, x, 62, { ...LABEL, fill: colors.mute });
    out += t.text('private repository', W - 48, 62, { ...LABEL, anchor: 'end' });
    out += t.text(sealed.name, x - 2, 128, { font: 'serif', size: 58 });
    const para = t.paragraph(sealed.summary, x, 172, W - x - 48, { font: 'serif', size: 21, fill: colors.bone2, lineHeight: 1.28 });
    out += para.svg;
    const y = 172 + para.height + 20;
    out += t.paragraph(`Source: ${sealed.source}`, x, y, W - x - 48, { size: 12, fill: colors.mute }).svg;
    out += t.text('No tree, languages, dates or counts are shown: none of them are public.', x, H - 56, { size: 12, fill: colors.mute });
    return out;
  });
}

// ---------------------------------------------------------------------------
// FIG. 04: the technology network, as a table of classes.

function networkPlate({ snapshot }) {
  const W = 1280;
  const { nodes, classes } = snapshot.tech;
  const columns = [];
  for (const cls of Object.keys(classes)) {
    const list = nodes.filter((node) => node.class === cls);
    for (let i = 0; i < list.length; i += 10) columns.push({ cls, title: i ? `${classes[cls]} (cont.)` : classes[cls], items: list.slice(i, i + 10), total: list.length });
  }
  const rows = Math.max(...columns.map((c) => c.items.length));
  const H = 150 + rows * 27 + 70;
  const colW = (W - 96) / columns.length;
  return plate(
    W,
    H,
    { title: 'Nervous system: technologies by class', desc: columns.map((c) => `${c.title}: ${c.items.map((n) => `${n.label} (${n.repos.length})`).join(', ')}`).join('. ') },
    (t) => {
      let out = header(t, W, 'Fig. 04 — nervous system', `${formatInt(nodes.length)} technologies, each read from a file`);
      columns.forEach((column, ci) => {
        const x = 48 + ci * colW;
        out += t.text(column.title, x, 112, { ...LABEL, fill: colors.cyan, size: 11 });
        column.items.forEach((node, i) => {
          const y = 150 + i * 27;
          out += t.text(node.label, x, y, { size: 13.5, fill: colors.bone });
          for (let k = 0; k < Math.min(5, node.repos.length); k += 1) out += `<circle cx="${n1(x + colW - 24 - k * 9)}" cy="${y - 4.5}" r="2.6" fill="${colors.cyan}"/>`;
        });
      });
      out += t.text('Dots: how many public repositories use it. Sources: manifests, Dockerfiles, workflow files and GitHub language statistics.', 48, H - 50, { size: 12, fill: colors.mute });
      return out;
    },
  );
}

// ---------------------------------------------------------------------------
// FIG. 03: the contribution calendar, honest about when the account began.

function genomePlate({ snapshot }) {
  const W = 1280;
  const H = 360;
  const { calendar } = snapshot;
  const { stats } = calendar;
  const offset = new Date(`${calendar.from}T00:00:00Z`).getUTCDay();
  const cell = 15;
  const gap = 4;
  const x0 = 96;
  const y0 = 120;
  const desc = `${stats.total} contributions on ${stats.activeDays} days in the last year. The account began on ${formatDate(stats.genesis)}; busiest day ${stats.busiest ? `${formatDate(stats.busiest.date)} with ${stats.busiest.count}` : 'none'}; longest streak ${stats.longestStreak.length} days.`;
  return plate(W, H, { title: 'Contribution genome', desc }, (t) => {
    let out = header(t, W, 'Fig. 03 — contribution genome', `${formatDate(calendar.from)} – ${formatDate(calendar.to)}`);
    let lastMonth = '';
    calendar.days.forEach(([date, count, level], i) => {
      const col = Math.floor((i + offset) / 7);
      const row = (i + offset) % 7;
      const x = x0 + col * (cell + gap);
      const y = y0 + row * (cell + gap);
      if (date < stats.genesis) {
        out += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${cell - 1}" height="${cell - 1}" fill="none" stroke="${colors.bone}" stroke-opacity="0.07"/>`;
      } else {
        out += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${levelColors[level]}"${count ? '' : ` stroke="${colors.bone}" stroke-opacity="0.08"`}/>`;
      }
      const month = date.slice(0, 7);
      if (row === 0 && month !== lastMonth && Number(date.slice(8, 10)) <= 7) {
        out += t.text(formatDate(date).split(' ')[1], x, y0 - 12, { size: 11, fill: colors.mute });
        lastMonth = month;
      }
      if (date === stats.genesis) {
        out += `<path d="M${x + cell / 2} ${y0 + 7 * (cell + gap) + 4}v14" stroke="${colors.cyan}"/>`;
        out += t.text(`genesis ${formatDate(date)}`, x + cell / 2, y0 + 7 * (cell + gap) + 34, { size: 11.5, fill: colors.cyan, anchor: 'middle' });
      }
    });
    ['Mon', 'Wed', 'Fri'].forEach((day, i) => {
      out += t.text(day, x0 - 12, y0 + (1 + i * 2) * (cell + gap) + 12, { size: 11, fill: colors.mute, anchor: 'end' });
    });
    const line = [
      `${formatInt(stats.total)} contributions`,
      `${stats.activeDays} active days`,
      stats.busiest ? `busiest ${formatDate(stats.busiest.date, { year: false })} (${stats.busiest.count})` : '',
      `longest streak ${stats.longestStreak.length} days`,
      `${snapshot.totals.ageDays} days since genesis`,
    ]
      .filter(Boolean)
      .join(' · ');
    out += t.text(line, 48, H - 46, { size: 12.5, fill: colors.bone2 });
    return out;
  });
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Art for the site itself: the same drawings without frames or words, on a transparent
// ground. The page sets its own type around them.

const bare = (w, h, label, body, style = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">${style ? `<style>${style}</style>` : ''}${body}</svg>\n`;

export async function renderPlates({ snapshot, geometry, outDir }) {
  await mkdir(outDir, { recursive: true });
  const files = {
    'core.svg': bare(900, 760, `The Core: ${snapshot.totals.files} fibres in ${geometry.core.length} nested tori`, coreFibres(geometry, { cx: 450, cy: 380, radius: 400, width: 0.6 }), FLOW_STYLE),
  };
  for (const id of snapshot.order) {
    const repo = snapshot.repos.find((r) => r.id === id);
    if (repo) {
      files[`specimen-${id}.svg`] = bare(480, 480, `${repo.displayName}, grown from its directory tree`, signatureMarkup(repo.signature, 240, 240, 196, repo.stages) + dendriteMarkup(geometry.dendrites[repo.name], 240, 240, 230, { fit: 340 }));
    } else {
      const r = 150;
      const hex = Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
        return [n1(240 + Math.cos(angle) * r), n1(240 + Math.sin(angle) * r * 1.12)];
      });
      files[`specimen-${id}.svg`] = bare(
        480,
        480,
        'A sealed specimen: a private repository',
        `<polygon points="${hex.map((p) => p.join(',')).join(' ')}" fill="${colors.ink}" stroke="${colors.bone}" stroke-opacity="0.35"/><path d="M${hex[0].join(' ')}L240 240L${hex[2].join(' ')}M240 240L${hex[4].join(' ')}" stroke="${colors.bone}" stroke-opacity="0.14" fill="none"/>`,
      );
    }
  }
  for (const [name, svg] of Object.entries(files)) await writeFile(path.join(outDir, name), svg);
  return Object.keys(files);
}

export async function renderReadme({ snapshot, geometry, outDir }) {
  await loadFonts();
  await mkdir(outDir, { recursive: true });
  const files = {
    'core.svg': corePlate({ snapshot, geometry }),
    'vitals.svg': vitalsPlate({ snapshot }),
    'network.svg': networkPlate({ snapshot }),
    'genome.svg': genomePlate({ snapshot }),
  };
  snapshot.order.forEach((id, index) => {
    const repo = snapshot.repos.find((r) => r.id === id);
    const sealed = snapshot.sealed.find((s) => s.id === id);
    files[`specimen-${id}.svg`] = repo ? specimenPlate({ snapshot, geometry }, repo, index) : sealedPlate(sealed, index);
  });
  for (const [name, svg] of Object.entries(files)) await writeFile(path.join(outDir, name), svg);
  return Object.keys(files);
}
