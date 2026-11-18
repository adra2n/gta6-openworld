// Boot, screens and the one loop. Builds Costa Vega from a seed, then each frame runs input,
// player or car, traffic, pedestrians, police, combat, missions, HUD and the renderer in order.

import * as THREE from 'three';
import { START, WEAPONS, SHOP } from './config.js';
import { createRandom } from './random.js';
import { createSky } from './world/sky.js';
import { buildCity, PLACES, placeAt } from './world/city.js';
import { createTraffic } from './world/traffic.js';
import { createPedestrians } from './world/pedestrians.js';
import { createPlayer, placePlayer, updatePlayer } from './entities/player.js';
import { createVehicle, placeVehicle, updateVehicle, damageVehicle } from './entities/vehicle.js';
import { createInput } from './input.js';
import { createView, updateCamera } from './camera.js';
import { createEffects } from './systems/effects.js';
import { createCombat } from './systems/combat.js';
import { createPolice, updatePolice, reportCrime, clearWanted } from './systems/police.js';
import { createMissions, updateMissions, startMission, failCurrentMission } from './systems/missions.js';
import { createHud } from './ui/hud.js';
import { drawMinimap } from './ui/minimap.js';
import { createMenu } from './ui/menu.js';
import { createAudio } from './audio/engine.js';
import { readSave, hasSave, writeSave } from './state/save.js';
import { runShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20931;

const canvas = document.getElementById('game');
const boot = document.getElementById('boot');
const minimap = document.getElementById('minimap');
window.addEventListener('error', (event) => { if (boot) boot.textContent = `Error: ${event.message}`; });

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.3, 4500);
scene.add(camera);

const rng = createRandom(seed);
const sky = createSky(scene);
const city = buildCity(scene, rng);
const player = createPlayer(scene);
placePlayer(player, START.x, START.z, START.yaw);
const input = createInput(canvas);
const effects = createEffects(scene);
const audio = createAudio();
const hud = createHud();
const combat = createCombat();
const police = createPolice(scene);
const missions = createMissions(scene);
const traffic = createTraffic(scene, rng, city, 18);
const peds = createPedestrians(scene, rng, city, 26);
const view = createView(player);

const parked = [];
for (const spot of city.parking.slice(0, 20)) {
  const kind = rng.pick(['sedan', 'sedan', 'sedan', 'van', 'sports']);
  const car = createVehicle(kind, rng.pick([0xf3e7cd, 0xe4604d, 0x2f7f7a, 0xf5d78a, 0x9fc2d8, 0xf7f4ea]), scene);
  placeVehicle(car, spot.x + rng.range(-1, 1), spot.z + rng.range(-1, 1), spot.yaw);
  parked.push(car);
}

const state = {
  seed, scene, camera, renderer, sky, city, player, input, rng, effects, audio, hud, combat, police, missions, traffic, peds,
  view,
  mode: 'title',
  money: 0,
  weapons: { pistol: { mag: 12, reserve: 60 }, smg: { mag: 0, reserve: 0 }, shotgun: { mag: 0, reserve: 0 } },
  weapon: 'pistol',
  weaponData: WEAPONS.pistol,
  ammoInMag: 12,
  ammoReserve: 60,
  weaponCooldown: 0,
  thugs: [],
  vehicles: [...parked, ...traffic.cars.map((c) => c.v)],
  objectiveTitle: 'COSTA VEGA',
  objectiveText: 'Meet Rosa at the marina',
  objectiveTimer: '',
  missionBlip: null,
  missionKills: 0,
  noise: 0,
  deadTimer: 0,
  muzzleFlash: 0,
  addCrime(amount) { reportCrime(state.police, amount); },
  onPlayerHit() { state.view.shake = 0.35; },
  onMissionComplete() { saveGame(); },
  onBusted() { if (state.mode === 'play') getBusted(); },
  saveGame,
};

function saveGame() {
  if (writeSave(state)) hud.saved();
}

// Debug handle for the local smoke tests and screenshots (harmless in play).
window.__game = state;

const menu = createMenu({
  onNew: () => begin(false),
  onContinue: () => begin(true),
  onResume: () => resume(),
  onClose: () => {},
  onTime: (time) => { sky.setTime(time); state.timeOfDay = time; },
  onShadow: (on) => { renderer.shadowMap.enabled = on; scene.traverse((object) => { if (object.material) object.material.needsUpdate = true; }); },
  onVolume: (value) => audio.setVolume(value),
});
state.menu = menu;
state.hud = hud;
menu.showTitle(hasSave());
menu.setVolume(0.7);

