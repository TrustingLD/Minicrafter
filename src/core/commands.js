// Parseur de commandes chat (Phase 15). PURE — aucun import, testable sans navigateur.
// Sépare "est-ce une commande, avec les bons arguments ?" (ici) de "que fait-elle ?"
// (les handlers, dans main.js — la seule partie qui touche l'état du jeu).

// découpe "/tp 1 2 3" -> { name: 'tp', args: ['1','2','3'] }. Renvoie :
//   - null si `text` n'est pas une commande (pas de '/' initial) : chat normal
//   - { error } si la commande est inconnue ou reçoit le mauvais nombre d'arguments
//   - { name, args } sinon
export function parseCommand(text, table) {
  if (typeof text !== 'string' || !text.startsWith('/')) return null;
  const parts = text.slice(1).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { error: 'Commande vide. Tape /help pour la liste.' };
  const name = parts[0];
  const args = parts.slice(1);
  const cmd = table[name];
  if (!cmd) return { error: `Commande inconnue : /${name}. Tape /help pour la liste.` };
  const required = cmd.args.filter((a) => !a.endsWith('?')).length;
  const total = cmd.args.length;
  if (args.length < required || args.length > total) {
    return { error: `Usage : ${cmd.help}` };
  }
  return { name, args };
}
