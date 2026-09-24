// Pack de textures « 16x16 » (Phase 37) : GÉNÉRÉ par tools/gen-pixel16.mjs, pas dessiné
// à la main -- chaque bloc ci-dessous est une grille RÉELLE de 16x16 cases (cf. pixelTex
// plus bas, même technique que le bateau dans textures.js : BOAT_PIXELS/BOAT_PALETTE),
// obtenue en réduisant la texture procédurale d'origine (32x32) case par case puis en
// regroupant ses couleurs en un petit nuancier (k-means, ~10 teintes) -- le rendu "gros
// pixels" typique d'un pack 16x16, à la place du bruit fin de la texture de base.
//
// Couvre les 49 FACES DE BLOC du monde (celles de render/atlas.js) ; les outils, la
// nourriture, les mobs et les états on/off (redstone, leviers, boutons, répéteur) ne
// sont PAS repris ici et restent sur la texture de base même quand ce pack est actif
// (cf. textures-select.js) : ce ne sont pas des faces de bloc.

import { newCanvas, canvasToTexture, TEX_SIZE } from './textures.js';

function pixelTex(rows, palette) {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
  const px = TEX_SIZE / rows.length;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (!color) return; // '.' : transparent (torche, porte, lit...)
      ctx.fillStyle = color;
      ctx.fillRect(x * px, y * px, px, px);
    });
  });
  return canvasToTexture(c);
}

const texGrassTopRows = [
  'fihgffefffghfffa',
  'ficcjffcffhcfeff',
  'effhfeffffchhjfi',
  'cjjcefbffijiieif',
  'hgffiiffbchffbfj',
  'bhhcgfaaaahfffih',
  'bfihcfjaaaebeffc',
  'bdffffbaaacfiffh',
  'faabijhdchhcffff',
  'fdajigichhhifbff',
  'jijiegghghhibfff',
  'jhhhhcghgihhifff',
  'fijhhghhhhhcefff',
  'icabiehfdhhififb',
  'iidajffdfhhiiiii',
  'cbcadfffifehhhie',
];
const texGrassTopPalette = { a: '#61d631', b: '#58c22b', c: '#469f20', d: '#53bb28', e: '#4cac23', f: '#50b424', g: '#3a8a1a', h: '#429820', i: '#49a622', j: '#4eb023' };
export function texGrassTop() {
  return pixelTex(texGrassTopRows, texGrassTopPalette);
}

const texGrassSideRows = [
  'abbbbbbbbabbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbabbbbbabbbb',
  'babababaaabaabbb',
  'aacececaajecdccc',
  'ccejjfjeejjjdejj',
  'ddfgjjijfjjjiijj',
  'ddfgjjjjjfififjj',
  'fdfjjjjjjffjjjjf',
  'fjjjjjfdfjjjjjjj',
  'jhjjjgdfdiijjjjj',
  'ihhidigddffjijji',
  'jhhgjhhihjjjjjjj',
  'jjiffjhhijgiijij',
  'jfgfdfjjjjhhhjjj',
  'jjfddffjjjihhjjj',
];
const texGrassSidePalette = { a: '#4ea320', b: '#51b424', c: '#62821b', d: '#713d0e', e: '#776c19', f: '#7d4510', g: '#864a13', h: '#9b5820', i: '#925319', j: '#8a4d12' };
export function texGrassSide() {
  return pixelTex(texGrassSideRows, texGrassSidePalette);
}

const texDirtRows = [
  'jjbgcajjecgjjjjj',
  'jjfdiidjcbhbeffd',
  'jjjiiidjjecgbhii',
  'jjecfajjjjcbefbb',
  'jjbbcjjjjjcjjadb',
  'jfbbcfjjjjjddiii',
  'ibgbdjjjjjfiiiii',
  'fcchcjjcajjiiifj',
  'dffjeabggccffijf',
  'iicjggggbbjhjfjj',
  'iifjjbgggbjbbjjj',
  'hicjjjebgbjbafjj',
  'jjjjjjjegcjcffbb',
  'cjeajjjjjjjjjabb',
  'jebbcjjgjggajebb',
  'jebbcjjfcbbbjjfe',
];
const texDirtPalette = { a: '#814814', b: '#6c3c0e', c: '#794412', d: '#905119', e: '#854a11', f: '#96551c', g: '#56300f', h: '#884e17', i: '#9d5922', j: '#8a4d12' };
export function texDirt() {
  return pixelTex(texDirtRows, texDirtPalette);
}

const texStoneRows = [
  'diiaaajagbbbfaaa',
  'iiiaahaadbbbbaaj',
  'eeddafaddjagaaaa',
  'igeiidaaciiahiaa',
  'iiicihaeeicbjiea',
  'ciiiidafadjbfaja',
  'dhdadajaaaaagaaj',
  'aaaafafaaabbbgaa',
  'faafaajagfbbbfaa',
  'aaaajhiidfbbdccd',
  'ajabahiiefddaagg',
  'aaajddijgddcibbb',
  'deejihjaahciibab',
  'jiihghiafjiijafa',
  'ahhaeijaaadihged',
  'aaadjaahaaegadii',
];
const texStonePalette = { a: '#8e8e8e', b: '#9d9d9d', c: '#757575', d: '#898989', e: '#7e7e7e', f: '#969696', g: '#929292', h: '#858585', i: '#7c7c7c', j: '#828282' };
export function texStone() {
  return pixelTex(texStoneRows, texStonePalette);
}

const texWoodTopRows = [
  'aaaaadfjjfdaaaah',
  'aaadcbbjjbbcdaaa',
  'aadbbfahhhfbbdaa',
  'adbihfbffbfhibda',
  'acbhcdfjjfdchbca',
  'dbffdjdffdcdffbd',
  'jbhbfdeffedfbhbf',
  'jjhfjffggffjjhjj',
  'jjhfjffggffjfhjj',
  'fbhbfdeffedfbhjf',
  'hbffdcddfdcdffbd',
  'acbhcdfjjfdchbca',
  'adbihjbffbfhibda',
  'aadbbfhhhhfbbdha',
  'aaadcbbjjjbcdaaa',
  'aaaahdfjjfdhaaaa',
];
const texWoodTopPalette = { a: '#a77029', b: '#7e4e1b', c: '#7c4d1a', d: '#996424', e: '#7a4b19', f: '#89581f', g: '#47260a', h: '#a16b27', i: '#794b1a', j: '#80501c' };
export function texWoodTop() {
  return pixelTex(texWoodTopRows, texWoodTopPalette);
}

