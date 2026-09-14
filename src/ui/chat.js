// Chat local (touche T) : ouvre un champ texte, relâche le pointeur, envoie un
// événement `chat:message` sur Entrée. Pas de réseau ici (Phase 21 branchera dessus).
//
// Phase 15 : `messages` garde tout l'historique reçu (cap 100) pour le panneau plein
// (ouvert) tandis que `logEl` continue d'afficher juste les 6 derniers messages qui
// s'effacent tout seuls (fermé) — deux vues du même flux, pas deux systèmes. `sentHistory`
// est un second tableau, indépendant : ce que LE JOUEUR a tapé, pour le rappel ↑/↓.

const MAX_HISTORY = 100;
const MAX_SENT_HISTORY = 50;
const VISIBLE_WHEN_OPEN = 20;
const VISIBLE_WHEN_CLOSED = 6;

export function createChatUI({ logEl, historyEl, inputBoxEl, inputEl, onSend, onClose }) {
  let isOpen = false;
  const messages = []; // { text, isError }
  const sentHistory = [];
  let recallIndex = -1; // -1 = pas de rappel en cours

  function renderHistoryPanel() {
    historyEl.innerHTML = '';
    messages.slice(-VISIBLE_WHEN_OPEN).forEach((m) => {
      const div = document.createElement('div');
      div.className = 'msg' + (m.isError ? ' err' : '');
      div.textContent = m.text;
      historyEl.appendChild(div);
    });
    historyEl.scrollTop = historyEl.scrollHeight;
  }

  // appelée par main.js pour tout ce qui doit apparaître dans le log : chat brut,
  // confirmation de commande, ou erreur (isError -> rouge, cf. style.css .msg.err)
  function addMessage(text, isError = false) {
    messages.push({ text, isError });
    if (messages.length > MAX_HISTORY) messages.shift();

    const div = document.createElement('div');
    div.className = 'msg' + (isError ? ' err' : '');
    div.textContent = text;
    logEl.appendChild(div);
    while (logEl.children.length > VISIBLE_WHEN_CLOSED) logEl.removeChild(logEl.firstChild);
    setTimeout(() => {
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 500);
    }, 6000);

    if (isOpen) renderHistoryPanel();
  }

  function open() {
    isOpen = true;
    inputBoxEl.style.display = 'block';
    historyEl.style.display = 'flex';
    renderHistoryPanel();
    inputEl.value = '';
    recallIndex = -1;
    inputEl.focus();
  }
  function close() {
    isOpen = false;
    inputBoxEl.style.display = 'none';
    historyEl.style.display = 'none';
    inputEl.blur();
    onClose?.();
  }

  inputEl.addEventListener('keydown', (e) => {
    e.stopPropagation(); // ne pas laisser 'e'/'t'/etc. atteindre les contrôles du jeu pendant la saisie
    if (e.code === 'Escape') {
      close();
    } else if (e.code === 'Enter') {
      const text = inputEl.value.trim();
      if (text) {
        sentHistory.push(text);
        if (sentHistory.length > MAX_SENT_HISTORY) sentHistory.shift();
        recallIndex = -1;
        onSend(text);
      }
      close();
    } else if (e.code === 'ArrowUp') {
      if (sentHistory.length === 0) return;
      e.preventDefault();
      recallIndex = recallIndex < 0 ? sentHistory.length - 1 : Math.max(0, recallIndex - 1);
      inputEl.value = sentHistory[recallIndex];
    } else if (e.code === 'ArrowDown') {
      if (recallIndex < 0) return;
      e.preventDefault();
      recallIndex++;
      if (recallIndex >= sentHistory.length) {
        recallIndex = -1;
        inputEl.value = '';
      } else {
        inputEl.value = sentHistory[recallIndex];
      }
    }
  });

  return {
    open,
    close,
    addMessage,
    get isOpen() {
      return isOpen;
    },
  };
}
