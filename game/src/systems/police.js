// Police: createPolice and updatePolice run the wanted stars; reportCrime, clearWanted, damageOfficer.
// The wanted system: stars set how many cruisers come, cruisers spawn off-screen and drive at
// Nico, officers bail out on foot at two stars and shoot, the search cools when nobody has eyes
// on him, and standing still next to an officer gets him busted.

import * as THREE from 'three';
import { WANTED } from '../config.js';
import { createVehicle, placeVehicle, updateVehicle } from '../entities/vehicle.js';
import { createPerson, posePerson } from '../entities/person.js';
import { npcShoot, damagePed } from './combat.js';

const UNIFORM = { jacket: 0x27395c, shirt: 0xd7e2ec, pants: 0x1b2534, skin: 0xb9825e, hair: 0x1a1410 };

export function createPolice(scene) {
  return {
    scene,
    wanted: 0,
    heat: 0,
    units: [],
    decay: 0,
    spawnTimer: 1,
    bustTimer: 0,
    lostTimer: 0,
    nextFoot: 4,
  };
}

export function reportCrime(police, amount) {
  police.wanted = Math.min(WANTED.maxStars, Math.max(police.wanted, amount) + 0.2);
  police.heat = 1;
  police.decay = 0;
}

export function clearWanted(police) {
  police.wanted = 0;
  police.heat = 0;
  police.decay = 0;
  police.bustTimer = 0;
}

function roadSpawnNear(state, minDistance, maxDistance) {
  const roads = state.city.xRoads;
  for (let attempt = 0; attempt < 24; attempt++) {
    const x = roads[Math.floor(state.rng.next() * roads.length)];
    const z = roads[Math.floor(state.rng.next() * roads.length)];
    const d = Math.hypot(x - state.player.pos.x, z - state.player.pos.z);
    if (d > minDistance && d < maxDistance) return { x, z };
  }
  return { x: state.player.pos.x + minDistance, z: state.player.pos.z };
}

function spawnCruiser(police, state) {
  const spot = roadSpawnNear(state, 130, 260);
  const cruiser = createVehicle('police', 0xf3f5f2, state.scene);
  const heading = Math.atan2(state.player.pos.x - spot.x, state.player.pos.z - spot.z);
  placeVehicle(cruiser, spot.x, spot.z, heading);
  const unit = {
    vehicle: cruiser, alive: true, pos: cruiser.pos, type: 'car',
    shootTimer: 1.5, footSpawned: false, isCop: true, health: 100,
  };
  police.units.push(unit);
  state.vehicles.push(cruiser);
  return unit;
}

function spawnOfficer(police, state, near) {
  const spot = near ?? roadSpawnNear(state, 45, 90);
  const rig = createPerson(UNIFORM, true);
  state.scene.add(rig.root);
  const unit = {
    rig, group: rig.root, vehicle: null, type: 'foot', alive: true,
    pos: new THREE.Vector3(spot.x, 0.25, spot.z),
    yaw: 0, health: 55, shootTimer: 1 + state.rng.next(), isCop: true,
    walkPhase: 0,
  };
  rig.root.position.copy(unit.pos);
  police.units.push(unit);
  return unit;
}

