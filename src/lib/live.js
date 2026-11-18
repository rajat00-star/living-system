// The live layer: three unauthenticated reads of GitHub's public API from the visitor's
// own browser. No token exists in this code or anywhere in the page.
//
// - Results are kept for 10 minutes in this browser, so revisits cost no requests.
// - The browser revalidates with GitHub's ETags on its own, and a 304 costs no quota.
// - A 403 or 429 means GitHub's per-visitor limit (60 an hour) is spent: the page says so
//   and keeps showing the build's snapshot. Nothing retries in a loop.
// - Every field is checked before use; anything unexpected falls back to the snapshot.
import { ownEvents } from './events.js';
import { readPref, writePref } from './prefs.js';

const API = 'https://api.github.com';
const KEY = 'living-system:live:v1';
const TTL = 10 * 60 * 1000;

const isCount = (value) => Number.isInteger(value) && value >= 0;
const isDate = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

class LimitError extends Error {
  constructor(resetAt) {
    super('rate limited');
    this.resetAt = resetAt;
  }
}

async function getJson(path, signal) {
  const response = await fetch(`${API}${path}`, {
    headers: { accept: 'application/vnd.github+json' },
    credentials: 'omit',
    cache: 'no-cache',
    referrerPolicy: 'no-referrer',
    signal,
  });
  const remaining = Number(response.headers.get('x-ratelimit-remaining'));
  const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000 || null;
  if (response.status === 403 || response.status === 429) throw new LimitError(reset);
  if (!response.ok) throw new Error(`GitHub ${response.status}`);
  return { body: await response.json(), remaining: Number.isFinite(remaining) ? remaining : null, reset };
}

function validate(login, profile, repos, events) {
  if (!profile || profile.login?.toLowerCase() !== login.toLowerCase()) throw new Error('unexpected profile');
  if (!isCount(profile.public_repos) || !isCount(profile.followers)) throw new Error('unexpected profile counts');
  if (!Array.isArray(repos) || !Array.isArray(events)) throw new Error('unexpected lists');
  const list = repos
    .filter((r) => r && r.private === false && !r.fork)
    .map((r) => {
      if (typeof r.name !== 'string' || !isCount(r.stargazers_count) || !isCount(r.forks_count) || !isCount(r.open_issues_count) || !isDate(r.pushed_at)) throw new Error('unexpected repository');
      return { name: r.name, stars: r.stargazers_count, forks: r.forks_count, openIssues: r.open_issues_count, pushedAt: r.pushed_at, createdAt: r.created_at };
    });
  return {
    profile: { publicRepos: profile.public_repos, followers: profile.followers },
    repos: list,
    totals: {
      repos: list.length,
      stars: list.reduce((sum, r) => sum + r.stars, 0),
      forks: list.reduce((sum, r) => sum + r.forks, 0),
      openIssues: list.reduce((sum, r) => sum + r.openIssues, 0),
    },
    events: ownEvents(events, login).slice(0, 12),
  };
}

export async function refreshLive(login, { signal, force = false } = {}) {
  let cached = null;
  try {
    cached = JSON.parse(readPref(KEY) ?? 'null');
  } catch {
    cached = null;
  }
  if (!force && cached && cached.login === login && Date.now() - cached.checkedAt < TTL) return { ...cached.data, status: 'ok', checkedAt: cached.checkedAt, cached: true };

  try {
    const [profile, repos, events] = await Promise.all([
      getJson(`/users/${encodeURIComponent(login)}`, signal),
      getJson(`/users/${encodeURIComponent(login)}/repos?per_page=100&type=owner&sort=pushed`, signal),
      getJson(`/users/${encodeURIComponent(login)}/events/public?per_page=30`, signal),
    ]);
    const data = validate(login, profile.body, repos.body, events.body);
    const remaining = Math.min(...[profile.remaining, repos.remaining, events.remaining].filter((n) => n !== null));
    const checkedAt = Date.now();
    data.remaining = Number.isFinite(remaining) ? remaining : null;
    writePref(KEY, JSON.stringify({ login, checkedAt, data }));
    return { ...data, status: 'ok', checkedAt, cached: false };
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    if (error instanceof LimitError) return { status: 'limited', resetAt: error.resetAt, checkedAt: Date.now() };
    return { status: 'error', message: error.message, checkedAt: Date.now() };
  }
}