const texWoodSideRows = [
  'haahaajaahabjaah',
  'haahaajaahaajaah',
  'haaiaajaaaaajabb',
  'haahabjaahabjaac',
  'haahaajaaifieaah',
  'haahaajaahddeabh',
  'haahaaebagddeabh',
  'haaaaacaahddebab',
  'haabaajaahbgjaah',
  'haahaajaahaajaah',
  'haababjaahaajaah',
  'haahaagaahaajaah',
  'haahaajaabaajaac',
  'habhaajaahaajaah',
  'haahaajaahaajbah',
  'haahaajaahaajaah',
];
const texWoodSidePalette = { a: '#59300e', b: '#502b0c', c: '#47260a', d: '#251204', e: '#371c07', f: '#4c280b', g: '#4b280b', h: '#4c280b', i: '#402109', j: '#3e2008' };
export function texWoodSide() {
  return pixelTex(texWoodSideRows, texWoodSidePalette);
}

const texLeavesRows = [
  'igedheddjdiaigeb',
  'hhcjgcdhbbagjcbb',
  'ahiciggebbjgiijd',
  'aiicdehhbbdhiigg',
  'giffddgijddddfdd',
  'eddaddegjjddjjbb',
  'fhddddddjeddedbe',
  'hidededjaaeeebbj',
  'fgbbbdbbeaihbebb',
  'hjbebbbbbgagebdh',
  'ifhdebebejedhdia',
  'hfhjdbbjcjdhigaa',
  'dgfeddddddeiiaaa',
  'beidgjdjddchiaad',
  'beddedjddfiagaje',
  'bbddjddddfhagahi',
];
const texLeavesPalette = { a: '#0b340e', b: '#24a12c', c: '#0f4a13', d: '#18761d', e: '#1f8824', f: '#104f14', g: '#135717', h: '#17671b', i: '#0e4411', j: '#146118' };
export function texLeaves() {
  return pixelTex(texLeavesRows, texLeavesPalette);
}

const texPlanksRows = [
  'ffifffffiffffffi',
  'bdbbbbfbbbbbbbdb',
  'caccccccccccccac',
  'cccccccccccccccc',
  'iiiiiiiiiiiiiiii',
  'edeeeeeeeeeeeede',
  'fdffffffefffffdf',
  'jjeeeeeeeeeeeeee',
  'feffffffffaaaaaa',
  'gdgggggghhhhhhdh',
  'gdgggggeggggggdg',
  'hhhhhhhhhhcccccc',
  'iiiiiiiiiiiiiiii',
  'adaaaaaaaaaaaada',
  'jdjjjjjjjjjjjede',
  'jjjjjjjjjjjjjjjj',
];
const texPlanksPalette = { a: '#ae813e', b: '#af884c', c: '#e0b060', d: '#8e6a33', e: '#c59140', f: '#bb8a40', g: '#c99d56', h: '#d6a75c', i: '#b27e31', j: '#d09941' };
export function texPlanks() {
  return pixelTex(texPlanksRows, texPlanksPalette);
}

const texCraftTopRows = [
  'ajjjjjjjjjjjjjja',
  'jbjjjjjbbjjjjjbj',
  'jjdaaaejjeeeedjj',
  'jjaiafejjeeeeejj',
  'jjaaefejjeeeeejj',
  'jjafffefjeeddejj',
  'jjeeeeejjeedeejj',
  'jbjjjjjbbjjjjjbj',
  'jbjjjjjbbjjjjjbj',
  'jjeeeeefjeeeeejf',
  'jjeeeeejjefffajj',
  'jceeeeejjefeaajj',
  'jjeeeedjjdfaiajf',
  'jjeeeeejjeaaadjj',
  'jbjjjjjbbjjjjjbj',
  'ajjfjjjjjcjjjjja',
];
const texCraftTopPalette = { a: '#a56d26', b: '#714717', c: '#905f23', d: '#ba7f2e', e: '#bb7f2d', f: '#87561d', g: '#bb7f2d', h: '#bb7f2d', i: '#905c1f', j: '#8c5b1f' };
export function texCraftTop() {
  return pixelTex(texCraftTopRows, texCraftTopPalette);
}

const texCraftSideRows = [
  'iiiiiiafaiiiiidi',
  'hjjjjjjjjjjjjjjc',
  'hjchhhehhhhhhhjh',
  'hjhhhhhhhhhhhhjh',
  'ibiiiiiiiiiiiibi',
  'hjhhhhhhhhhhhhjh',
  'cjhchcehhhhhhhjh',
  'hjhhchhhchhchhjh',
  'ibiiiiiidiiiiabi',
  'hjhhhhhehhchhhjh',
  'hjehhhhehhhhhhjh',
  'hjhhhhjjjjhhghje',
  'ibiiiibbbbiiiibi',
  'hjhhhhhhhhhhhhjh',
  'hjjjjjjjjjjjjjjh',
  'chhhhhhhchhhhhhh',
];
const texCraftSidePalette = { a: '#744014', b: '#2e1907', c: '#8f5016', d: '#65370e', e: '#834911', f: '#6b3a0f', g: '#884c15', h: '#8a4d12', i: '#66370f', j: '#3f2309' };
export function texCraftSide() {
  return pixelTex(texCraftSideRows, texCraftSidePalette);
}

const texSnowRows = [
  'hhhhhhhhhhhhhahh',
  'ccahhffhhhfhhaah',
  'ccahbhhhaahhgcch',
  'cchcahhhhhfhhdaa',
  'hhdccdhbhdcchhdb',
  'hhgccghahacchecc',
  'hhhjiihbhgcaefdc',
  'hhhbjbbhhhhaefff',
  'fhhhhhhhhhhhhffi',
  'bhahagahhhbhbfff',
  'hhahacchhbhhbfff',
  'hhhhacchhefiiffj',
  'hhahhdghbfifieje',
  'hhhhhhebaiiiijfj',
  'hhfhahjgcjiifjfi',
  'bhhhhhjfehhhhbff',
];
const texSnowPalette = { a: '#f7f9fc', b: '#f0f4f9', c: '#fdfefe', d: '#f6f8fc', e: '#f2f6fa', f: '#e8eef6', g: '#f5f8fb', h: '#f4f7fb', i: '#e0e8f3', j: '#ecf1f8' };
export function texSnow() {
  return pixelTex(texSnowRows, texSnowPalette);
}

