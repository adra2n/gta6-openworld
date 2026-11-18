// HUD: health, armour, cash, wanted stars, objective, weapon and speed.
// The HUD: health and armour, cash, wanted stars, weapon and ammo, mission text and timer,
// speedometer, crosshair, subtitle and toast lines. Values are only written to the DOM when
// they change, so the loop stays cheap.

const STAR_COUNT = 5;

export function createHud() {
  const hud = document.getElementById('hud');
  const health = document.querySelector('#healthbar i');
  const armour = document.querySelector('#armourbar i');
  const cash = document.getElementById('cash');
  const stars = document.getElementById('stars');
  const weaponName = document.getElementById('weapon-name');
  const ammo = document.getElementById('ammo');
  const weaponPanel = document.getElementById('weapon');
  const speedo = document.getElementById('speedo');
  const speed = document.getElementById('speed');
  const missionTitle = document.getElementById('mission-title');
  const objectiveText = document.getElementById('objective-text');
  const timer = document.getElementById('timer');
  const crosshair = document.getElementById('crosshair');
  const subtitle = document.getElementById('subtitle');
  const toast = document.getElementById('toast');
  const big = document.getElementById('big-msg');
  const safeBadge = document.getElementById('safe-badge');

  stars.innerHTML = Array.from({ length: STAR_COUNT }, () => '<span>★</span>').join('');
  const starSpans = [...stars.children];

  const shown = { health: -1, armour: -1, cash: -1, stars: -1, weapon: '', ammo: '', speed: -1, title: '', text: '', timer: '', cross: null, inCar: null };
  let toastUntil = 0;
  let subtitleUntil = 0;
  let bigUntil = 0;

  return {
    show() { hud.classList.remove('hidden'); },
    hide() { hud.classList.add('hidden'); },

    update(state) {
      const hp = Math.round(state.player.health);
      if (hp !== shown.health) { health.style.width = `${hp}%`; shown.health = hp; }
      const ap = Math.round(state.player.armour);
      if (ap !== shown.armour) { armour.style.width = `${ap}%`; shown.armour = ap; }

      if (state.money !== shown.cash) {
        cash.textContent = `$${state.money.toLocaleString('en-US')}`;
        shown.cash = state.money;
      }
      const wanted = state.police?.wanted ?? 0;
      if (wanted !== shown.stars) {
        starSpans.forEach((span, i) => span.classList.toggle('on', i < wanted));
        shown.stars = wanted;
      }

      const weapon = state.player.inVehicle ? '' : (state.weaponData?.name ?? '');
      if (weapon !== shown.weapon) {
        weaponName.textContent = weapon;
        shown.weapon = weapon;
      }
      const ammoText = state.player.inVehicle ? '' : `${state.ammoInMag ?? 0} / ${state.ammoReserve ?? 0}`;
      if (ammoText !== shown.ammo) {
        ammo.textContent = ammoText;
        shown.ammo = ammoText;
      }
      weaponPanel.style.display = state.player.inVehicle ? 'none' : 'block';

      const inCar = !!state.player.inVehicle;
      if (inCar !== shown.inCar) {
        speedo.style.display = inCar ? 'block' : 'none';
        shown.inCar = inCar;
      }
      if (inCar) {
        const mph = Math.round(Math.abs(state.player.inVehicle.speed) * 2.237);
        if (mph !== shown.speed) { speed.textContent = String(mph); shown.speed = mph; }
      }

      const cross = !inCar && !state.player.dead && state.mode === 'play';
      if (cross !== shown.cross) {
        crosshair.style.display = cross ? 'block' : 'none';
        shown.cross = cross;
      }

      if (state.objectiveTitle !== shown.title) { missionTitle.textContent = state.objectiveTitle; shown.title = state.objectiveTitle; }
      if (state.objectiveText !== shown.text) { objectiveText.textContent = state.objectiveText; shown.text = state.objectiveText; }
      if (state.objectiveTimer !== shown.timer) { timer.textContent = state.objectiveTimer; shown.timer = state.objectiveTimer; }

      const now = performance.now();
      if (toastUntil && now > toastUntil) { toast.style.opacity = '0'; toastUntil = 0; }
      if (subtitleUntil && now > subtitleUntil) { subtitle.style.opacity = '0'; subtitleUntil = 0; }
      if (bigUntil && now > bigUntil) { big.style.opacity = '0'; bigUntil = 0; }
    },

    toast(text, seconds = 3) {
      toast.textContent = text;
      toast.style.opacity = '1';
      toastUntil = performance.now() + seconds * 1000;
    },

    say(speaker, line, seconds = 4.5) {
      subtitle.innerHTML = speaker ? `<b>${speaker}:</b> ${line}` : line;
      subtitle.style.opacity = '1';
      subtitleUntil = performance.now() + seconds * 1000;
    },

    bigMessage(title, sub = '', seconds = 3) {
      big.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
      big.style.opacity = '1';
      bigUntil = performance.now() + seconds * 1000;
    },

    saved() {
      safeBadge.style.opacity = '1';
      setTimeout(() => { safeBadge.style.opacity = '0'; }, 1400);
    },
  };
}
