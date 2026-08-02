// Générateur pseudo-aléatoire (seedable) et bruit de Perlin 2D. Purs : aucun import.

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const grid = {};
  function getGrad(x, y) {
    const key = x + ',' + y;
    if (!grid[key]) {
      const angle = rand() * Math.PI * 2;
      grid[key] = [Math.cos(angle), Math.sin(angle)];
    }
    return grid[key];
  }
  function dot(gx, gy, x, y) {
    const g = getGrad(gx, gy);
    return g[0] * (x - gx) + g[1] * (y - gy);
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  return function (x, y) {
    const x0 = Math.floor(x),
      y0 = Math.floor(y);
    const x1 = x0 + 1,
      y1 = y0 + 1;
    const sx = smooth(x - x0),
      sy = smooth(y - y0);
    const n0 = dot(x0, y0, x, y),
      n1 = dot(x1, y0, x, y);
    const ix0 = n0 + sx * (n1 - n0);
    const n2 = dot(x0, y1, x, y),
      n3 = dot(x1, y1, x, y);
    const ix1 = n2 + sx * (n3 - n2);
    return ix0 + sy * (ix1 - ix0);
  };
}
