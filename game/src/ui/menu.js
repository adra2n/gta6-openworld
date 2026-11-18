// Start screen and pause screen: Continue / New Game / Controls / Settings, plus the day-dusk
// switch and volume. The menu is also where audio wakes up, since browsers need a gesture.

export function createMenu(handlers) {
  const root = document.getElementById('menu');
  const title = document.getElementById('game-title');
  const about = document.getElementById('menu-about');
  const saveNote = document.getElementById('save-note');
  const titleButtons = document.getElementById('title-buttons');
  const pauseButtons = document.getElementById('pause-buttons');
  const continueButton = document.getElementById('btn-continue');
  const controlsPanel = document.getElementById('controls-panel');
  const settingsPanel = document.getElementById('settings-panel');
  const volume = document.getElementById('volume');

  let visible = true;
  let hasSave = false;

  const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
  on('btn-new', () => { hide(); handlers.onNew?.(); });
  on('btn-restart', () => { hide(); handlers.onNew?.(); });
  on('btn-continue', () => { hide(); handlers.onContinue?.(); });
  on('btn-resume', () => { hide(); handlers.onResume?.(); });
  on('btn-controls', () => controlsPanel.classList.remove('hidden'));
  on('btn-settings', () => settingsPanel.classList.remove('hidden'));
  for (const button of document.querySelectorAll('.panel-close')) {
    button.addEventListener('click', () => document.getElementById(button.dataset.close).classList.add('hidden'));
  }
  for (const button of document.querySelectorAll('[data-time]')) {
    button.addEventListener('click', () => {
      for (const b of document.querySelectorAll('[data-time]')) b.classList.toggle('active', b === button);
      handlers.onTime?.(button.dataset.time);
    });
  }
  for (const button of document.querySelectorAll('[data-shadow]')) {
    button.addEventListener('click', () => {
      for (const b of document.querySelectorAll('[data-shadow]')) b.classList.toggle('active', b === button);
      handlers.onShadow?.(button.dataset.shadow === '1');
    });
  }
  volume.addEventListener('input', () => handlers.onVolume?.(Number(volume.value) / 100));

  function hide() {
    visible = false;
    root.classList.add('hidden');
    controlsPanel.classList.add('hidden');
    settingsPanel.classList.add('hidden');
    handlers.onClose?.();
  }

  function showTitle(hasSaveNow) {
    visible = true;
    hasSave = hasSaveNow;
    root.classList.remove('hidden');
    titleButtons.style.display = 'block';
    pauseButtons.style.display = 'none';
    continueButton.style.display = hasSave ? 'block' : 'none';
    saveNote.textContent = hasSave ? 'Saved progress found on this machine.' : 'Autosaves at the marina and after every job.';
    about.textContent = 'A stolen car, a hot sun and a city that keeps its books in cash. Work for Rosa Delgado, take the marina, and try not to get famous.';
  }

  function showPause() {
    visible = true;
    root.classList.remove('hidden');
    titleButtons.style.display = 'none';
    pauseButtons.style.display = 'block';
    saveNote.textContent = 'Progress autosaves after every job.';
    about.textContent = 'Paused. The coast will wait.';
  }

  return {
    showTitle, showPause, hide,
    get visible() { return visible; },
    setTime(time) {
      for (const b of document.querySelectorAll('[data-time]')) b.classList.toggle('active', b.dataset.time === time);
    },
    setVolume(value) { volume.value = String(Math.round(value * 100)); },
    setHasSave(value) { hasSave = value; },
  };
}
