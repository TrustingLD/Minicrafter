// Icône 3D des blocs dans les inventaires (hotbar, sac à dos, four) : un vrai
// petit cube rendu en CSS 3D (3 faces visibles, dessus/gauche/droite), texturé
// avec les mêmes canvases procéduraux que le bloc réel en jeu (cf.
// render/block-assets.js: iconFaces3D()). Pas de rendu Three.js séparé pour ça :
// juste 3 <div> positionnés/tournés avec des transforms CSS, ce qui reste bon
// marché même appelé pour chaque slot à chaque render() de l'inventaire.

// canvas -> dataURL, mémorisé une seule fois par texture (les mêmes canvases
// procéduraux sont réutilisés pour toutes les icônes du même type de bloc).
const dataUrlCache = new Map();
function toDataUrl(canvas) {
  let url = dataUrlCache.get(canvas);
  if (!url) {
    url = canvas.toDataURL();
    dataUrlCache.set(canvas, url);
  }
  return url;
}

// faces: { top, left, right } (canvas). size: taille du cube en px.
export function createBlockIcon3D(faces, size = 28) {
  const cube = document.createElement('div');
  cube.className = 'blockIcon3d';
  const faceSize = `${size * 0.62}px`;
  const half = `${size * 0.31}px`;
  cube.style.width = `${size}px`;
  cube.style.height = `${size}px`;
  cube.style.setProperty('--bi3d-face', faceSize);
  cube.style.setProperty('--bi3d-half', half);

  const mkFace = (cls, img) => {
    const f = document.createElement('div');
    f.className = `blockIcon3dFace ${cls}`;
    f.style.backgroundImage = `url(${toDataUrl(img)})`;
    return f;
  };
  cube.appendChild(mkFace('top', faces.top));
  cube.appendChild(mkFace('left', faces.left));
  cube.appendChild(mkFace('right', faces.right));
  return cube;
}