const texCoalOreRows = [
  'iiiihiiiiiihiiii',
  'iiiiihiiiiigihii',
  'hiiiiiiiiibiiiff',
  'iiiiiiiiigjgajee',
  'iiiiiibgjjgddiee',
  'bbigiibjjjbddafe',
  'jjgjeejbjjbddhee',
  'jfeeeefgbbiicijf',
  'geeeeejiiiiiiiig',
  'ifeejjiiibffghii',
  'gbghhiiiifeefiii',
  'eeghjjgiijeejiii',
  'eejfefjgiijbiiii',
  'ffagefjgiiiiiiii',
  'iaddabgiiiiiiiii',
  'gihddaiiiiihiiii',
];
const texCoalOrePalette = { a: '#909090', b: '#898989', c: '#8e8e8e', d: '#9c9c9c', e: '#0f0f0f', f: '#484848', g: '#838383', h: '#969696', i: '#8e8e8e', j: '#787878' };
export function texCoalOre() {
  return pixelTex(texCoalOreRows, texCoalOrePalette);
}

const texIronOreRows = [
  'aaiiiiiiibiiiiii',
  'jjaaaiibiiiiiiii',
  'jjajjiigiiiiiiii',
  'aeheebddbiiiigii',
  'heheefddiiigddgb',
  'fffbbhcgibigdddi',
  'faabicehiiigdddi',
  'ajjigihgbiiiiiff',
  'faaiiibddggiibff',
  'ffiiiigddgbbiiff',
  'iiiiiigddbfbiiib',
  'iigibiiiiibiibii',
  'ibiiiiiiiiiiibii',
  'giiiiaaiiiiiiiii',
  'iigiijjiiigddiii',
  'iigiiaaiiigddgii',
];
const texIronOrePalette = { a: '#bb8e6b', b: '#878686', c: '#d0aa86', d: '#9d9d9d', e: '#f1b680', f: '#7e7d7c', g: '#959595', h: '#a79586', i: '#8e8e8e', j: '#e48e4c' };
export function texIronOre() {
  return pixelTex(texIronOreRows, texIronOrePalette);
}

const texGoldOreRows = [
  'egfidddaebbbeiff',
  'eiffcddieeegcfff',
  'egffieebbbecjjff',
  'ehifeeebbbbcjjii',
  'eeeheeebbbbhigee',
  'hddceeeebbeeeeee',
  'adddebeeeeeeecjc',
  'hcdagigeeeeegjjj',
  'fgegfhfeeeeehjjj',
  'fgegfffeehfighjj',
  'iiehiigeeiffficj',
  'ebhhaddifffffbee',
  'egffcddcffiigeee',
  'egffdddaifgebeei',
  'eegcddabbebeeeee',
  'eeeaddebbeeeeeee',
];
const texGoldOrePalette = { a: '#9f977d', b: '#818181', c: '#c3b37e', d: '#f6ce4a', e: '#8e8e8d', f: '#9e9e9d', g: '#939392', h: '#8f8f8e', i: '#999897', j: '#ebd37b' };
export function texGoldOre() {
  return pixelTex(texGoldOreRows, texGoldOrePalette);
}

const texDiamondOreRows = [
  'aabjhhfddggggggj',
  'aabhhhdaabgggggg',
  'ddfjhhdaabggcjig',
  'iedfccidbggidegg',
  'gbabgggggggeigba',
  'gbaabggjgggggcaa',
  'gidbiigjggeggjdb',
  'gggggggjgidigjhh',
  'ggcjcjgggeieichh',
  'gchhhcggggjjiigc',
  'gjhhhgcgggeeddig',
  'gchhhjbjfeddiieg',
  'ggjjjbabeiddggij',
  'ggggbbbddddegggg',
  'ggjbaacidediggig',
  'gggdaaeeddiggggg',
];
const texDiamondOrePalette = { a: '#b1fafa', b: '#8fc1c1', c: '#8a8b8b', d: '#99a0a0', e: '#919292', f: '#8d8d8d', g: '#8e8e8e', h: '#7d7d7d', i: '#969797', j: '#848686' };
export function texDiamondOre() {
  return pixelTex(texDiamondOreRows, texDiamondOrePalette);
}

const texRedstoneOreRows = [
  'jjjjjffjjjjjjjjj',
  'jfjjfddffiijjjjj',
  'jjjjfddfibbajjjc',
  'ccjjjffjibbijjjj',
  'jjcjjjjefiiddjhh',
  'jjjjjfcjcjfdfcee',
  'jfjccechjjgiigee',
  'jjjfeeeejhibbafg',
  'jjjceeeeecabbibb',
  'jfjjcjeechibbbbb',
  'jjjjjjjfjfabbiaa',
  'jjjjfjfdfjjhjjjj',
  'jfbigjjffbbdjjjj',
  'jibbijfjgbbidjjj',
  'jabbajjjjiifhdfc',
  'jjffjjjjjfjfdfdj',
];
const texRedstoneOrePalette = { a: '#a27673', b: '#e02f22', c: '#979797', d: '#807f7f', e: '#9d9d9d', f: '#898686', g: '#a28d8b', h: '#929292', i: '#bc5d55', j: '#8e8e8e' };
export function texRedstoneOre() {
  return pixelTex(texRedstoneOreRows, texRedstoneOrePalette);
}

const texBedrockRows = [
  'djjjjjjjjjbhhhdj',
  'ijjjjbjjjjhhhhjb',
  'fiiffjhbdijbbbjj',
  'fiffffhefajbjjjj',
  'adffefhifajjjjjj',
  'jjgfiahjbjjjjjjj',
  'ejbddjijjjijhbjj',
  'ffejjjjjjjjbhhjj',
  'figijijjbaajbjjj',
  'ifijjjjhjfieidji',
  'adjjjjihhffifgeh',
  'jjjbjjbbjgffiffh',
  'ibbjbjijjafcicfd',
  'gfjjbjhjbgfffifj',
  'gejjjjjjdfccfajj',
  'jbjjijjbdffifdbj',
];
const texBedrockPalette = { a: '#27272c', b: '#1c1c1e', c: '#3c3c44', d: '#252529', e: '#303036', f: '#38383f', g: '#333339', h: '#121215', i: '#2b2b30', j: '#232326' };
export function texBedrock() {
  return pixelTex(texBedrockRows, texBedrockPalette);
}

