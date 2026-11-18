import { renderToString } from 'react-dom/server';
import { config } from '../content/config.mjs';
import App from './App.jsx';
import { formatBytes, formatInt } from './lib/format.js';
import { earlyScript } from './lib/prefs.js';
import { createStore, initialState } from './lib/store.js';
import { colors } from './lib/tokens.js';

export { earlyScript };
export const site = { language: config.language, websiteUrl: config.websiteUrl };

export function renderApp(snapshot) {
  const store = createStore(initialState({ motion: true, sound: false, three: true }));
  store.actions = {};
  return renderToString(<App snapshot={snapshot} store={store} />);
}

const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderHead({ cssText, fonts = [], entry, snapshot }) {
  const { totals, identity, profile, links } = snapshot;
  const base = config.websiteUrl.replace(/\/$/, '');
  const title = `The Living System · ${identity.name} on GitHub`;
  const description = `${identity.name}’s public GitHub as an interactive 3D system: ${totals.repos} repositories, ${formatInt(totals.files)} files and ${formatBytes(totals.bytes)} of source, read from the GitHub API and drawn as a Hopf fibration, specimens, a contribution genome and a technology network.`;
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta name="author" content="${esc(identity.name)}" />`,
    `<meta name="theme-color" content="${colors.void}" />`,
    `<meta name="color-scheme" content="dark" />`,
    `<meta name="referrer" content="strict-origin-when-cross-origin" />`,
    `<link rel="icon" href="favicon.svg" type="image/svg+xml" />`,
    `<link rel="canonical" href="${esc(`${base}/`)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(`${base}/`)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
  ];
  const person = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: title,
    url: `${base}/`,
    dateModified: snapshot.generatedAt,
    mainEntity: { '@type': 'Person', name: identity.name, alternateName: profile.login, jobTitle: identity.role, sameAs: [links.github, links.linkedin].filter(Boolean) },
  };
  tags.push(`<script type="application/ld+json">${JSON.stringify(person).replace(/</g, '\\u003c')}</script>`);
  if (cssText) tags.push(`<style>${cssText}</style>`);
  tags.push(`<script>${earlyScript}</script>`);
  tags.push(`<link rel="preload" as="image" href="plates/core.svg" fetchpriority="high" />`);
  for (const font of fonts) tags.push(`<link rel="preload" href="${font}" as="font" type="font/woff2" crossorigin />`);
  if (entry) tags.push(`<link rel="modulepreload" href="${entry}" />`);
  return tags.join('\n    ');
}
