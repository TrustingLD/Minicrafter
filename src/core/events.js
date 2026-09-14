// Bus d'événements minimal (pub/sub). Le but : la logique de jeu émet des faits
// ("un joueur a pris des dégâts", "un objet a été fabriqué") sans savoir qui écoute ;
// l'UI s'abonne aux faits qui l'intéressent au lieu d'être appelée en dur partout.
// Ça casse le tangle "chaque endroit qui change l'inventaire doit penser à
// rafraîchir la hotbar" en un seul abonnement.

export function createEventBus() {
  const listeners = new Map(); // event -> Set<fn>

  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => off(event, fn); // pratique pour se désabonner : const unsub = on(...); unsub();
  }
  function off(event, fn) {
    listeners.get(event)?.delete(fn);
  }
  function emit(event, payload) {
    listeners.get(event)?.forEach((fn) => fn(payload));
  }

  return { on, off, emit };
}