const texTorchStickRows = [
  'aaaaabbbbbbaaaaa',
  'aaaaabbbbbbaaaaa',
  'ccccabbbbbbacccc',
  'cccccccccccccccc',
  'dddddddddddddddd',
  'ffffffffffffffff',
  'eeieeeeieeeieeee',
  'gefgiigfeggfigge',
  'gefgiigfeggfigge',
  'gefgiigfeggfigge',
  'gefgiigfeggfigge',
  'gefgiigfeggfigge',
  'gefgiigfeggfigge',
  'gefgiigfeggfigge',
  'gefgiigfeggfigge',
  'gefgiigfeggfigge',
];
const texTorchStickPalette = { a: '#ffe181', b: '#fffbe0', c: '#fbb534', d: '#f59223', e: '#523319', f: '#7a4a20', g: '#6b4423', h: '#6b4423', i: '#5f3c1e', j: '#6b4423' };
export function texTorchStick() {
  return pixelTex(texTorchStickRows, texTorchStickPalette);
}

const texTorchFlameRows = [
  'aaaaaaffffaaaaaa',
  'aaaafjbbbbjfaaaa',
  'aaajbchhhhcbjaaa',
  'aajihhddddhhijaa',
  'afbhhddddddhhbfa',
  'ajchddeeeeddhcja',
  'fbhddeeggeeddhbf',
  'fbhddeggggeddhbf',
  'fbhddeggggeddhbf',
  'fbhddeeggeeddhbf',
  'ajchddeeeeddhcja',
  'afbhhddddddhhbfa',
  'aajihhddddhhijaa',
  'aaajbchhhhcbjaaa',
  'aaaafjbbbbjfaaaa',
  'aaaaaaffffaaaaaa',
];
const texTorchFlamePalette = { a: '#ef7b17', b: '#f5992c', c: '#f7a534', d: '#fecd56', e: '#ffe18a', f: '#f1851d', g: '#ffefbd', h: '#f9b23d', i: '#f69e2f', j: '#f38f25' };
export function texTorchFlame() {
  return pixelTex(texTorchFlameRows, texTorchFlamePalette);
}

const texTorchWoodRows = [
  'cccccccccccccccc',
  'cccacccccccccccc',
  'cccccccccccccccc',
  'bacccccccccccccc',
  'cccccccccccccccc',
  'ccccbccccccaaccc',
  'cccccccccccccccc',
  'cccccccccccbccca',
  'cccacccbccaccccc',
  'ccccccacbcccbccc',
  'cccccccccccccccc',
  'ccccccaccccccccc',
  'cccccccccccccccc',
  'cccccccccccacccc',
  'cccccccccccccaca',
  'cccccccccccccccc',
];
const texTorchWoodPalette = { a: '#654021', b: '#714926', c: '#6b4423' };
export function texTorchWood() {
  return pixelTex(texTorchWoodRows, texTorchWoodPalette);
}

const texFurnaceRows = [
  'jjjfaaaabbfbbbbb',
  'jjjjaaaabbbbbbbb',
  'jjjjaaaabbbbbbbb',
  'fjfdddddcccccabb',
  'bbjhhhhhhhhhhjbb',
  'bbjheeeeeeeehjbb',
  'bbjheeeeeeeehabb',
  'bbjheeeeeeeehabb',
  'jjfhiggggggihfbb',
  'jjfhiggggggihfbb',
  'jjfhiggggggihfbb',
  'jfcheiiiiiiehfbb',
  'jjfddddddddddfaj',
  'jjjjbjjabbbbfjaa',
  'jjjjbjjjbbbbjjaa',
  'ajjjjjjjbfbbjjjj',
];
const texFurnacePalette = { a: '#535353', b: '#616161', c: '#363636', d: '#313131', e: '#191818', f: '#414141', g: '#ff983b', h: '#232323', i: '#462c1b', j: '#4a4a4a' };
export function texFurnace() {
  return pixelTex(texFurnaceRows, texFurnacePalette);
}

const texWoolRows = [
  'bgeiggcebggggggg',
  'ggjhichhgggbgggg',
  'gbeigehjgggggggg',
  'gggggbggbfbdgbeg',
  'ggggbgggjiaagihh',
  'ggggggbgcbaagjhh',
  'gggggggdaddfghhf',
  'bgggggggbfggggda',
  'gggggggggggbgdaa',
  'bggggggggggbggdd',
  'ggcfjgggggfabhbb',
  'gbjhhecbggdabhhb',
  'ggchjhhjgggfejcg',
  'ijcgghhjggeieggg',
  'hhhbgeigggihigbg',
  'hhhggggbbggcgggg',
];
const texWoolPalette = { a: '#dad2bd', b: '#e2dbca', c: '#e9e3d5', d: '#e6dfd0', e: '#e8e2d4', f: '#e7e1d2', g: '#e8e2d4', h: '#f1ecde', i: '#ebe5d7', j: '#ede7d9' };
export function texWool() {
  return pixelTex(texWoolRows, texWoolPalette);
}

const texSandRows = [
  'cbbebgbbcccccccc',
  'eafcbcaaggbcccbb',
  'cccfccccccaegeaa',
  'ccccfcfcccfcfccc',
  'eebbcccccccccbbg',
  'cbfeebcbfcbbcagc',
  'ccccffgceeaacccc',
  'bccffcbbcccccbbb',
  'acbcccccccbfgffa',
  'ccaefbbbbgfcccfc',
  'ccfbabaaaccccccc',
  'bccccccccbbeecbb',
  'gbbcfcbbefbccfaa',
  'caaegeaacccccccc',
  'cccccccccfcccccc',
  'cccccccccccccbcc',
];
const texSandPalette = { a: '#dfc88a', b: '#e5d096', c: '#e2cb8e', d: '#e2cb8e', e: '#e1cc92', f: '#dbc385', g: '#e2cc90', h: '#e2cb8e', i: '#e2cb8e', j: '#e2cb8e' };
export function texSand() {
  return pixelTex(texSandRows, texSandPalette);
}