export function updatePolice(police, state, dt) {
  const player = state.player;
  const wanted = police.wanted;
  police.heat = Math.max(0, police.heat - dt * 0.06);

  if (wanted <= 0) {
    for (const unit of police.units) {
      unit.alive = false;
      if (unit.vehicle && unit.vehicle !== player.inVehicle) {
        state.scene.remove(unit.vehicle.root);
        const index = state.vehicles.indexOf(unit.vehicle);
        if (index >= 0) state.vehicles.splice(index, 1);
      } else if (unit.group) {
        state.scene.remove(unit.group);
      }
    }
    police.units.length = 0;
    police.spawnTimer = 1.2;
    state.audio?.setSiren(0);
    return;
  }

  const maxCars = Math.min(4, Math.ceil(wanted));
  const cars = police.units.filter((u) => u.alive && u.vehicle).length;
  police.spawnTimer -= dt;
  if (cars < maxCars && police.spawnTimer <= 0) {
    police.spawnTimer = 3.6;
    spawnCruiser(police, state);
  }

  if (wanted >= 2) {
    police.nextFoot -= dt;
    const foot = police.units.filter((u) => u.alive && !u.vehicle).length;
    if (foot < Math.min(3, Math.floor(wanted)) && police.nextFoot <= 0) {
      police.nextFoot = 6;
      spawnOfficer(police, state);
    }
  }

  const playerPos = player.pos;
  let closest = Infinity;
  let nearestCar = null;

  for (const unit of police.units) {
    if (!unit.alive) continue;
    if (unit.vehicle) {
      const car = unit.vehicle;
      if (!car.alive) {
        unit.alive = false;
        continue;
      }
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const distance = Math.hypot(dx, dz);
      closest = Math.min(closest, distance);
      if (!nearestCar || distance < nearestCar) {
        nearestCar = { unit, distance };
      }
      const heading = Math.atan2(dx, dz);
      let diff = heading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = THREE.MathUtils.clamp(diff * 1.5, -1, 1);
      const targetSpeed = distance < 16 ? 7 : car.spec.maxSpeed;
      const throttle = THREE.MathUtils.clamp((targetSpeed - car.speed) / 6, -1, 0.95);
      updateVehicle(car, { throttle, steer, handbrake: distance < 14 }, dt, state.city);
      if (car.health < 45 && state.rng.chance(dt * 3)) {
        state.effects.smoke(car.pos, 0.8);
      }
      if (!unit.footSpawned && distance < 26 && wanted >= 2) {
        unit.footSpawned = true;
        spawnOfficer(police, state, { x: car.pos.x + 2, z: car.pos.z + 2 });
      }
    } else {
      const dx = playerPos.x - unit.pos.x;
      const dz = playerPos.z - unit.pos.z;
      const distance = Math.hypot(dx, dz);
      closest = Math.min(closest, distance);
      unit.yaw = Math.atan2(dx, dz);
      const speed = distance > 17 ? 4.8 : 0;
      if (speed > 0) {
        unit.pos.x += Math.sin(unit.yaw) * speed * dt;
        unit.pos.z += Math.cos(unit.yaw) * speed * dt;
        state.city.resolve(unit.pos, 0.5);
        posePerson(unit.rig, speed, dt, false);
      } else {
        posePerson(unit.rig, 0, dt, true);
      }
      unit.group.position.copy(unit.pos);
      unit.group.rotation.y = unit.yaw;

      unit.shootTimer -= dt;
      if (distance < 34 && unit.shootTimer <= 0) {
        unit.shootTimer = 1.1 + state.rng.next() * 0.7;
        const accuracy = THREE.MathUtils.clamp(0.75 - distance / 52, 0.18, 0.6);
        npcShoot(state, unit.pos, accuracy);
      }
      if (distance > 420) unit.alive = false;
    }
  }

  // Sirens fade with the nearest cruiser.
  if (nearestCar) {
    const level = Math.max(0, 1 - nearestCar.distance / 260);
    state.audio?.setSiren(police.wanted > 0 ? level : 0);
  } else {
    state.audio?.setSiren(0);
  }

  // Cool off when the coast is quiet.
  if (closest > 95) {
    police.decay += dt;
    if (police.decay > WANTED.starDecay) {
      police.decay = 0;
      police.wanted = Math.max(0, police.wanted - 1);
    }
  } else {
    police.decay = 0;
  }

  // Busted: stationary on foot with an officer close and no shooting for a moment.
  const onFoot = !player.inVehicle;
  const speed = player.speed;
  const officerNear = police.units.some((u) => u.alive && !u.vehicle && u.pos.distanceTo(playerPos) < WANTED.bustRadius);
  const carNear = police.units.some((u) => u.alive && u.vehicle && u.vehicle.pos.distanceTo(playerPos) < WANTED.bustRadius + 2);
  if (onFoot && speed < 2 && (officerNear || carNear) && police.heat < 0.4) {
    police.bustTimer += dt;
    if (police.bustTimer > 2.6) {
      police.bustTimer = 0;
      state.onBusted?.();
    }
  } else {
    police.bustTimer = 0;
  }
}

export function damageOfficer(unit, amount, state) {
  damagePed(unit, amount, state);
}
