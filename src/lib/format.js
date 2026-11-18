// Formatting shared by the page, the scene labels and the README plates, so a number
// reads the same everywhere it appears.

const integer = new Intl.NumberFormat('en-US');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatInt = (n) => integer.format(Math.round(n));

// Decimal megabytes, the unit GitHub's language bar implies. Exact bytes stay available
// alongside wherever the space allows.
export function formatBytes(bytes) {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

// Dates are shown as calendar dates in UTC, the way GitHub reports them.
export function formatDate(value, { year = true } = {}) {
  if (!value) return '';
  const iso = String(value);
  const y = iso.slice(0, 4);
  const m = MONTHS[Number(iso.slice(5, 7)) - 1];
  const d = Number(iso.slice(8, 10));
  return year ? `${d} ${m} ${y}` : `${d} ${m}`;
}

export function formatDateTime(value) {
  const iso = String(value);
  return `${formatDate(iso)}, ${iso.slice(11, 16)} UTC`;
}

export function relativeTime(value, now = Date.now()) {
  const at = typeof value === 'number' ? value : Date.parse(value);
  const seconds = Math.round((now - at) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days} days ago`;
  return formatDate(new Date(at).toISOString());
}

export const plural = (n, one, many = `${one}s`) => `${formatInt(n)} ${n === 1 ? one : many}`;

export const percent = (share, digits = 1) => `${(share * 100).toFixed(digits)}%`;

// Plate numbers for specimens: S-01, S-02 …
export const plateNumber = (index) => `S-${String(index + 1).padStart(2, '0')}`;
