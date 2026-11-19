// Notifications: createNotifications() builds five reusable toast slots in the top-left and a
// small queue behind them. push(text, kind) tints the slot by kind, each toast fades out after
// four seconds, and the oldest queued line comes in as soon as a slot frees.

const FONT = '"Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif';
const COLORS = {
  cash: '#b7f2b0',
  warning: '#ff8a6a',
  mission: '#ffd35c',
  radio: '#64d2ff',
  info: '#f7e7c6',
};

const SLOTS = 5;
const LIFE = 4;
const FADE = 0.7;
const QUEUE_MAX = 12;

export function createNotifications() {
  const root = document.createElement('div');
  root.id = 'notify-live';
  root.style.cssText = [
    'position:fixed', 'left:22px', 'top:206px', 'z-index:20',
    'display:flex', 'flex-direction:column', 'gap:6px',
    'pointer-events:none', `font-family:${FONT}`,
  ].join(';');
  document.body.appendChild(root);

  const slots = [];
  for (let i = 0; i < SLOTS; i++) {
    const element = document.createElement('div');
    element.style.cssText = [
      'min-width:210px', 'max-width:340px', 'padding:7px 12px',
      'background:rgba(18,14,16,.88)', 'border-left:3px solid #ffd35c',
      'font-size:14px', 'letter-spacing:.4px', 'color:#f7e7c6',
      'opacity:0', 'transform:translateX(-10px)',
      'transition:opacity .24s linear, transform .24s ease-out',
      'line-height:1.25',
    ].join(';');
    root.appendChild(element);
    slots.push({ element, life: 0, active: false });
  }

  const queue = [];

  function activate(slot, item) {
    slot.element.textContent = item.text;
    slot.element.style.borderLeftColor = COLORS[item.kind] ?? COLORS.info;
    slot.element.style.opacity = '1';
    slot.element.style.transform = 'translateX(0)';
    slot.life = LIFE;
    slot.active = true;
  }

  function push(text, kind = 'info') {
    if (!text) return;
    if (queue.length >= QUEUE_MAX) queue.shift();
    queue.push({ text: String(text), kind });
  }

  return {
    push,

    update(dt) {
      for (const slot of slots) {
        if (!slot.active) continue;
        slot.life -= dt;
        if (slot.life <= 0) {
          slot.active = false;
          slot.element.style.opacity = '0';
          slot.element.style.transform = 'translateX(-10px)';
          continue;
        }
        if (slot.life < FADE) slot.element.style.opacity = String(Math.max(0, slot.life / FADE));
      }
      for (const slot of slots) {
        if (queue.length === 0) break;
        if (slot.active) continue;
        activate(slot, queue.shift());
      }
    },
  };
}
