import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import { createActions } from './lib/actions.js';
import { createStore, initialState } from './lib/store.js';
import './styles/index.css';

// The snapshot the page was prerendered from, inlined by the build as inert JSON.
const snapshot = JSON.parse(document.getElementById('snapshot').textContent);

// The first render must match the prerendered HTML, so it starts from the same defaults;
// Effects then applies what the early script decided from this visitor's preferences.
const store = createStore(initialState({ motion: true, sound: false, three: true }));
store.actions = createActions(store, snapshot);

const container = document.getElementById('root');
const app = <App snapshot={snapshot} store={store} />;

function start() {
  if (container.firstElementChild) hydrateRoot(container, app);
  else createRoot(container).render(app);
}

// The page arrives prerendered, so the browser paints it first and React takes over a
// frame later. Nothing visible waits for JavaScript. A tab that paints no frames (opened
// in the background, or throttled) must not keep the page inert, so a short timer races
// the first frame and whichever comes first starts React.
let started = false;
const go = () => {
  if (started) return;
  started = true;
  start();
};
if (!container.firstElementChild) go();
else {
  requestAnimationFrame(() => setTimeout(go, 0));
  setTimeout(go, 300);
}