const texSandstoneRows = [
  'bbababbbbbbbbbbb',
  'bbbbbbbbbabbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbabbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbabbbbbabbbabbb',
  'babbbbbbbbbbbbbb',
  'abbbbbbbabbbbbbb',
  'babbbbbbbbbbbabb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbabbbbbba',
  'bbbbbbbbabbbbbbb',
  'babbbbbbbbbbbbbb',
  'bbabbbbbbbbbbabb',
  'bbbbabbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
];
const texSandstonePalette = { a: '#ceb87e', b: '#d3bd83', c: '#d3bd83' };
export function texSandstone() {
  return pixelTex(texSandstoneRows, texSandstonePalette);
}

const texCactusRows = [
  'ggibgggibeggdcgg',
  'gghbgggibbcfjbgg',
  'gdicdgcibcecdcge',
  'gcacgcbibgecjbcb',
  'ggibgebhbgebdbfe',
  'ggibggfibggedcgf',
  'gghbgggibfcfjcfg',
  'fdibgggibgggdcgg',
  'ddhbgcgibggedcgc',
  'ddibccgibgcbdcff',
  'gfibbbbibgcbdcgg',
  'gfhbbbbibgecdcfd',
  'ggibcbeibgccdcdg',
  'fgibgggibecjdbdd',
  'dfhbggjabbgbdbfg',
  'gfibgebicbccdbgg',
];
const texCactusPalette = { a: '#4e6b3a', b: '#4d903e', c: '#488839', d: '#376b2b', e: '#428235', f: '#3c752f', g: '#3f7d32', h: '#637b4b', i: '#2f5d25', j: '#72985b' };
export function texCactus() {
  return pixelTex(texCactusRows, texCactusPalette);
}

const texDeadBushRows = [
  '......aa.bb.f..e',
  'eh....gdig..je.e',
  '.ddc..jgbd.gj..b',
  '..bej.gbg.gf..ce',
  '..bhf.dgg.jf..di',
  '..bef..gjd.fi.bi',
  '.hgff..cjjafc.bd',
  '.cifjb.gjffg.hbj',
  '.d.jjfjjcjf..dgd',
  '.e.ijfjehjj..bgb',
  '.cd.ejjjggg.dgbh',
  '..ejfjjgjeghgd..',
  '...gfgjiffgib...',
  '...jbggcjfbbb...',
  '...bjag.gjjge...',
  '...bjab.jgfgi...',
];
const texDeadBushPalette = { a: '#291c10', b: '#49321d', c: '#1a120a', d: '#2f2013', e: '#392717', f: '#7e5a36', g: '#583e25', h: '#120c07', i: '#23180e', j: '#6a4b2c' };
export function texDeadBush() {
  return pixelTex(texDeadBushRows, texDeadBushPalette);
}

const texIceRows = [
  'dddddddddddddddd',
  'dddddddddddddddd',
  'dddddddddgecdddd',
  'dddddddddggddddd',
  'ddbgaddddgaddddd',
  'dddbegadcgdddddd',
  'dddddcbdegdddddd',
  'dddddddcggdddddd',
  'degggggggggggedd',
  'ddddddbgegdddddd',
  'ddddddeagcdddddd',
  'dddddddcgddddddd',
  'dddddddeeddddddd',
  'dddddddecddddddd',
  'dddddddddddddddd',
  'dddddddddddddddd',
];
const texIcePalette = { a: '#aedbf1', b: '#aad9f0', c: '#a9d8f0', d: '#a8d8f0', e: '#b5def2', f: '#a8d8f0', g: '#c3e4f5', h: '#a8d8f0', i: '#a8d8f0', j: '#a8d8f0' };
export function texIce() {
  return pixelTex(texIceRows, texIcePalette);
}

const texWeedsRows = [
  '................',
  '........d.......',
  '........c.......',
  '...e....if.gf...',
  '..di..ffic.geaj.',
  '..ii..cigc.iecc.',
  '..ai..jegc.adjg.',
  '..di.hjhgc.dabd.',
  '..ei.dchgc.dibf.',
  '..ei.gafcg.ecb..',
  '..fi.jffcg.fjb..',
  '..fi.j.fcg.fjj..',
  '..hifj.fci.hbj..',
  '..hgdc.eci.hbg..',
  '..hgga.eci..ba..',
  '..hgjf.dca..bd..',
];
const texWeedsPalette = { a: '#2b6114', b: '#5cce2e', c: '#3b8a1a', d: '#255512', e: '#1e470e', f: '#17370b', g: '#347b17', h: '#102707', i: '#2c6d13', j: '#4ba924' };
export function texWeeds() {
  return pixelTex(texWeedsRows, texWeedsPalette);
}

const texBedFootRows = [
  'gcccbbjjjbjjjajj',
  'gcccccejajjjjehf',
  'bhccgcfjjjjjeccc',
  'jfhcccjjjjajficc',
  'jhbddidddddddiic',
  'jjjjjjhjjhjjefdf',
  'jjjjjjjjjjjjjjjj',
  'jffejjhjjjjjjjjj',
  'jhhddidddddddhhj',
  'jjjhjjjdjjjjeffj',
  'ffjjjjfcdjhdfbaa',
  'cidejjfcdjccdaaa',
  'ciicidddddiicbaa',
  'dchcidjjjdjjdgba',
  'jjhiccjjdcfjjjjj',
  'jjedcfbjhcejjajj',
];
const texBedFootPalette = { a: '#c33f3e', b: '#b73736', c: '#a62726', d: '#a92b2a', e: '#b62f2e', f: '#b32e2d', g: '#b43231', h: '#b02d2c', i: '#9d2524', j: '#b8302f' };
export function texBedFoot() {
  return pixelTex(texBedFootRows, texBedFootPalette);
}

const texBedPillowRows = [
  'fffffffffffgiigf',
  'fjjjjjjjjjjbbbbf',
  'fjffffffhhfeggjf',
  'hjfffffffffhffjf',
  'fjffffffcdffhfjf',
  'fjfffffhbbhfffjf',
  'fjccfffdbbdfffjf',
  'fjbbfhhfbbagggjd',
  'fjddffhaggiiiijb',
  'fjfhfffffgiiiijb',
  'fjffffffffggiibf',
  'fjfhffffffffeejf',
  'fjffffffhfeggajf',
  'fjffffffffgiiijf',
  'fjjjjjjjjjbbjjjf',
  'ffffffffdbfidhff',
];
const texBedPillowPalette = { a: '#f6f3ed', b: '#e4e0d4', c: '#f0ede4', d: '#eae5da', e: '#f5f2eb', f: '#f4f1ea', g: '#faf8f5', h: '#ede9e0', i: '#fefefe', j: '#ded8cc' };
export function texBedPillow() {
  return pixelTex(texBedPillowRows, texBedPillowPalette);
}

