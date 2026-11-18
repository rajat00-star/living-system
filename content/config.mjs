// The one place to edit who this system belongs to and what it features.
// Everything numeric on the site comes from the GitHub API through pipeline/run.mjs;
// this file only says where to look and how to name things.

export const config = {
  login: 'rajat00-star',
  language: 'en',

  identity: {
    // The name Rajat uses on his portfolio. GitHub's own profile name is read from the API.
    name: 'Rajat Sanger',
    role: 'AI/ML engineer and full-stack developer',
  },

  links: {
    github: 'https://github.com/rajat00-star',
    linkedin: 'https://www.linkedin.com/in/rajatsanger',
    email: 'sangerrajat0@gmail.com',
    // Empty until the portfolio has a public address; empty links are hidden.
    portfolio: '',
  },

  // Where this site is deployed. README images are served from here.
  websiteUrl: 'https://rajat00-star.github.io/living-system/',

  // Featured systems, in the order the brief lists them. A featured repository that is
  // public becomes a full specimen. One that is private becomes a sealed specimen only if
  // it has an entry in `sealed` below. Anything else is left out and reported by the
  // pipeline, so a repository created later joins on the next build with no code change.
  featured: [
    { id: 'ultramatrix', repo: 'ultramatrix', name: 'Ultramatrix' },
    { id: 'safecircle', repo: 'SafeCircle', name: 'SafeCircle Guardian' },
    { id: 'omnipilot', repo: 'OmniPilot', name: 'OmniPilot' },
    { id: 'pramaan', repo: 'pramaan', name: 'PraMaan' },
    { id: 'sentinel', repo: 'sentinel', name: 'Sentinel' },
  ],

  // Private repositories shown as sealed specimens. Nothing here is read from GitHub:
  // the text is what Rajat already publishes elsewhere, and says where it comes from.
  sealed: {
    ultramatrix: {
      summary: 'An AI-powered desktop layer that brings voice, vision, planning and system control into one local assistant.',
      source: "Rajat's portfolio. The repository is private, so nothing here can be checked against it publicly.",
    },
  },

  // Public repositories to leave out of the system entirely, by GitHub name. Empty: every
  // public repository is shown, because every one is public on the profile.
  exclude: [],

  // Display names for public repositories that are not featured.
  names: {
    CodeForge: 'CodeForge',
    'Hand-Tracking-Using-OpenCV': 'Hand Tracking',
    Leetcode: 'Leetcode',
    'rajat00-star': 'Profile README',
  },

  // Each specimen's signature geometry, chosen from what its README says it does.
  signatures: {
    OmniPilot: 'trajectory',
    SafeCircle: 'perimeter',
    pramaan: 'lattice',
    CodeForge: 'loop',
  },

  // Folders whose manifests describe fixtures or sample projects rather than the
  // repository's own stack. CodeForge, for instance, ships sample repositories it repairs.
  ignoreManifestPaths: /(^|\/)(benchmarks?|sample-repositories|samples?|fixtures?|examples?|vendor|third_party|node_modules)\//i,
};