const WANTED_EVENTS = { hits: 0 };

// Wake audio on the first gesture, as browsers require.
window.addEventListener('pointerdown', () => audio.start());
window.addEventListener('keydown', () => audio.start());

function begin(load) {
  audio.start();
  menu.hide();
  hud.show();
  resetForNewGame(load);
  state.mode = 'play';
  input.lock();
}

function resetForNewGame(load) {
  const saved = load ? readSave() : null;
  clearWanted(police);
  police.units.forEach((unit) => {
    if (unit.vehicle) {
      scene.remove(unit.vehicle.root);
      const index = state.vehicles.indexOf(unit.vehicle);
      if (index >= 0) state.vehicles.splice(index, 1);
    } else if (unit.group) scene.remove(unit.group);
  });
  police.units.length = 0;
  for (const thug of missions.enemies) scene.remove(thug.group);
  missions.enemies.length = 0;
  state.thugs.length = 0;
  if (missions.vehicle) {
    const index = state.vehicles.indexOf(missions.vehicle);
    if (index >= 0) state.vehicles.splice(index, 1);
    missions.vehicle = null;
  }
  missions.active = null;
  missions.index = saved ? Math.min(saved.missionIndex, missions.list.length) : 0;
  missions.stepIndex = 0;
  missions.talkQueue.length = 0;
  state.money = saved ? saved.money : 0;
  state.weapons = saved ? { ...saved.weapons } : { pistol: { mag: 12, reserve: 60 }, smg: { mag: 0, reserve: 0 }, shotgun: { mag: 0, reserve: 0 } };
  state.weapon = saved?.weapon ?? 'pistol';
  player.health = saved ? Math.max(20, saved.health) : 100;
  player.armour = saved?.armour ?? 0;
  player.dead = false;
  if (player.inVehicle) {
    player.inVehicle.driver = null;
    player.inVehicle = null;
  }
  const at = saved?.pos ?? START;
  placePlayer(player, at.x, at.z, saved ? 0 : START.yaw);
  sky.setTime(saved?.time === 'dusk' ? 'dusk' : 'day');
  menu.setTime(saved?.time === 'dusk' ? 'dusk' : 'day');
  view.yaw = player.yaw + Math.PI;
  view.restTimer = 0;
  hud.bigMessage(saved ? 'WELCOME BACK' : 'COSTA VEGA', saved ? 'Rosa has been asking after you' : 'Find Rosa at the marina', 3.5);
}

function resume() {
  state.mode = 'play';
  menu.hide();
  input.lock();
}

function pause() {
  if (state.mode !== 'play') return;
  state.mode = 'paused';
  menu.showPause();
  document.exitPointerLock?.();
}

function getBusted() {
  if (state.mode !== 'play') return;
  state.mode = 'busted';
  state.deadTimer = 3.4;
  hud.bigMessage('BUSTED', 'Costa Vega Police · $300', 4);
  audio.impact(1);
  failCurrentMission(missions, state, 'You got pinched.');
  clearWanted(police);
  if (player.inVehicle) exitVehicle();
  document.exitPointerLock?.();
}

function getWasted() {
  if (state.mode !== 'play' && state.mode !== 'wasted') return;
  state.mode = 'wasted';
  state.deadTimer = 3.4;
  hud.bigMessage('WASTED', 'Bay Hospital · $200', 4);
  audio.impact(1);
  failCurrentMission(missions, state, 'You bled out.');
  clearWanted(police);
  if (player.inVehicle) exitVehicle();
  document.exitPointerLock?.();
}

function respawnAt(place, fee) {
  state.money = Math.max(0, state.money - fee);
  player.health = 65;
  player.armour = 0;
  player.dead = false;
  placePlayer(player, place.x, place.z, 0);
  view.yaw = player.yaw + Math.PI;
  state.mode = 'play';
  hud.bigMessage('', `${place.label} · -$${fee}`, 2.5);
  input.lock();
}

function nearestVehicle(maxDistance = 5) {
  let best = null;
  let bestDistance = maxDistance;
  for (const vehicle of state.vehicles) {
    if (!vehicle.alive) continue;
    const distance = Math.hypot(vehicle.pos.x - player.pos.x, vehicle.pos.z - player.pos.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = vehicle;
    }
  }
  return best;
}

function enterVehicle(vehicle) {
  if (!vehicle) return;
  player.inVehicle = vehicle;
  vehicle.driver = 'player';
  if (vehicle.traffic) vehicle.traffic.stolen = true;
  if (vehicle.isPolice) reportCrime(police, 1);
  player.group.visible = false;
  player.pos.copy(vehicle.pos);
  view.yaw = vehicle.heading + Math.PI;
  view.restTimer = 0;
  hud.toast(`Stole the ${vehicle.spec.name}`, 2.5);
  audio.start();
}