const texBedSideRows = [
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'bbbbbbbbbbbbbbbb',
  'ffffffffdffffcff',
  'fcfdffffffffffff',
  'fffcfdfffcffdfff',
  'fcffcffffeffffff',
  'cffffffffdfcffff',
  'fffdffffffffdfff',
  'fffffffffffffdff',
  'ffffffffdfffffff',
  'ffffffffffffffdf',
  'ffffcffffffffffd',
  'fffffffcfdffffff',
  'hhhhhhhhhhhhhhhh',
  'hhhhhhhhhhhhhhhh',
];
const texBedSidePalette = { a: '#e8e2d4', b: '#d9d2c2', c: '#ae2f30', d: '#a12627', e: '#a82c2d', f: '#a8282a', g: '#a8282a', h: '#6b4423' };
export function texBedSide() {
  return pixelTex(texBedSideRows, texBedSidePalette);
}

const texBedHeadSideRows = [
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'bbbbbbbbbbbbbbbb',
  'eeeeeeeeeeceeeee',
  'feeeeeeefeeeeeee',
  'eeeeeeeeeeeeeeee',
  'feeeefeeeeeeecee',
  'eeeeeeeeeeeeeeee',
  'eeeeeeeeeeeeecee',
  'eeeeeeeeeeeeeeee',
  'eeeefeeeeeeeeeee',
  'eefeeeffeeeeeeee',
  'eeeeefceceeeeeee',
  'eeeceeeeeeeeeefc',
  'dddddddddddddddd',
  'dddddddddddddddd',
];
const texBedHeadSidePalette = { a: '#eef1f2', b: '#dce0e2', c: '#a3abb1', d: '#6b4423', e: '#aab2b8', f: '#b1b9be', g: '#aab2b8' };
export function texBedHeadSide() {
  return pixelTex(texBedHeadSideRows, texBedHeadSidePalette);
}

const texDoorTopRows = [
  'feffffffffffffff',
  'fjjjjjjjjjjjjjjf',
  'fjagggajjagggajf',
  'fjghhhgjjghhhgjf',
  'fjghhhgjjghhhgjf',
  'fjghhdgjjjhhhgbf',
  'fjghhhgjjghhhgjf',
  'fjghhhgjgghhhgjf',
  'fjghhcgjjghhhgjf',
  'fjghhhgjjghhhgjf',
  'fjghhhgjjghhhgjf',
  'fjghhhgjjghhhgjf',
  'fjghhhjbjghhhgjf',
  'fjagggajjagggabf',
  'fjjjjjjjjjjjjjjf',
  'fffffffefeffffff',
];
const texDoorTopPalette = { a: '#69401c', b: '#815025', c: '#865429', d: '#915c2d', e: '#6b421d', f: '#5c3717', g: '#764922', h: '#8f5a2c', i: '#8f5a2c', j: '#7a4a22' };
export function texDoorTop() {
  return pixelTex(texDoorTopRows, texDoorTopPalette);
}

const texDoorBottomRows = [
  'ffffffffffffffff',
  'fjjjjjjjjjjjbgjf',
  'fjagggajjagggajf',
  'fjgiiigjjgiiigjf',
  'fjgiiiggjgiiigjf',
  'fjgiiigjjgiiigjf',
  'fjgiiigjjgiiigjf',
  'fjgiiigjjjibhajf',
  'fjgiiijjjbibcejf',
  'fjgiiigjjgibgejf',
  'fjgiiigjjgiiigja',
  'fjgiiigjjgiiigjf',
  'fjgiiigjjgiiigjf',
  'fjagggajjagggajf',
  'fjjjjjjjjjjjjjjf',
  'ffffffffffffafff',
];
const texDoorBottomPalette = { a: '#69401d', b: '#815125', c: '#dda73a', d: '#8f5a2c', e: '#70461e', f: '#5c3717', g: '#764922', h: '#956827', i: '#8f5a2c', j: '#7a4a22' };
export function texDoorBottom() {
  return pixelTex(texDoorBottomRows, texDoorBottomPalette);
}

const texGlassRows = [
  'aceeeeeeeeeeeeca',
  'c..............c',
  'e.dcb..........e',
  'e...d..........e',
  'e..............e',
  'e..............e',
  'e..............e',
  'e..............e',
  'e..............e',
  'e..............e',
  'e..............e',
  'e.........dcb..e',
  'e...........d..e',
  'e..............e',
  'c..............e',
  'aceeeeeeeeeeeeec',
];
const texGlassPalette = { a: '#c9dae4', b: '#333333', c: '#8c959b', d: '#666666', e: '#5b666c', f: '#5b666c', g: '#5b666c' };
export function texGlass() {
  return pixelTex(texGlassRows, texGlassPalette);
}

const texChestTopRows = [
  'aaffffffffffffaa',
  'aacccccccbdcdcaa',
  'fceeeeeeeeeeeecf',
  'fjiiddcdddddcdjf',
  'fjjcdeddddddddjf',
  'fcggeeeeeeeeegcf',
  'fjeeeeeeeeeeecjf',
  'fjdddeddddeeeijf',
  'fcidddcdddgehhif',
  'fdheeeeeeegehhif',
  'fdheeieeiccciecf',
  'figedddddjjjidjf',
  'fjdddedddcjiddjf',
  'fceeheeeeegeeecf',
  'aacdddicccccccaa',
  'aaffffffffffffaa',
];
const texChestTopPalette = { a: '#2d1a08', b: '#97652a', c: '#885820', d: '#946125', e: '#9e6727', f: '#42280e', g: '#9a6426', h: '#aa722e', i: '#8f5d23', j: '#82531e' };
export function texChestTop() {
  return pixelTex(texChestTopRows, texChestTopPalette);
}

const texChestSideRows = [
  'aaffffffffffffaa',
  'aaggggggbgggggaa',
  'fgiibiihddbiiigf',
  'fghiiibihigiiigf',
  'fgiiiiceecidhggf',
  'fbhihieeeeidddgf',
  'faaaaaceccaaaaaf',
  'fbiiddeeeeihddgf',
  'fgibiiceeciiiijf',
  'fgiiiiigggiiiijf',
  'fgihibibggiiiigf',
  'fgiiiiiibbiiiigf',
  'fgbiiiibgibiiigf',
  'fjggiiiibgiiiigf',
  'aajjbbggggggjgaa',
  'aaffffffffffffaa',
];
const texChestSidePalette = { a: '#261607', b: '#925e23', c: '#7b6c5c', d: '#af752f', e: '#aea69c', f: '#42280e', g: '#885720', h: '#a76e2c', i: '#9e6727', j: '#7b4e1b' };
export function texChestSide() {
  return pixelTex(texChestSideRows, texChestSidePalette);
}

