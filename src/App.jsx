import { Providers } from './lib/store.js';
import { Colophon } from './ui/Colophon.jsx';
import { CoreFigure } from './ui/CoreFigure.jsx';
import { Effects } from './ui/Effects.jsx';
import { GenomeFigure } from './ui/GenomeFigure.jsx';
import { Handshake } from './ui/Handshake.jsx';
import { Masthead } from './ui/Masthead.jsx';
import { NetworkFigure } from './ui/NetworkFigure.jsx';
import { SpecimensFigure } from './ui/SpecimensFigure.jsx';
import { Stage } from './ui/Stage.jsx';
import { VitalsFigure } from './ui/VitalsFigure.jsx';

// The whole document is prerendered from the snapshot, so every word and number is in the
// HTML before any script runs. The 3D stage is layered behind it once the page has painted.
export default function App({ snapshot, store }) {
  return (
    <Providers store={store} snapshot={snapshot}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Masthead />
      <Stage />
      <main id="main">
        <CoreFigure />
        <SpecimensFigure />
        <GenomeFigure />
        <NetworkFigure />
        <VitalsFigure />
      </main>
      <Colophon />
      <Handshake />
      <Effects />
    </Providers>
  );
}
