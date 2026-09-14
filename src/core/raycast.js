// DDA voxel : avance bloc par bloc le long d'un rayon. Coût O(portée en blocs), donc
// indépendant du nombre de chunks chargés — contrairement à
// Raycaster.intersectObjects(chunkMeshList) qui teste chaque triangle de chaque chunk.
export function voxelRaycast(getBlock, origin, dir, maxDist) {
  let x = Math.floor(origin.x),
    y = Math.floor(origin.y),
    z = Math.floor(origin.z);
  const stepX = Math.sign(dir.x),
    stepY = Math.sign(dir.y),
    stepZ = Math.sign(dir.z);
  const tDelta = (d) => (d === 0 ? Infinity : Math.abs(1 / d));
  let tMaxX =
    stepX === 0
      ? Infinity
      : (stepX > 0 ? Math.floor(origin.x) + 1 - origin.x : origin.x - Math.floor(origin.x)) /
        Math.abs(dir.x);
  let tMaxY =
    stepY === 0
      ? Infinity
      : (stepY > 0 ? Math.floor(origin.y) + 1 - origin.y : origin.y - Math.floor(origin.y)) /
        Math.abs(dir.y);
  let tMaxZ =
    stepZ === 0
      ? Infinity
      : (stepZ > 0 ? Math.floor(origin.z) + 1 - origin.z : origin.z - Math.floor(origin.z)) /
        Math.abs(dir.z);
  const dtX = tDelta(dir.x),
    dtY = tDelta(dir.y),
    dtZ = tDelta(dir.z);
  let t = 0,
    normal = { x: 0, y: 0, z: 0 };
  while (t <= maxDist) {
    const type = getBlock(x, y, z);
    if (type) {
      return {
        block: { x, y, z },
        place: { x: x + normal.x, y: y + normal.y, z: z + normal.z },
        dist: t,
      };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += dtX;
      normal = { x: -stepX, y: 0, z: 0 };
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += dtY;
      normal = { x: 0, y: -stepY, z: 0 };
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += dtZ;
      normal = { x: 0, y: 0, z: -stepZ };
    }
  }
  return null;
}