const texRedstoneTorchStickRows = [
  '..a.......a.....',
  '................',
  '.....adddda.....',
  '.....fccccf.....',
  '.....fccccf..a..',
  '.....fbcccf.....',
  '.....fbcccf.....',
  '.....fccccf...a.',
  '.....fccccf.....',
  '...a.fccccf.....',
  '.....fccccf.....',
  '.....fccchf.....',
  '.....fccccf.....',
  '.....fhcchf.....',
  '.a...fccccf.a...',
  '.....fccccf.....',
];
const texRedstoneTorchStickPalette = { a: '#1f1f1f', b: '#949494', c: '#8d8d8d', d: '#555555', e: '#8d8d8d', f: '#383838', g: '#8d8d8d', h: '#868686', i: '#868686', j: '#8d8d8d' };
export function texRedstoneTorchStick() {
  return pixelTex(texRedstoneTorchStickRows, texRedstoneTorchStickPalette);
}

const texRedstoneBlockRows = [
  'affffffffffffffa',
  'fjieijjejcbbijjf',
  'feibcjjjjibbejjf',
  'fejjjjjjjjcecedf',
  'fcjjebejjjjejhha',
  'fjjjbbbjjjjjghha',
  'fjjjceijjjejjhha',
  'fjciibcjjjjjijjf',
  'fcbbebbcejjcbbif',
  'feecebbejjjebbcf',
  'fchhieeijjjcbejf',
  'fdhhgjjjjjejjjjf',
  'fghdjjjjjebbjjef',
  'fjjjjjjjjebcjjjf',
  'fjjjjjjejjcjjjjf',
  'affffffffffffffa',
];
const texRedstoneBlockPalette = { a: '#641107', b: '#c93a1e', c: '#b22714', d: '#9c1e0f', e: '#be311a', f: '#701409', g: '#a41e0f', h: '#91190c', i: '#ac2212', j: '#a81f10' };
export function texRedstoneBlock() {
  return pixelTex(texRedstoneBlockRows, texRedstoneBlockPalette);
}

const texPistonTopRows = [
  'aaaaaaaaaaaaaaaa',
  'addddddbdddcddda',
  'addddddddcddddda',
  'adddddddddddddda',
  'adddddddddddddda',
  'adbdddddddddddda',
  'adddddggggddddda',
  'adbdddgaagddddda',
  'adddddgaagddcdda',
  'addddbggggdcddda',
  'addddddddbddddda',
  'addddddddddbddda',
  'addddddddcddddda',
  'acdcdddddbdcddda',
  'adddddddddddddda',
  'aaaaaaaaaaaaaaaa',
];
const texPistonTopPalette = { a: '#5d5641', b: '#bfb6a0', c: '#b4ab95', d: '#b9b09a', e: '#b9b09a', f: '#b9b09a', g: '#908973' };
export function texPistonTop() {
  return pixelTex(texPistonTopRows, texPistonTopPalette);
}

const texPistonSideRows = [
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'aaaaaaaaaaaaaaaa',
  'jjjjjjjjjjjjjjjj',
  'jjjjjjjjjjjicgjj',
  'jjjjjjjjjjjdhdjj',
  'fdjjjjjjjjjgdejj',
  'hhijjjjjchechfjj',
  'hfjjjjjjefgfhhjj',
  'jjcfcjjjjjjefdjj',
  'jjhhfjjjjjjjjjjj',
  'icfhfjjjjjjjjjjj',
  'fhfgjjjjjjjjjjjj',
  'fhfjjjjjjjjjjjgj',
  'jcgjjjjjjjjjjfhe',
  'jjjjjjjjjjjjjdfg',
];
const texPistonSidePalette = { a: '#b3aa92', b: '#b9b09a', c: '#867753', d: '#847452', e: '#897955', f: '#80714e', g: '#8a7a56', h: '#796b4a', i: '#8a7a56', j: '#8a7a56' };
export function texPistonSide() {
  return pixelTex(texPistonSideRows, texPistonSidePalette);
}

const texObsidianRows = [
  'iiiiiaiiiiiiiiii',
  'iiiiiiihhbiiiiai',
  'iiiiiighhjeiiiii',
  'iaiiaighbheiiiii',
  'iifbgihjbbgiigji',
  'iifbgighgbdiiiii',
  'iiiiiiiiicgcaiii',
  'iiiiiiiigjbhhhei',
  'iiiiiighchbjjjgi',
  'iiiiiicgicbjjjci',
  'iijciiiaiibjheii',
  'iiahciiiiicbgiii',
  'iiibciiiiiiiiiii',
  'iibhgebciiiiiiij',
  'iajjhbjhiiiiiiib',
  'iihjbchgiiiiiiig',
];
const texObsidianPalette = { a: '#0c0614', b: '#140b23', c: '#0f0819', d: '#0d0716', e: '#0e0818', f: '#0e0717', g: '#11091d', h: '#170d28', i: '#0d0716', j: '#1c1131' };
export function texObsidian() {
  return pixelTex(texObsidianRows, texObsidianPalette);
}

const texGravelRows = [
  'ghhidjjjjjjjjjjj',
  'jieejejjhbjjdejf',
  'jjjdjiddfdjjdbdi',
  'ddjddjchgcijjdce',
  'gdfjddjegedjhfff',
  'jjfbijdhdbbjcdji',
  'jjfiijehhhgjbegj',
  'jbbccjjhcifggjjj',
  'jggcbfgjdbaaeeej',
  'jafgdebgabedehhe',
  'jbfjdegjgfhhhhce',
  'jjjejgdfjjjijeej',
  'gjjhbdhaehhjiijj',
  'jgjfbgdihhhihjee',
  'jdijejjjhhhjgajj',
  'dcijjjjjjijcdajj',
];
const texGravelPalette = { a: '#a79d8f', b: '#948b7d', c: '#615a4f', d: '#746c61', e: '#847c70', f: '#90877a', g: '#9d9385', h: '#7b7468', i: '#888073', j: '#8c8478' };
export function texGravel() {
  return pixelTex(texGravelRows, texGravelPalette);
}

