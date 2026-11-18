// How a public GitHub event reads in the activity feed. Shared by the build pipeline and
// the browser's live refresh, so both describe the same event the same way.

const firstLine = (text, max = 72) => {
  const line = String(text ?? '').split('\n')[0].trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

export function describeEvent(event) {
  const p = event.payload ?? {};
  const ref = String(p.ref ?? '').replace(/^refs\/heads\//, '');
  switch (event.type) {
    case 'PushEvent': {
      const n = p.size ?? p.commits?.length;
      const message = p.commits?.length ? `: ${firstLine(p.commits.at(-1).message)}` : '';
      return n ? `pushed ${n} commit${n === 1 ? '' : 's'} to ${ref}${message}` : `pushed to ${ref}`;
    }
    case 'CreateEvent':
      return p.ref_type === 'repository' ? 'created the repository' : `created ${p.ref_type} ${ref}`;
    case 'DeleteEvent':
      return `deleted ${p.ref_type} ${ref}`;
    case 'PublicEvent':
      return 'made the repository public';
    case 'ReleaseEvent':
      return `released ${p.release?.tag_name ?? ''}`.trim();
    case 'IssuesEvent':
      return `${p.action} issue #${p.issue?.number}`;
    case 'PullRequestEvent':
      return `${p.action} pull request #${p.pull_request?.number ?? p.number}`;
    case 'ForkEvent':
      return 'was forked';
    default:
      return event.type.replace(/Event$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  }
}

// Public events on the owner's own repositories, normalised for the feed.
export function ownEvents(events, login) {
  const prefix = `${login.toLowerCase()}/`;
  return events
    .filter((event) => event && event.public !== false && typeof event.repo?.name === 'string' && event.repo.name.toLowerCase().startsWith(prefix) && typeof event.created_at === 'string')
    .map((event) => ({ at: event.created_at, repo: event.repo.name.split('/')[1], kind: event.type, text: describeEvent(event), source: 'event' }));
}
