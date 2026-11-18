// Technologies the network can show, and what in a repository counts as evidence of each.
// A technology appears only when one of its markers is found in a public repository:
// a dependency in a manifest, a file such as a Dockerfile or workflow, or GitHub's own
// language byte counts. A dependency missing from this list still appears in its
// specimen plate; it just does not become a node in the network.

export const techClasses = {
  language: 'Language',
  framework: 'Framework',
  infrastructure: 'Infrastructure',
  ai: 'AI / ML',
};

export const catalog = [
  { id: 'react', label: 'React', class: 'framework', npm: ['react'] },
  { id: 'nextjs', label: 'Next.js', class: 'framework', npm: ['next'] },
  { id: 'vite', label: 'Vite', class: 'framework', npm: ['vite'] },
  { id: 'express', label: 'Express', class: 'framework', npm: ['express'] },
  { id: 'threejs', label: 'Three.js', class: 'framework', npm: ['three'] },
  { id: 'zod', label: 'Zod', class: 'framework', npm: ['zod'] },
  { id: 'motion', label: 'Motion', class: 'framework', npm: ['motion', 'framer-motion'] },
  { id: 'playwright', label: 'Playwright', class: 'framework', npm: ['playwright', '@playwright/test', 'playwright-core'], pip: ['playwright'] },
  { id: 'vitest', label: 'Vitest', class: 'framework', npm: ['vitest'] },
  { id: 'jest', label: 'Jest', class: 'framework', npm: ['jest'] },
  { id: 'tailwind', label: 'Tailwind CSS', class: 'framework', npm: ['tailwindcss'] },
  { id: 'monaco', label: 'Monaco Editor', class: 'framework', npm: ['@monaco-editor/react', 'monaco-editor'] },
  { id: 'react-native', label: 'React Native', class: 'framework', npm: ['react-native'] },
  { id: 'expo', label: 'Expo', class: 'framework', npm: ['expo'] },
  { id: 'fastapi', label: 'FastAPI', class: 'framework', pip: ['fastapi'] },
  { id: 'sqlalchemy', label: 'SQLAlchemy', class: 'framework', pip: ['sqlalchemy'] },
  { id: 'alembic', label: 'Alembic', class: 'framework', pip: ['alembic'], files: [/(^|\/)alembic\.ini$/] },
  { id: 'pydantic', label: 'Pydantic', class: 'framework', pip: ['pydantic'] },
  { id: 'httpx', label: 'HTTPX', class: 'framework', pip: ['httpx'] },
  { id: 'pytest', label: 'Pytest', class: 'framework', pip: ['pytest'], files: [/(^|\/)pytest\.ini$/] },

  { id: 'docker', label: 'Docker', class: 'infrastructure', files: [/(^|\/)Dockerfile[^/]*$/, /(^|\/)(docker-)?compose[^/]*\.ya?ml$/] },
  { id: 'postgresql', label: 'PostgreSQL', class: 'infrastructure', pip: ['psycopg', 'psycopg2', 'psycopg2-binary', 'psycopg-binary', 'asyncpg'], npm: ['pg'] },
  { id: 'redis', label: 'Redis', class: 'infrastructure', pip: ['redis'], npm: ['redis', 'ioredis'] },
  { id: 'github-actions', label: 'GitHub Actions', class: 'infrastructure', files: [/^\.github\/workflows\/[^/]+\.ya?ml$/] },
  { id: 'chrome-mv3', label: 'Chrome MV3', class: 'infrastructure', manifestV3: true },

  { id: 'anthropic', label: 'Anthropic SDK', class: 'ai', npm: ['@anthropic-ai/sdk'], pip: ['anthropic'] },
  { id: 'scikit-learn', label: 'scikit-learn', class: 'ai', pip: ['scikit-learn', 'sklearn'] },
  { id: 'numpy', label: 'NumPy', class: 'ai', pip: ['numpy'] },
  { id: 'scipy', label: 'SciPy', class: 'ai', pip: ['scipy'] },
  { id: 'opencv', label: 'OpenCV', class: 'ai', pip: ['opencv-python', 'opencv-python-headless', 'opencv-contrib-python'] },
  { id: 'tesseract', label: 'Tesseract OCR', class: 'ai', pip: ['pytesseract'] },
];

// GitHub reports Dockerfiles as a language; here they are evidence of Docker.
export const languageToTech = { Dockerfile: 'docker' };

// Manifests worth reading. Everything else in a repository is counted, never parsed.
export const manifestPattern =
  /(^|\/)(package\.json|requirements[^/]*\.txt|pyproject\.toml|manifest\.json)$/;
