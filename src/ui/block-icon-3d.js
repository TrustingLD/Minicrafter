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
// `faces.shape === 'stairs'` : compose 2 boîtes (pas forcément cubiques) en profil
// L au lieu d'un cube plein unique -- cf. mkBox plus bas.
export function createBlockIcon3D(faces, size = 28) {
  const cube = document.createElement('div');
  cube.className = 'blockIcon3d';
  cube.style.width = `${size}px`;
  cube.style.height = `${size}px`;

  if (faces.shape === 'stairs') {
    // même échelle que le cube plein ci-dessous (faceSize = 0.62*size, l'arête du
    // "bloc unité" dont l'escalier n'occupe qu'une partie) + même décomposition
    // en 2 boîtes que render/block-assets.js buildStairsGeometry (dossier plein
    // à l'arrière, marche basse mi-hauteur devant) : dossier centré en x/y, reculé
    // d'1/4 d'arête en z ; marche basse centrée en x, abaissée d'1/4 d'arête en y
    // (positif = vers le bas à l'écran, cf. commentaire de mkBox) et avancée d'1/4
    // d'arête en z.
    const edge = size * 0.62;
    cube.appendChild(mkBox(faces, edge, edge, edge * 0.5, 0, 0, -edge * 0.25));
    cube.appendChild(mkBox(faces, edge, edge * 0.5, edge * 0.5, 0, edge * 0.25, edge * 0.25));
    return cube;
  }

  const faceSize = `${size * 0.62}px`;
  const half = `${size * 0.31}px`;
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

// --- support "boîte quelconque" (pas forcément cubique), pour les formes en L ---
//
// Une face plate (pas nécessairement carrée) positionnée/tournée en CSS 3D pur,
// même principe que .blockIcon3dFace/.top/.left/.right mais avec des dimensions
// explicites (w/h en px) au lieu de la variable --bi3d-face partagée -- une boîte
// non cubique a des faces de tailles différentes selon l'axe.
function mkBoxFace(cls, img, w, h, extraTransform) {
  const f = document.createElement('div');
  f.className = `blockIcon3dFace ${cls}`;
  f.style.backgroundImage = `url(${toDataUrl(img)})`;
  f.style.width = `${w}px`;
  f.style.height = `${h}px`;
  f.style.top = `calc(50% - ${h / 2}px)`;
  f.style.left = `calc(50% - ${w / 2}px)`;
  f.style.transform = extraTransform;
  return f;
}

// Une boîte (w,h,d en px) décentrée de (dx,dy,dz) par rapport au centre du bloc
// unité -- sert à positionner les 2 boîtes qui composent le profil en L d'un
// escalier dans le MÊME espace 3D que le cube plein (même rotation globale du
// parent .blockIcon3d, cf. CSS), pour que les 2 formes d'icône restent cohérentes
// entre elles. Convention (comme le cube plein ci-dessus, dont cette fonction
// généralise la logique à une boîte non cubique) : w=X (droite+), h=Y à l'écran
// AVANT d'appliquer la rotation isométrique du parent -- dy positif pousse donc
// la boîte vers le BAS à l'écran (CSS classique), alors que d/2 (profondeur)
// pousse la face "top" vers le HAUT une fois tournée de 90° -- c'est pour ça que
// dy doit être passé déjà inversé par l'appelant (monde Y+ = haut -> dy = -delta).
function mkBox(faces, w, h, d, dx, dy, dz) {
  const box = document.createElement('div');
  box.style.position = 'absolute';
  box.style.top = '0';
  box.style.left = '0';
  box.style.width = '100%';
  box.style.height = '100%';
  box.style.transformStyle = 'preserve-3d';
  box.style.transform = `translate3d(${dx}px, ${dy}px, ${dz}px)`;
  box.appendChild(mkBoxFace('top', faces.top, w, d, `rotateX(90deg) translateZ(${h / 2}px)`));
  box.appendChild(mkBoxFace('left', faces.left, w, h, `translateZ(${d / 2}px)`));
  box.appendChild(mkBoxFace('right', faces.right, d, h, `rotateY(90deg) translateZ(${w / 2}px)`));
  return box;
}
