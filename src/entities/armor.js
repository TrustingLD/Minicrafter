// Réduction de dégâts apportée par l'armure (Phase 19). PURE -- aucun import,
// testable sans navigateur. `armorSlots` : tableau de 4 (casque/plastron/
// jambières/bottes, cf. entities/inventory.js ARMOR_NAMES), chaque case
// `null | { item, count }`. `armorItems` : data/items.js ARMOR_ITEMS (item ->
// { slot, material }). `materialReduction` : data/items.js ARMOR_MATERIAL_REDUCTION
// (réduction d'un SET COMPLET du matériau, ex. diamond -> 0.6).
//
// Chaque pièce équipée contribue à parts égales (réduction du matériau / 4) :
// un plastron seul en diamant donne 0.6/4 = 15%, un set complet en diamant
// donne bien 60% comme demandé. Mélanger les matériaux (ex: casque diamant +
// le reste en fer) s'additionne normalement -- le maximum atteignable est
// exactement la réduction du meilleur matériau porté en set complet, jamais
// plus (4 pièces à 1/4 de part chacune).
export function computeArmorReduction(armorSlots, armorItems, materialReduction) {
  let reduction = 0;
  for (const cell of armorSlots) {
    if (!cell) continue;
    const meta = armorItems[cell.item];
    if (!meta) continue;
    reduction += (materialReduction[meta.material] || 0) / 4;
  }
  return reduction;
}

// applique la réduction à un montant de dégâts brut.
export function applyArmorReduction(amount, armorSlots, armorItems, materialReduction) {
  return amount * (1 - computeArmorReduction(armorSlots, armorItems, materialReduction));
}