function exitVehicle() {
  const vehicle = player.inVehicle;
  if (!vehicle) return;
  const side = vehicle.heading + Math.PI / 2;
  player.inVehicle = null;
  vehicle.driver = null;
  player.pos.set(vehicle.pos.x + Math.sin(side) * 2.4, 0.25, vehicle.pos.z + Math.cos(side) * 2.4);
  city.resolve(player.pos, 0.6);
  player.group.visible = true;
  player.group.position.copy(player.pos);
  player.speed = 0;
  view.yaw = vehicle.heading + Math.PI;
  view.restTimer = 0;
}

function interact() {
  if (player.inVehicle) return;
  const distance = (p) => Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
  if (!missions.active && missions.index < missions.list.length && distance(PLACES.marina) < 9) {
    if (startMission(missions, state)) return;
  }
  if (distance(PLACES.marina) < 9) {
    player.health = 100;
    player.armour = Math.max(player.armour, 25);
    saveGame();
    hud.toast('Rosa patch a few scrapes. Progress saved.', 3);
    audio.pickup();
    return;
  }
  if (distance(placeAt(PLACES.shop)) < 7) {
    if (player.armour < 100 && state.money >= SHOP.armourCost) {
      state.money -= SHOP.armourCost;
      player.armour = Math.min(100, player.armour + 50);
      hud.toast('Vega Pawn: armour vest — $250', 3);
      audio.pickup();
    } else if (state.money >= SHOP.ammoCost) {
      state.money -= SHOP.ammoCost;
      for (const key of ['pistol', 'smg', 'shotgun']) {
        if (state.weapons[key].mag + state.weapons[key].reserve > 0) state.weapons[key].reserve += WEAPONS[key].mag * 2;
      }
      if (state.weapon === 'pistol' && state.weapons.smg.reserve === 0) state.weapons.smg.reserve = 30;
      hud.toast('Vega Pawn: ammunition — $120', 3);
      audio.pickup();
    } else {
      hud.toast('Not enough cash for the pawn shop.', 2.5);
    }
    return;
  }
  if (distance(placeAt(PLACES.garage)) < 7) {
    if (state.money < SHOP.carCost) {
      hud.toast('Manta Motors: come back with $1,500.', 2.5);
      return;
    }
    state.money -= SHOP.carCost;
    const car = createVehicle('sports', 0xffb454, scene);
    placeVehicle(car, 160, 200, -Math.PI / 2);
    state.vehicles.push(car);
    hud.toast('Manta Motors: keys are in it.', 3);
    audio.pickup();
    return;
  }
  if (distance(placeAt(PLACES.hospital)) < 7 && state.money >= 150) {
    state.money -= 150;
    player.health = 100;
    hud.toast('Bay Hospital: patched up — $150', 3);
    audio.pickup();
  }
}

function switchWeapon(direction) {
  const order = ['pistol', 'smg', 'shotgun'];
  let index = order.indexOf(state.weapon);
  for (let step = 1; step <= order.length; step++) {
    const next = order[(index + direction * step + order.length * 2) % order.length];
    if (state.weapons[next].mag + state.weapons[next].reserve > 0 || next === 'pistol') {
      state.weapon = next;
      state.weaponData = WEAPONS[next];
      hud.toast(WEAPONS[next].name, 1.2);
      return;
    }
  }
}

function resolveCarContacts() {
  const car = player.inVehicle;
  if (!car) return;
  for (const other of state.vehicles) {
    if (other === car || !other.alive) continue;
    const dx = other.pos.x - car.pos.x;
    const dz = other.pos.z - car.pos.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 3.1 && distance > 0.01) {
      const push = (3.1 - distance) / 2;
      car.pos.x -= (dx / distance) * push;
      car.pos.z -= (dz / distance) * push;
      other.pos.x += (dx / distance) * push;
      other.pos.z += (dz / distance) * push;
      if (Math.abs(car.speed) > 9 && other.kind !== 'police') {
        damageVehicle(other, Math.abs(car.speed) * 0.4);
        car.speed *= 0.86;
        audio.impact(0.5);
      }
    }
  }
}

