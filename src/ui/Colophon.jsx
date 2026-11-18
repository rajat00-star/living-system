import { formatDateTime, formatInt } from '../lib/format.js';
import { useSnapshot } from '../lib/store.js';
import { Ext } from './bits.jsx';

export function Colophon() {
  const snapshot = useSnapshot();
  const { links, profile, totals, generatedAt } = snapshot;
  return (
    <footer className="colophon">
      <p className="colophon__line">
        {formatInt(totals.ageDays)} days old. <em>It grows with every commit.</em>
      </p>
      <ul className="colophon__links">
        <li>
          <Ext href={links.github}>GitHub · {profile.login}</Ext>
        </li>
        {links.linkedin ? (
          <li>
            <Ext href={links.linkedin}>LinkedIn</Ext>
          </li>
        ) : null}
        {links.portfolio ? (
          <li>
            <Ext href={links.portfolio}>Portfolio</Ext>
          </li>
        ) : null}
        {links.email ? (
          <li>
            <a href={`mailto:${links.email}`}>{links.email}</a>
          </li>
        ) : null}
      </ul>
      <p className="colophon__credits">
        Built only from public data, read from GitHub’s API. Type: Instrument Serif and IBM Plex Mono, under the SIL Open Font License. Rendering: three.js, React Three Fiber and postprocessing, under the
        MIT License.
      </p>
      <p className="label">Snapshot {formatDateTime(generatedAt)}</p>
    </footer>
  );
}
