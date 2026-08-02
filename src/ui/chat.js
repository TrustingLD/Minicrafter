// Chat local (touche T) : ouvre un champ texte, relâche le pointeur, envoie un
// événement `chat:message` sur Entrée. Pas de réseau ici (Phase 8 branchera dessus).

export function createChatUI({ logEl, inputBoxEl, inputEl, onSend, onClose }) {
  let isOpen = false;

  function addMessage(text) {
    const div = document.createElement('div');
    div.className = 'msg';
    div.textContent = text;
    logEl.appendChild(div);
    while (logEl.children.length > 6) logEl.removeChild(logEl.firstChild);
    setTimeout(() => {
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 500);
    }, 6000);
  }

  function open() {
    isOpen = true;
    inputBoxEl.style.display = 'block';
    inputEl.value = '';
    inputEl.focus();
  }
  function close() {
    isOpen = false;
    inputBoxEl.style.display = 'none';
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
        addMessage(text);
        onSend(text);
      }
      close();
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