function updatePlay(dt, now) {
  const mouse = input.takeMouse();
  updateCamera(camera, view, player, mouse, dt);

  if (input.pressed('KeyE')) {
    if (player.inVehicle) exitVehicle();
    else {
      enterVehicle(nearestVehicle(5));
      if (!player.inVehicle) interact();
    }
  }

  if (input.pressed('Escape')) { pause(); return; }
  if (input.pressed('KeyM')) hud.toast(audio.toggleMute() ? 'Audio muted' : 'Audio on', 1.5);

  const command = {
    forward: input.down('KeyW') || input.down('ArrowUp'),
    back: input.down('KeyS') || input.down('ArrowDown'),
    left: input.down('KeyA') || input.down('ArrowLeft'),
    right: input.down('KeyD') || input.down('ArrowRight'),
    sprint: input.down('ShiftLeft') || input.down('ShiftRight'),
    jump: input.pressed('Space'),
    aiming: input.aimDown || input.fireDown,
  };

  let motion = { speed: player.speed, inCar: false, drift: 0, throttle: 0 };
  if (player.inVehicle) {
    const car = player.inVehicle;
    const throttle = (command.forward ? 1 : 0) - (command.back ? 1 : 0);
    const steer = (command.left ? 1 : 0) - (command.right ? 1 : 0);
    updateVehicle(car, { throttle, steer, handbrake: command.jump }, dt, city);
    player.pos.copy(car.pos);
    player.yaw = car.heading;
    player.speed = car.speed;
    motion = { speed: car.speed, inCar: true, drift: Math.abs(steer) * Math.abs(car.speed), throttle };
    if (input.pressed('KeyF')) audio.horn();
    if (input.pressed('KeyR')) hud.toast(`Radio: ${audio.nextStation()}`, 2.5);
    resolveCarContacts();
    if (car.health <= 0 && !car.deadHandled) {
      car.deadHandled = true;
      hud.toast('The car is done.', 2.5);
      audio.impact(1);
      exitVehicle();
    }
  } else {
    updatePlayer(player, command, view.yaw, dt, city);
    if (input.pressed('Digit1')) { state.weapon = 'pistol'; hud.toast('Pistol', 1); }
    if (input.pressed('Digit2') && state.weapons.smg.reserve + state.weapons.smg.mag > 0) { state.weapon = 'smg'; hud.toast('SMG', 1); }
    if (input.pressed('Digit3') && state.weapons.shotgun.reserve + state.weapons.shotgun.mag > 0) { state.weapon = 'shotgun'; hud.toast('Shotgun', 1); }
    if (mouse.wheel) switchWeapon(mouse.wheel > 0 ? 1 : -1);
    if (input.pressed('KeyR')) combat.reload(state);
    if (input.fireDown) combat.fire(state);
  }

  state.weaponData = WEAPONS[state.weapon];
  state.ammoInMag = state.weapons[state.weapon].mag;
  state.ammoReserve = state.weapons[state.weapon].reserve;

  traffic.update(dt, state);
  peds.update(dt, state);
  updatePolice(police, state, dt);
  updateMissions(missions, state, dt);
  combat.update(state, dt);
  effects.update(dt);
  city.update(dt);
  sky.follow(player.pos);
  state.missionBlip = missions.blip;
  state.noise = Math.max(0, state.noise - dt * 0.9);
  state.weaponCooldown = Math.max(0, state.weaponCooldown - dt);

  audio.update(dt, motion);
  updateCamera(camera, view, player, { x: 0, y: 0 }, dt);

  if (player.dead) getWasted();
}

function updateDown(dt) {
  state.deadTimer -= dt;
  effects.update(dt);
  city.update(dt);
  traffic.update(dt, state);
  peds.update(dt, state);
  updateCamera(camera, view, player, { x: 0, y: 0 }, dt);
  if (state.deadTimer <= 0) {
    if (state.mode === 'wasted') respawnAt(placeAt(PLACES.hospital), 200);
    else respawnAt(placeAt(PLACES.station), 300);
  }
}

function updateTitle(dt) {
  view.yaw += dt * 0.05;
  updateCamera(camera, view, player, { x: 0, y: 0 }, dt);
  traffic.update(dt, state);
  peds.update(dt, state);
  effects.update(dt);
  city.update(dt);
  sky.follow(player.pos);
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!shotName) {
    if (state.mode === 'play') updatePlay(dt, now);
    else if (state.mode === 'wasted' || state.mode === 'busted') updateDown(dt);
    else if (state.mode === 'title') updateTitle(dt);
    state.missionBlip = missions.blip;
    hud.update(state);
    drawMinimap(minimap, state, now);
    renderer.render(scene, camera);
  }
  input.endFrame();
}

boot.classList.add('hidden');
if (shotName) {
  document.body.style.cursor = 'none';
  runShot(shotName, state);
} else {
  requestAnimationFrame(frame);
}