const texNetherrackRows = [
  'ibfdihecddidiiid',
  'ibdiiiijibiiiiii',
  'idiifdfiffdiiiii',
  'iiicbbbfiiiiciii',
  'iiifbbbgaiiidiii',
  'iididifejiiidiii',
  'iiiigeeechiciiii',
  'iiidijdgecijgchj',
  'iiiidbbigcaeeege',
  'diiicibbdgeeegae',
  'diiiidbdiceechhj',
  'idiiiiaiiheciiaj',
  'idiifficgeehiaee',
  'iiddbbaeeeeecdee',
  'iiibbbceeeegiddg',
  'iiifibfcaajhifdd',
];
const texNetherrackPalette = { a: '#59231e', b: '#6e2c26', c: '#521f1b', d: '#642924', e: '#491a17', f: '#602621', g: '#4d1c19', h: '#5b231f', i: '#5c2420', j: '#57211d' };
export function texNetherrack() {
  return pixelTex(texNetherrackRows, texNetherrackPalette);
}

const texSoulSandRows = [
  'ahhhhhahhfadhigg',
  'hhhhhhhhabahcdgg',
  'hhhhhhhheahhggcd',
  'hhhhdhhhehhhggdg',
  'eihhhddhhhdhjgda',
  'ajhhahhhfhdhhhga',
  'jfhhffhaafhfedeg',
  'hhhhaaeeafhhebag',
  'hhhheaehidihface',
  'hhhhhfhhgddgiaaf',
  'hhhhhhhhgijgjhhh',
  'hhhhhcfdifedhhhh',
  'hhhhhjggdjdjchhh',
  'hhhhhiggjhhhhhhh',
  'hhahhhiiahcdiahh',
  'hhhhhhhhhdjgdhhh',
];
const texSoulSandPalette = { a: '#413731', b: '#332b26', c: '#4b4039', d: '#52463f', e: '#443a34', f: '#483d37', g: '#564943', h: '#4a3f38', i: '#4d413a', j: '#4f433d' };
export function texSoulSand() {
  return pixelTex(texSoulSandRows, texSoulSandPalette);
}

const texBasaltEndRows = [
  'aaaadgcdicgdaaaa',
  'daaggdjffjdggaaa',
  'aachfihddhifhcda',
  'aghchbcggcbhchga',
  'dgahijjiijjihfgd',
  'gdibhebddbejbidg',
  'cjhcjbeffgbjchjc',
  'ifdgidfaaaaegdfi',
  'gfdgfdfaafdigdfi',
  'hjhcjbgffgbjbhji',
  'ghihjebddbejbidg',
  'dffhijjdejjihfgd',
  'aghcabcggcbhihga',
  'aabhfihjdhifhcaa',
  'aaaggdjfffdggaaa',
  'aaaadgciicgdaaaa',
];
const texBasaltEndPalette = { a: '#2b2b2e', b: '#353538', c: '#3b3b3e', d: '#2f2f32', e: '#3a3a3d', f: '#38383b', g: '#39393c', h: '#323235', i: '#3a3a3d', j: '#333336' };
export function texBasaltEnd() {
  return pixelTex(texBasaltEndRows, texBasaltEndPalette);
}

const texBasaltSideRows = [
  'agiagciiciicicii',
  'jbiagagiciicicii',
  'abiciagiciacicii',
  'abiciabaciicicii',
  'abicifbiciicicii',
  'abicifeiciidicii',
  'ibicifeiciacicii',
  'fhihieficiicicii',
  'fbiciefaciicicai',
  'feicieficigaicii',
  'feicibficigaicii',
  'feicigaicigdicii',
  'feijigaiddgaicii',
  'feiciiciagbaiagi',
  'feiciijiagbaiagi',
  'eeiciiciadhfiagi',
];
const texBasaltSidePalette = { a: '#2d2d31', b: '#323235', c: '#2d2d30', d: '#36363a', e: '#303033', f: '#2f2f32', g: '#323235', h: '#2c2c2f', i: '#333336', j: '#29292c' };
export function texBasaltSide() {
  return pixelTex(texBasaltSideRows, texBasaltSidePalette);
}

const texGlowstoneRows = [
  'jjjajjjdbddhcajj',
  'jjjjjieeibbggiaf',
  'jjajjggcefcfdadd',
  'icjjjgggejiadddd',
  'ggcjjbhgijjjddda',
  'gfafihggjcecddda',
  'adddceehggggfddf',
  'caddjgheegggjjjj',
  'jcajjccjchggijjj',
  'ahcjjjeehghgjjjj',
  'heeggicbijibjjjj',
  'echhhceebjccjajj',
  'agicgicececjjaaj',
  'jeijeijjjcbcjjjj',
  'jjeecajaaejeajjj',
  'jjjajjjjjecejjjj',
];
const texGlowstonePalette = { a: '#f6e3a3', b: '#e5cf92', c: '#e5ca7c', d: '#fef0be', e: '#dcc071', f: '#f3de97', g: '#d8b860', h: '#c7a757', i: '#edd384', j: '#f2d98a' };
export function texGlowstone() {
  return pixelTex(texGlowstoneRows, texGlowstonePalette);
}

const texNetherQuartzOreRows = [
  'ejjjjjeejjjjjjdd',
  'jehejjhhjjjjehca',
  'jeeehjfbijcgcehj',
  'eeeejjbbfjdddeej',
  'eejjejifjjgdgeje',
  'eiejjjjadghaggjj',
  'jjjjjjjedgbgddcj',
  'jjjjjjfjagccddaf',
  'jjajjjjjcddcdgbf',
  'jjejjjjjhgceddaj',
  'jjjjjjjbfjjfgdaj',
  'fjjjjdgbfejjjjjj',
  'jjjjjgcejjejjjjj',
  'jjjjjjjjjjjjjjjj',
  'jjjjejjjjjjjjjjj',
  'jjjjjjjjjjjjjjjj',
];
const texNetherQuartzOrePalette = { a: '#6c322d', b: '#4e1c19', c: '#835854', d: '#ebe3e0', e: '#662a24', f: '#54201c', g: '#ac908b', h: '#602621', i: '#59221f', j: '#5c2420' };
export function texNetherQuartzOre() {
  return pixelTex(texNetherQuartzOreRows, texNetherQuartzOrePalette);
}
