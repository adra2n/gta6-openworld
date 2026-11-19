// Screenshot mode: runShot(name, state) stages the cover, chase, mission and dusk scenes. Sets window.__shotReady.
// Four deterministic staged scenes for ?shot=<name>&seed=<n>: the cover on the beach road, a
// three-star chase, the docks shootout and the dusk run up the coast. No input needed; each
// places the world, settles traffic and lights, renders and sets window.__shotReady.

import * as THREE from 'three';
import { PLACES } from './world/city.js';
import { createVehicle, placeVehicle } from './entities/vehicle.js';
import { placePlayer } from './entities/player.js';
import { createPerson, posePerson } from './entities/person.js';
import { reportCrime } from './systems/police.js';
import { stageMission } from './systems/missions.js';
import { updateCamera } from './camera.js';
import { drawMinimap } from './ui/minimap.js';

export function runShot(name, state) {
  state.menu.hide();
  state.hud.show();
  state.mode = 'play';
  state.hud.setObjectives = null;
  state.sky.setTime('day');
  state.renderer.setPixelRatio(1);
  state.renderer.setSize(1280, 720);
  state.camera.aspect = 1280 / 720;
  state.camera.updateProjectionMatrix();
  const shot = SHOTS[name] ?? SHOTS.cover;
  shot(state);
  settle(state, 45);
  finish(state, name);
}

const SHOTS = {
  cover: stageCover,
  chase: stageChase,
  mission: stageMissionShot,
  dusk: stageDusk,
};

function stageCover(state) {
  state.sky.setTime('day');
  state.money = 2450;
  state.player.health = 100;
  state.player.armour = 40;
  state.police.wanted = 0;
  state.weapons.pistol = { mag: 12, reserve: 48 };
  state.weapon = 'pistol';
  // A street canyon running down to the water: hero on the kerb, the Manta at the lights.
  placePlayer(state.player, 468, 154.5, Math.PI / 2);
  state.player.rig.root.rotation.y = Math.PI / 2;
  state.player.pos.y = 0.25;

  const car = addCar(state, 'sports', 0xff5470, 474, 159.5, Math.PI / 2);
  car.wheels.forEach((wheel) => { wheel.spin.rotation.x = 0.6; });

  addCar(state, 'sedan', 0x9fc2d8, 530, 163, -Math.PI / 2);
  addCar(state, 'sedan', 0xf3e7cd, 590, 155, Math.PI / 2);
  addCar(state, 'van', 0xf5d78a, 398, 164, Math.PI / 2);

  const ped = createPerson({ jacket: 0xf2b8a2, shirt: 0xa8d8cd, pants: 0x24262e, skin: 0xc99b74, hair: 0x221a16 });
  ped.root.position.set(497, 0.25, 149);
  ped.root.rotation.y = Math.PI;
  posePerson(ped, 1.4, 0.3);
  state.scene.add(ped.root);

  state.objectiveTitle = 'ROSA DELGADO';
  state.objectiveText = 'Meet Rosa at the marina — First Tide';
  state.objectiveTimer = 'Press E at the marker';
  state.missionBlip = { x: PLACES.marina.x, z: PLACES.marina.z };
  state.view.yaw = -Math.PI / 2;
  state.view.pitch = 0.08;
  state.view.distance = 8.6;
}

function stageChase(state) {
  state.sky.setTime('day');
  state.money = 3120;
  state.player.health = 68;
  state.player.armour = 30;
  state.weapons.pistol = { mag: 8, reserve: 40 };
  state.weapon = 'pistol';

  const car = addCar(state, 'sports', 0x49e0c2, 480, -26, 0);
  car.speed = 21;
  state.player.inVehicle = car;
  car.driver = 'player';
  state.player.group.visible = false;
  state.player.pos.copy(car.pos);
  state.player.yaw = car.heading;

  // Clear the kerb behind the camera: a parked car there fills half the frame.
  for (const other of state.vehicles) {
    if (other === car || other.isPolice) continue;
    const dx = other.pos.x - 480;
    const dz = other.pos.z + 38;
    if (Math.hypot(dx, dz) < 16) other.root.visible = false;
  }

  const cruiser = createVehicle('police', 0xf3f5f2, state.scene);
  placeVehicle(cruiser, 488, -9, 0.12);
  state.vehicles.push(cruiser);
  cruiser.speed = 18;
  const second = createVehicle('police', 0xf3f5f2, state.scene);
  placeVehicle(second, 471, -3, -0.16);
  state.vehicles.push(second);
  second.speed = 15;

  state.police.units = [
    { vehicle: cruiser, alive: true, pos: cruiser.pos, type: 'car', isCop: true, shootTimer: 1, footSpawned: true, health: 100 },
    { vehicle: second, alive: true, pos: second.pos, type: 'car', isCop: true, shootTimer: 1, footSpawned: true, health: 100 },
  ];
  reportCrime(state.police, 3);
  state.police.wanted = 3;
  state.police.units.forEach((unit) => { unit.alive = true; });

  const cop = createPerson({ jacket: 0x27395c, shirt: 0xd7e2ec, pants: 0x1b2534, skin: 0xb9825e, hair: 0x1a1410 }, true);
  cop.root.position.set(494, 0.25, 4);
  cop.root.rotation.y = -Math.PI / 2;
  posePerson(cop, 0, 0.1, true);
  state.scene.add(cop.root);

  addCar(state, 'sedan', 0xf3e7cd, 480, 70, 0);
  addCar(state, 'van', 0x8b9b8f, 400, -40, Math.PI / 2);

  state.missions.active = state.missions.list[2];
  state.missions.index = 2;
  state.missions.stepIndex = 2;
  state.objectiveTitle = 'BAD RECEPTION';
  state.objectiveText = 'Lose the police';
  state.objectiveTimer = 'Wanted level must clear';
  state.missionBlip = { x: PLACES.marina.x, z: PLACES.marina.z };
  state.view.yaw = Math.PI;
  state.view.pitch = 0.16;
  state.view.distance = 9.4;
}

