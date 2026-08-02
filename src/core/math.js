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

// hash déterministe (x,y[,z]) -> [0,1) : remplace Math.random() partout où la génération
// doit être une fonction pure des coordonnées (arbres, veines de minerai) — sans ça,
// recharger un chunk déchargé donnerait un résultat différent du premier chargement,
// ce qui casserait le système de diffs (Phase 4a) et l'idée même de "même seed -> même chunk".
export function hash2(x, y, salt = 0) {
  let h =
    Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function hash3(x, y, z, salt = 0) {
  let h =
    Math.imul(x | 0, 374761393) ^
    Math.imul(y | 0, 668265263) ^
    Math.imul(z | 0, 2147483647) ^
    Math.imul(salt | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
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

// bruit de Perlin 3D (pour les cavernes, Phase 4b) : même principe que la version 2D
// mais interpolation trilinéaire sur les 8 coins du cube englobant.
export function makeNoise3D(seed) {
  const rand = mulberry32(seed);
  const grid = {};
  function getGrad(x, y, z) {
    const key = x + ',' + y + ',' + z;
    let g = grid[key];
    if (!g) {
      // direction aléatoire sur la sphère unité
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(rand() * 2 - 1);
      g = [Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)];
      grid[key] = g;
    }
    return g;
  }
  function dot(gx, gy, gz, x, y, z) {
    const g = getGrad(gx, gy, gz);
    return g[0] * (x - gx) + g[1] * (y - gy) + g[2] * (z - gz);
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  return function (x, y, z) {
    const x0 = Math.floor(x),
      y0 = Math.floor(y),
      z0 = Math.floor(z);
    const x1 = x0 + 1,
      y1 = y0 + 1,
      z1 = z0 + 1;
    const sx = smooth(x - x0),
      sy = smooth(y - y0),
      sz = smooth(z - z0);
    const lerp = (a, b, t) => a + t * (b - a);
    const n000 = dot(x0, y0, z0, x, y, z),
      n100 = dot(x1, y0, z0, x, y, z);
    const n010 = dot(x0, y1, z0, x, y, z),
      n110 = dot(x1, y1, z0, x, y, z);
    const n001 = dot(x0, y0, z1, x, y, z),
      n101 = dot(x1, y0, z1, x, y, z);
    const n011 = dot(x0, y1, z1, x, y, z),
      n111 = dot(x1, y1, z1, x, y, z);
    const ix00 = lerp(n000, n100, sx),
      ix10 = lerp(n010, n110, sx);
    const ix01 = lerp(n001, n101, sx),
      ix11 = lerp(n011, n111, sx);
    const iy0 = lerp(ix00, ix10, sy),
      iy1 = lerp(ix01, ix11, sy);
    return lerp(iy0, iy1, sz);
  };
}
