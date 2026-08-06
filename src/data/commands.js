// Table des commandes chat (Phase 15). Pure donnée : une entrée ici = une commande
// reconnue par le parseur (core/commands.js) ; l'implémentation (le handler) vit dans
// main.js, la seule partie autorisée à toucher l'état du jeu.
// args: nom de paramètre, suffixé '?' si optionnel (arité min/max dérivée de là).

export const COMMANDS = {
  fly: { args: [], help: '/fly — bascule le mode vol' },
  speedfly: {
    args: ['multiplier'],
    help: '/speedfly <x0.25-x10> — règle la vitesse de vol (ex. /speedfly x2)',
  },
  give: { args: ['item', 'count?'], help: '/give <item> [n] — ajoute un item' },
  tp: { args: ['x', 'y', 'z'], help: '/tp <x> <y> <z> — téléportation' },
  time: { args: ['value'], help: "/time <day|night|0-1> — règle l'heure" },
  heal: { args: [], help: '/heal — remplit la vie' },
  help: { args: [], help: '/help — liste les commandes' },
};
