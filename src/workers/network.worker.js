// The technology network's forces, off the main thread. The layout arrives settled from the
// build; this worker runs only while someone drags a node, so the page never stutters while
// the graph re-settles. Same forces as pipeline/geometry.mjs.
//
// in:  { type: 'init', nodes: [{ id, kind, x, y, z }], links: [{ source, target }] }
//      { type: 'drag', id, x, y, z }  pins a node where the pointer holds it
//      { type: 'release', id }        lets it go; the graph cools and settles
// out: { type: 'tick', positions }    Float32Array, xyz per node, transferred not copied
//      { type: 'settled' }
import { forceCenter, forceLink, forceManyBody, forceSimulation, forceX, forceY, forceZ } from 'd3-force-3d';

let simulation = null;
let nodes = [];
let timer = 0;

function post() {
  const positions = new Float32Array(nodes.length * 3);
  nodes.forEach((n, i) => {
    positions[i * 3] = n.x;
    positions[i * 3 + 1] = n.y;
    positions[i * 3 + 2] = n.z;
  });
  self.postMessage({ type: 'tick', positions }, [positions.buffer]);
}

function run() {
  if (timer) return;
  timer = setInterval(() => {
    simulation.tick();
    post();
    if (simulation.alpha() < simulation.alphaMin()) {
      clearInterval(timer);
      timer = 0;
      self.postMessage({ type: 'settled' });
    }
  }, 16);
}

self.onmessage = ({ data }) => {
  if (data.type === 'init') {
    nodes = data.nodes.map((n) => ({ ...n }));
    // The build scaled its layout by `scale`; the forces are scaled to match, so a drag
    // re-settles the graph exactly as the build would have.
    simulation = forceSimulation(nodes, 3)
      .force('link', forceLink(data.links).id((d) => d.id).distance(1.5 * (data.scale ?? 1)).strength(0.55))
      .force('charge', forceManyBody().strength((d) => (d.kind === 'repo' ? -34 : -9) * (data.scale ?? 1) ** 2))
      .force('center', forceCenter(0, 0, 0))
      .force('x', forceX(0).strength(0.04))
      .force('y', forceY(0).strength(0.04))
      .force('z', forceZ(0).strength(0.04))
      .alpha(0)
      .stop();
    return;
  }
  if (!simulation) return;
  const node = nodes.find((n) => n.id === data.id);
  if (!node) return;
  if (data.type === 'drag') {
    node.fx = data.x;
    node.fy = data.y;
    node.fz = data.z;
    simulation.alpha(Math.max(simulation.alpha(), 0.25)).alphaTarget(0.08);
    run();
  } else if (data.type === 'release') {
    node.fx = null;
    node.fy = null;
    node.fz = null;
    simulation.alphaTarget(0);
    run();
  }
};
