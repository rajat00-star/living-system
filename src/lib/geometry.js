// The build's geometry (dendrites, network layout, snake path) loads once, on demand:
// with the 3D scene, or when the snake is run on the flat grid.
let pending = null;

export function loadGeometry(version) {
  if (!pending) {
    pending = fetch(`data/geometry.json?v=${encodeURIComponent(version)}`)
      .then((response) => {
        if (!response.ok) throw new Error(`geometry ${response.status}`);
        return response.json();
      })
      .then((geometry) => {
        if (geometry.schema !== 1 || !geometry.snake?.path?.length) throw new Error('unexpected geometry');
        return geometry;
      })
      .catch((error) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}
