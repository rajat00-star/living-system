// A small GitHub client for the build pipeline.
//
// - Conditional requests: every response's ETag is cached on disk, and a 304 reply costs
//   nothing against the rate limit.
// - Rate limits: a request never fires once the quota is known to be spent; 403/429 replies
//   are retried after `retry-after` or `x-ratelimit-reset` when that is under a minute away.
// - Transient failures (network, 5xx) are retried with exponential backoff, three times.
// - The token is only ever held in memory. It is never logged and never written anywhere.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const USER_AGENT = 'living-system-pipeline';
const CACHE_VERSION = 2;

export class RateLimitError extends Error {
  constructor(message, resetAt) {
    super(message);
    this.name = 'RateLimitError';
    this.resetAt = resetAt;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function createClient({ token = '', cacheFile, log = () => {} } = {}) {
  // The cache format is versioned: entries written by an older format are dropped, not misread.
  let cache = {};
  if (cacheFile) {
    try {
      const stored = JSON.parse(await readFile(cacheFile, 'utf8'));
      if (stored.version === CACHE_VERSION) cache = stored.entries;
    } catch {
      cache = {};
    }
  }

  const stats = { requests: 0, notModified: 0, retries: 0, raw: 0 };
  let remaining = Infinity;
  let resetAt = 0;

  function noteLimits(headers) {
    const left = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    if (left !== null) remaining = Number(left);
    if (reset !== null) resetAt = Number(reset) * 1000;
  }

  async function request(url, { method = 'GET', body, accept = 'application/vnd.github+json', isApi = true, allow404 = false } = {}) {
    const key = method === 'GET' ? url : null;
    const cached = key ? cache[key] : null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (isApi && remaining <= 0 && Date.now() < resetAt) {
        const wait = resetAt - Date.now();
        if (wait > 60_000) throw new RateLimitError(`GitHub rate limit spent until ${new Date(resetAt).toISOString()}`, resetAt);
        log(`rate limit spent, waiting ${Math.ceil(wait / 1000)}s`);
        await sleep(wait + 500);
      }
      const headers = { 'user-agent': USER_AGENT, accept };
      if (isApi) headers['x-github-api-version'] = '2022-11-28';
      if (token && isApi) headers.authorization = `Bearer ${token}`;
      if (cached?.etag) headers['if-none-match'] = cached.etag;
      if (body) headers['content-type'] = 'application/json';

      let response;
      try {
        stats.requests += 1;
        if (!isApi) stats.raw += 1;
        response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
      } catch (error) {
        if (attempt === 3) throw new Error(`network error for ${redact(url)}: ${error.message}`);
        stats.retries += 1;
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (isApi) noteLimits(response.headers);

      if (response.status === 304 && cached) {
        stats.notModified += 1;
        // A 304 carries no Link header, and the commit count lives there, so the
        // headers that matter are replayed from the cached response.
        return { status: 200, data: cached.data, headers: new Headers(cached.headers ?? {}), cached: true };
      }
      if (response.status === 404 && allow404) return { status: 404, data: null, headers: response.headers };

      if (response.status === 403 || response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const wait = retryAfter ? retryAfter * 1000 : remaining === 0 ? resetAt - Date.now() : 0;
        if (wait > 0 && wait <= 60_000 && attempt < 3) {
          stats.retries += 1;
          log(`GitHub asked to slow down, waiting ${Math.ceil(wait / 1000)}s`);
          await sleep(wait + 250);
          continue;
        }
        if (remaining === 0 || retryAfter) throw new RateLimitError(`GitHub rate limit reached on ${redact(url)}`, resetAt);
        throw new Error(`GitHub refused ${redact(url)} with ${response.status}`);
      }
      if (response.status >= 500) {
        if (attempt === 3) throw new Error(`GitHub ${response.status} on ${redact(url)}`);
        stats.retries += 1;
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) throw new Error(`GitHub ${response.status} on ${redact(url)}`);

      const data = accept.includes('json') ? await response.json() : await response.text();
      const etag = response.headers.get('etag');
      const link = response.headers.get('link');
      if (key && etag) cache[key] = { etag, data, headers: link ? { link } : {} };
      return { status: response.status, data, headers: response.headers };
    }
    throw new Error(`gave up on ${redact(url)}`);
  }

  return {
    stats,
    get authenticated() {
      return Boolean(token);
    },
    get quota() {
      return { remaining, resetAt };
    },

    // GET /rate_limit does not count against the limit.
    async rateLimit() {
      const { data } = await request(`${API}/rate_limit`);
      const core = data?.resources?.core;
      if (core) {
        remaining = core.remaining;
        resetAt = core.reset * 1000;
      }
      return core;
    },

    async get(route, options) {
      return (await request(`${API}${route}`, options)).data;
    },

    // Returns the parsed body and the total count GitHub reports through its Link header,
    // which is how a commit count is read with a single request of one item.
    async count(route) {
      const separator = route.includes('?') ? '&' : '?';
      const { data, headers } = await request(`${API}${route}${separator}per_page=1`, { allow404: true });
      if (!data) return { count: 0, first: null };
      const link = headers.get('link') || '';
      const last = link.match(/[?&]page=(\d+)>; rel="last"/);
      return { count: last ? Number(last[1]) : Array.isArray(data) ? data.length : 0, first: Array.isArray(data) ? data[0] ?? null : null };
    },

    async graphql(query, variables = {}) {
      if (!token) throw new Error('GraphQL needs a token');
      const { data } = await request(`${API}/graphql`, { method: 'POST', body: { query, variables } });
      if (data.errors?.length) throw new Error(`GraphQL: ${data.errors.map((e) => e.message).join('; ')}`);
      return data.data;
    },

    // Files of public repositories only: raw.githubusercontent.com serves nothing private
    // without a token, and none is ever sent to it. Raw reads do not count against the API limit.
    async raw(owner, repo, ref, file) {
      const url = `${RAW}/${owner}/${repo}/${ref}/${file.split('/').map(encodeURIComponent).join('/')}`;
      const { data } = await request(url, { accept: 'text/plain', isApi: false, allow404: true });
      return data;
    },

    // The contribution calendar exactly as a signed-out visitor sees it.
    async publicCalendarHtml(login) {
      const { data } = await request(`https://github.com/users/${encodeURIComponent(login)}/contributions`, { accept: 'text/html', isApi: false });
      return data;
    },

    async save() {
      if (!cacheFile) return;
      await mkdir(path.dirname(cacheFile), { recursive: true });
      await writeFile(cacheFile, JSON.stringify({ version: CACHE_VERSION, entries: cache }));
    },
  };
}

// Never print anything token-like, even inside a URL.
function redact(url) {
  return String(url).replace(/(gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, '[redacted]');
}
