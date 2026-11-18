// Shooting: hitscan, recoil, ammo, reload and damage.
// Hitscan combat. Nico's shots leave the camera, hit the nearest person, car or wall and leave a
// tracer; officers and crew shoot back with a distance-weighted chance. Damage always reports a
// crime so the wanted system can react.

import * as THREE from 'three';
import { WEAPONS } from '../config.js';
import { damageVehicle } from '../entities/vehicle.js';
import { damagePlayer } from '../entities/player.js';

const rayOrigin = new THREE.Vector3();
const rayDir = new THREE.Vector3();
const hitPoint = new THREE.Vector3();

export function damagePed(ped, amount, state) {
  if (!ped.alive) return;
  ped.health -= amount;
  if (ped.health <= 0) {
    ped.alive = false;
    ped.down = 999;
    if (ped.group) ped.group.rotation.z = Math.PI / 2;
    if (state) {
      state.effects.blood(ped.pos);
      state.addCrime?.(ped.isCop ? 2 : 1);
      if (ped.isThug) state.missionKills = (state.missionKills ?? 0) + 1;
    }
  }
}

export function createCombat() {
  let cooldown = 0;
  let flashTimer = 0;

  function rayHit(state, origin, dir, range) {
    let bestT = range;
    let entity = null;
    let kind = 'none';
    let point = null;
    rayOrigin.copy(origin);

    const test = (position, radius, candidate, type) => {
      const ox = position.x - origin.x;
      const oy = position.y + (type === 'vehicle' ? 0.7 : 1.1) - origin.y;
      const oz = position.z - origin.z;
      const t = ox * dir.x + oy * dir.y + oz * dir.z;
      if (t < 0.5 || t > bestT) return;
      const px = ox - dir.x * t;
      const py = oy - dir.y * t;
      const pz = oz - dir.z * t;
      if (Math.hypot(px, py, pz) < radius) {
        bestT = t;
        entity = candidate;
        kind = type;
      }
    };

    for (const ped of state.peds.list) if (ped.alive) test(ped.pos, 0.78, ped, 'ped');
    for (const thug of state.thugs) if (thug.alive) test(thug.pos, 0.8, thug, 'thug');
    for (const unit of state.police.units) {
      if (!unit.alive || unit.vehicle) continue;
      test(unit.pos, 0.8, unit, 'cop');
    }
    for (const vehicle of state.vehicles) {
      if (!vehicle.alive) continue;
      test(vehicle.pos, 1.7, vehicle, 'vehicle');
    }

    // Buildings stop bullets: nearest 2D slab intersection, if the shot is low enough.
    for (const c of state.city.colliders) {
      const t = rayBox(origin, dir, c);
      if (t !== null && t < bestT) {
        const y = origin.y + dir.y * t;
        if (y < (c.h ?? 20) + 0.4) {
          bestT = t;
          entity = null;
          kind = 'wall';
        }
      }
    }

    point = hitPoint.copy(origin).addScaledVector(dir, bestT);
    return { point, entity, kind, distance: bestT };
  }

  function fire(state) {
    const weapon = WEAPONS[state.weapon];
    const inventory = state.weapons[state.weapon];
    if (!weapon || !inventory) return;
    if (state.weaponCooldown > 0) return;
    if (inventory.mag <= 0) {
      if (inventory.reserve > 0) reload(state);
      else state.audio?.impact(0.1);
      return;
    }
    inventory.mag -= 1;
    state.weaponCooldown = weapon.rate;
    state.audio?.gunshot(weapon.sound);
    state.noise = 1.8;
    state.muzzleFlash = 0.05;

    state.camera.getWorldDirection(rayDir);
    rayOrigin.copy(state.camera.position);
    for (let pellet = 0; pellet < weapon.pellets; pellet++) {
      const spread = weapon.spread;
      const dir = rayDir.clone();
      dir.x += (state.rng.next() - 0.5) * spread * 2;
      dir.y += (state.rng.next() - 0.5) * spread * 2;
      dir.z += (state.rng.next() - 0.5) * spread * 2;
      dir.normalize();
      const hit = rayHit(state, rayOrigin, dir, weapon.range);
      const muzzle = state.player.pos.clone().setY(state.player.pos.y + 1.5);
      state.effects.tracer(muzzle, hit.point, 0xffe0a0);
      if (hit.kind === 'ped') damagePed(hit.entity, weapon.damage, state);
      else if (hit.kind === 'thug') damagePed(hit.entity, weapon.damage, state);
      else if (hit.kind === 'cop') {
        damagePed(hit.entity, weapon.damage * 0.9, state);
        state.addCrime?.(1);
      } else if (hit.kind === 'vehicle') {
        damageVehicle(hit.entity, weapon.damage * 0.5);
        state.effects.spark(hit.point);
        if (hit.entity.isPolice) state.addCrime?.(1);
      } else if (hit.kind === 'wall') {
        state.effects.spark(hit.point);
        state.effects.dust(hit.point);
      }
    }
  }

  function reload(state) {
    const weapon = WEAPONS[state.weapon];
    const inventory = state.weapons[state.weapon];
    if (!weapon || !inventory) return;
    const need = weapon.mag - inventory.mag;
    const take = Math.min(need, inventory.reserve);
    if (take <= 0) return;
    inventory.mag += take;
    inventory.reserve -= take;
    state.audio?.impact(0.05);
  }

  return {
    update(state, dt) {
      cooldown = Math.max(0, cooldown - dt);
      state.weaponCooldown = Math.max(0, (state.weaponCooldown ?? 0) - dt);
      flashTimer = Math.max(0, flashTimer - dt);
      if (state.player.rig.flash) state.player.rig.flash.visible = flashTimer > 0;
      if (state.muzzleFlash > 0) {
        state.muzzleFlash -= dt;
        flashTimer = 0.05;
      }
    },
    fire,
    reload,
    get busy() { return cooldown > 0; },
  };
}

export function npcShoot(state, from, accuracy = 0.5) {
  const target = state.player.pos;
  const fresh = from.clone();
  fresh.y += 1.4;
  const aim = target.clone().setY(target.y + 1.2);
  state.effects.tracer(fresh, aim, 0xffcf9a);
  state.audio?.gunshot('pistol');
  if (state.rng.chance(accuracy)) {
    damagePlayer(state.player, 5 + Math.floor(state.rng.next() * 6));
    state.onPlayerHit?.();
  }
}

export function rayBox(origin, dir, box) {
  let tmin = -Infinity;
  let tmax = Infinity;
  const bounds = [[box.x - box.hw, box.x + box.hw, origin.x, dir.x], [box.z - box.hd, box.z + box.hd, origin.z, dir.z]];
  for (const [min, max, o, d] of bounds) {
    if (Math.abs(d) < 1e-6) {
      if (o < min || o > max) return null;
      continue;
    }
    let t1 = (min - o) / d;
    let t2 = (max - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  return Math.max(tmin, 0);
}