function stageMissionShot(state) {
  state.sky.setTime('day');
  state.money = 1680;
  state.player.health = 27;
  state.player.armour = 0;
  state.police.wanted = 0;
  state.weapons.smg = { mag: 5, reserve: 60 };
  state.weapon = 'smg';
  state.weaponData = { name: 'SMG' };
  placePlayer(state.player, 200, 486, Math.PI);
  state.player.rig.root.rotation.y = Math.PI;
  state.player.rig.rightArm.rotation.x = -1.35;
  state.missions.index = 2;
  try {
    stageMission(state.missions, state, 2, 1);
  } catch {
    // staging still renders the world if the mission data changes
  }
  // Regroup the crew in front of the camera: the real spawn list is spread across the yard.
  const crew = [[198, 468], [180, 462], [220, 460], [206, 448], [232, 452]];
  state.thugs.forEach((thug, index) => {
    const [x, z] = crew[index] ?? crew[0];
    thug.pos.set(x, 0.25, z);
    thug.home = { x, z };
    thug.yaw = 0;
    thug.group.position.copy(thug.pos);
    thug.group.rotation.y = 0;
    posePerson(thug.rig, 0, 0.1, true);
  });
  state.missionKills = 2;
  state.objectiveTitle = 'BAD RECEPTION';
  state.objectiveText = 'Take out the Salvage Crew';
  state.objectiveTimer = '3 left';
  state.missionBlip = { x: PLACES.docks.x, z: PLACES.docks.z };

  for (const thug of state.thugs) {
    thug.yaw = 0;
    thug.group.rotation.y = 0;
    posePerson(thug.rig, 0, 0.1, true);
  }

  addCar(state, 'sedan', 0xe4604d, 120, 540, Math.PI / 2);
  state.view.yaw = 0;
  state.view.pitch = 0.15;
  state.view.distance = 8.2;
}

function stageDusk(state) {
  state.sky.setTime('dusk');
  state.renderer.toneMappingExposure = 1.32;
  state.money = 5240;
  state.player.health = 84;
  state.player.armour = 55;
  state.police.wanted = 0;
  state.weapons.pistol = { mag: 12, reserve: 36 };

  const car = addCar(state, 'sports', 0xffb454, 478, -60, Math.PI);
  car.speed = 27;
  car.wheelSpin = 4;
  car.wheels.forEach((wheel) => { wheel.spin.rotation.x = 3.4; });
  state.player.inVehicle = car;
  car.driver = 'player';
  state.player.group.visible = false;
  state.player.pos.copy(car.pos);
  state.player.yaw = car.heading;

  addCar(state, 'sedan', 0x2f7f7a, 480, -166, Math.PI);
  addCar(state, 'van', 0xf3e7cd, 480, -238, Math.PI);
  state.missions.active = state.missions.list[5];
  state.missions.index = 5;
  state.missions.stepIndex = 0;
  state.objectiveTitle = 'TIDE TABLE';
  state.objectiveText = 'Drop at the north beach';
  state.objectiveTimer = 'Time 74s';
  state.missionBlip = { x: 560, z: -220 };
  state.view.yaw = 0;
  state.view.pitch = 0.08;
  state.view.distance = 9.2;
}

function addCar(state, kind, color, x, z, heading) {
  const car = createVehicle(kind, color, state.scene);
  placeVehicle(car, x, z, heading);
  state.vehicles.push(car);
  return car;
}

function settle(state, steps) {
  for (let i = 0; i < steps; i++) {
    state.traffic.update(1 / 60, state);
    state.peds.update(1 / 60, state);
    state.city.update(1 / 60);
    state.effects.update(1 / 60);
  }
}

function finish(state, name) {
  state.sky.follow(state.player.pos);
  updateCamera(state.camera, state.view, state.player, { x: 0, y: 0 }, 1 / 60, true);
  if (name === 'mission') {
    // Fire after the settle so the tracer and muzzle flash are still alive in the still.
    state.camera.lookAt(198, 1.2, 468);
    state.combat.fire(state);
    state.player.rig.flash.visible = true;
  }
  state.weaponData = state.weaponData ?? { name: state.weapon };
  state.ammoInMag = state.weapons[state.weapon]?.mag ?? 0;
  state.ammoReserve = state.weapons[state.weapon]?.reserve ?? 0;
  state.hud.update(state);
  drawMinimap(document.getElementById('minimap'), state, 0);
  if (name !== 'mission') state.player.rig.flash.visible = false;
  state.renderer.render(state.scene, state.camera);
  requestAnimationFrame(() => {
    state.renderer.render(state.scene, state.camera);
    window.__shotReady = true;
  });
}
