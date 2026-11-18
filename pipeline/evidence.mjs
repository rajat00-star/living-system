// Checks each field note against the file it quotes, at the commit being published.
// A note whose quote is no longer in the file is dropped and reported, never shown.

// Line breaks, repeated spaces, Markdown emphasis, backticks and curly quotes differ
// between how a sentence is written and how it reads; nothing else is forgiven.
export const normaliseText = (text) =>
  String(text)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\*+/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export async function verifyEntries(entry, readFile, { blobUrl }) {
  const files = new Map();
  const load = async (file) => {
    if (!files.has(file)) files.set(file, readFile(file).then((text) => (text == null ? null : normaliseText(text))));
    return files.get(file);
  };
  const dropped = [];
  const check = async (item, label) => {
    const text = await load(item.path);
    const quote = normaliseText(item.quote);
    if (text == null) {
      dropped.push({ label, path: item.path, reason: 'file not found' });
      return null;
    }
    if (!text.includes(quote)) {
      dropped.push({ label, path: item.path, reason: 'quote no longer in the file' });
      return null;
    }
    return { quote, path: item.path, url: blobUrl(item.path) };
  };

  const stages = entry.stages ? await check(entry.stages, 'stages') : null;
  const layers = [];
  for (const layer of entry.layers ?? []) {
    const ok = await check(layer, `layer ${layer.name}`);
    if (ok) layers.push({ name: layer.name, dir: layer.dir ?? null, ...ok });
  }
  const notes = [];
  for (const note of entry.notes ?? []) {
    const ok = await check(note, note.title);
    if (ok) notes.push({ title: note.title, ...ok });
  }
  return {
    stages: stages ? { items: entry.stages.items, ...stages } : null,
    layers,
    notes,
    dropped,
  };
}
