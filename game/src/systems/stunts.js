// Stunts: createStunts(scene, rng, city) builds eight ramp jumps on the straight roads, thirty
// spinning package pickups in the alleys, and one rampage marker that starts a ninety-second
// five-target fight. Jumps pay by speed, packages pay flat, the rampage pays the lot.

import * as THREE from 'three';
import { createPerson, posePerson } from '../entities/person.js';
import { npcShoot } from './combat.js';

const RAMP_COUNT = 8;
const PACKAGE_COUNT = 30;
const PACKAGE_CASH = 60;
const RAMPAGE_AT = { x: 300, z: 560 };
const RAMPAGE_TIME = 90;
const RAMPAGE_TARGETS = 5;
const RAMPAGE_CASH = 2500;
const THUG_LOOK = { jacket: 0x6b4a3a, shirt: 0x30282a, pants: 0x2f3338, skin: 0xa87852, hair: 0x1b1410 };

const GROUND = 0.25;

function rampMesh(material, edgeMaterial) {
  const group = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.4, 10), material);
  deck.position.set(0, 0.85, 0);
  deck.rotation.x = -0.28;
  deck.castShadow = true;
  const base = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.5, 3.2), material);
  base.position.set(0, 0.75, -3.1);
  base.castShadow = true;
  const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 10), edgeMaterial);
  railLeft.position.set(-3.7, 1.15, 0);
  railLeft.rotation.x = -0.28;
  const railRight = railLeft.clone();
  railRight.position.x = 3.7;
  group.add(deck, base, railLeft, railRight);
  return group;
}

export function createStunts(scene, rng, city) {
  const group = new THREE.Group();
  group.name = 'Stunts';
  scene.add(group);

  const rampMat = new THREE.MeshStandardMaterial({ color: 0xf5d78a, roughness: 0.72, metalness: 0.08 });
  const rampEdgeMat = new THREE.MeshStandardMaterial({ color: 0xe4604d, roughness: 0.6 });
  const packageMat = new THREE.MeshStandardMaterial({
    color: 0xffb454, emissive: 0xff7a1a, emissiveIntensity: 0.85, roughness: 0.35, metalness: 0.25,
  });
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xff5470, side: THREE.DoubleSide, transparent: true, opacity: 0.85, toneMapped: false });
  const pillarMat = new THREE.MeshBasicMaterial({ color: 0xff5470, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });

  const jumps = { list: [], landed: 0, cash: 0 };
  const packages = { list: [], found: 0, total: PACKAGE_COUNT };
  const rampage = { state: 'idle', timer: 0, kills: 0, targets: [], reward: RAMPAGE_CASH, cooldown: 0 };

  // ---------- ramps ----------
  const roads = city.xRoads;
  for (let i = 0; i < RAMP_COUNT; i++) {
    const onNorthSouth = i % 2 === 0;
    const lane = roads[(i * 3 + 2) % roads.length];
    const along = -430 + ((i * 7) % 18) * 46;
    const forward = i % 4 < 2 ? 0 : Math.PI;
    const dirX = onNorthSouth ? 0 : Math.sin(forward);
    const dirZ = onNorthSouth ? (i % 4 < 2 ? 1 : -1) : 0;
    const x = onNorthSouth ? lane : along;
    const z = onNorthSouth ? along : lane;
    const mesh = rampMesh(rampMat, rampEdgeMat);
    mesh.position.set(x, 0.2, z);
    mesh.rotation.y = onNorthSouth ? (dirZ > 0 ? 0 : Math.PI) : (dirX > 0 ? Math.PI / 2 : -Math.PI / 2);
    group.add(mesh);
    jumps.list.push({ x, z, dirX, dirZ, mesh });
  }

  // ---------- packages ----------
  const packageGeometry = new THREE.OctahedronGeometry(0.62, 0);
  for (let i = 0; i < PACKAGE_COUNT; i++) {
    const center = city.blockCenters.length ? rng.pick(city.blockCenters) : { x: -40, z: 40 };
    const angle = rng.range(0, Math.PI * 2);
    let x = center.x + Math.cos(angle) * 30.5;
    let z = center.z + Math.sin(angle) * 30.5;
    if (!city.clearSpotNear(x, z, 0.9)) {
      x = center.x + Math.cos(angle) * 34;
      z = center.z + Math.sin(angle) * 34;
    }
    const mesh = new THREE.Mesh(packageGeometry, packageMat);
    mesh.position.set(x, 1.15, z);
    group.add(mesh);
    packages.list.push({ x, z, mesh, taken: false, spin: rng.range(0, Math.PI * 2) });
  }

  // ---------- rampage marker ----------
  const marker = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.7, 26), markerMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.14;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 20, 14, 1, true), pillarMat);
  pillar.position.y = 10;
  marker.add(ring, pillar);
  marker.position.set(RAMPAGE_AT.x, GROUND, RAMPAGE_AT.z);
  group.add(marker);

  let air = null;

  function launch(car, state) {
    if (air || !car || Math.abs(car.speed) < 13) return;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    for (const ramp of jumps.list) {
      const dx = ramp.x - car.pos.x;
      const dz = ramp.z - car.pos.z;
      const along = dx * fx + dz * fz;
      if (along < -1.5 || along > 5.5) continue;
      if (Math.abs(dx * fz - dz * fx) > 4.4) continue;
      if (fx * ramp.dirX + fz * ramp.dirZ < 0.6) continue;
      const speed = Math.abs(car.speed);
      air = {
        car, t: 0,
        duration: 0.85 + speed * 0.016,
        lift: Math.min(7.5, speed * 0.24),
      };
      state.audio?.impact?.(0.3);
      state.notify?.('Ramp jump', 'mission');
      return;
    }
  }

  function flyAir(dt, state) {
    if (!air) return;
    air.t += dt;
    const k = Math.min(1, air.t / air.duration);
    const lift = Math.sin(k * Math.PI) * air.lift;
    air.car.root.position.y = air.car.pos.y + lift;
    air.car.body.rotation.x = -Math.cos(k * Math.PI) * 0.3;
    if (k < 1) return;
    air.car.root.position.y = air.car.pos.y;
    air.car.body.rotation.x = 0;
    const speed = Math.abs(air.car.speed);
    const cash = 120 + Math.round(speed * 7);
    state.money += cash;
    jumps.landed += 1;
    jumps.cash += cash;
    state.notify?.(`Stunt jump landed +$${cash}`, 'cash');
    state.audio?.pickup?.();
    air = null;
  }

  function collectPackages(state) {
    const player = state.player.pos;
    for (const pack of packages.list) {
      if (pack.taken) continue;
      if (Math.hypot(player.x - pack.x, player.z - pack.z) > 2.3) continue;
      pack.taken = true;
      pack.mesh.visible = false;
      packages.found += 1;
      state.money += PACKAGE_CASH;
      state.notify?.(`Package ${packages.found}/${packages.total} · +$${PACKAGE_CASH}`, 'cash');
      state.audio?.pickup?.();
    }
  }

  function spawnTargets(state) {
    const offsets = [[19, 2], [-17, 11], [6, -21], [-22, -9], [25, 17]];
    for (let i = 0; i < RAMPAGE_TARGETS; i++) {
      const [ox, oz] = offsets[i];
      const rig = createPerson(THUG_LOOK, true);
      const pos = new THREE.Vector3(RAMPAGE_AT.x + ox, GROUND, RAMPAGE_AT.z + oz);
      scene.add(rig.root);
      rig.root.position.copy(pos);
      const target = {
        rig, group: rig.root, pos, yaw: 0, health: 60, alive: true,
        isThug: false, isRampage: true, shootTimer: 1.4 + i * 0.4, walkPhase: 0,
        home: { x: pos.x, z: pos.z },
      };
      rampage.targets.push(target);
      state.thugs.push(target);
    }
  }

  function clearTargets(state) {
    for (const target of rampage.targets) {
      scene.remove(target.group);
      const index = state.thugs.indexOf(target);
      if (index >= 0) state.thugs.splice(index, 1);
    }
    rampage.targets.length = 0;
  }

  function startRampage(state) {
    rampage.state = 'running';
    rampage.timer = RAMPAGE_TIME;
    rampage.kills = 0;
    marker.visible = false;
    spawnTargets(state);
    state.hud?.bigMessage?.('RAMPAGE', `${RAMPAGE_TARGETS} targets · ${RAMPAGE_TIME} seconds`, 3);
    state.notify?.('Rampage started. Five targets, ninety seconds.', 'warning');
    state.audio?.impact?.(0.8);
  }

  function endRampage(state, won) {
    clearTargets(state);
    rampage.state = won ? 'won' : 'lost';
    rampage.cooldown = 24;
    rampage.timer = 0;
    rampage.kills = 0;
    if (won) {
      state.money += RAMPAGE_CASH;
      state.hud?.bigMessage?.('RAMPAGE COMPLETE', `+$${RAMPAGE_CASH.toLocaleString('en-US')}`, 3.5);
      state.notify?.(`Rampage complete +$${RAMPAGE_CASH}`, 'cash');
      state.audio?.pickup?.();
    } else {
      state.notify?.('Rampage over. The bay remembers.', 'warning');
      state.audio?.impact?.(0.7);
    }
  }

  function updateTargets(dt, state) {
    const player = state.player.pos;
    let dead = 0;
    for (const target of rampage.targets) {
      if (!target.alive) { dead += 1; continue; }
      const dx = player.x - target.pos.x;
      const dz = player.z - target.pos.z;
      const distance = Math.hypot(dx, dz);
      target.yaw = Math.atan2(dx, dz);
      const speed = distance > 15 ? 3.4 : 0;
      if (speed > 0) {
        target.pos.x += Math.sin(target.yaw) * speed * dt;
        target.pos.z += Math.cos(target.yaw) * speed * dt;
        city.resolve(target.pos, 0.5);
      }
      posePerson(target.rig, speed, dt, distance < 26);
      target.group.position.copy(target.pos);
      target.group.rotation.y = target.yaw;
      target.shootTimer -= dt;
      if (distance < 28 && target.shootTimer <= 0) {
        target.shootTimer = 1.6 + Math.random();
        npcShoot(state, target.pos, 0.4);
      }
    }
    rampage.kills = dead;
    if (dead >= RAMPAGE_TARGETS) endRampage(state, true);
  }

  return {
    jumps,
    packages,
    rampage,

    update(dt, state) {
      const player = state.player.pos;
      const car = state.player.inVehicle;

      for (const pack of packages.list) {
        if (pack.taken) continue;
        pack.spin += dt * 1.8;
        pack.mesh.rotation.y = pack.spin;
        pack.mesh.position.y = 1.15 + Math.sin(pack.spin * 1.4) * 0.18;
      }
      collectPackages(state);

      if (car) launch(car, state);
      flyAir(dt, state);

      if (rampage.state === 'running') {
        rampage.timer -= dt;
        updateTargets(dt, state);
        if (rampage.state === 'running' && rampage.timer <= 0) endRampage(state, false);
      } else {
        if (rampage.cooldown > 0) {
          rampage.cooldown -= dt;
          if (rampage.cooldown <= 0) {
            rampage.state = 'idle';
            marker.visible = true;
          }
        }
        if (rampage.state === 'idle' && !car && Math.hypot(player.x - RAMPAGE_AT.x, player.z - RAMPAGE_AT.z) < 6) {
          startRampage(state);
        }
      }

      if (marker.visible) {
        marker.rotation.y += dt * 0.6;
        ring.scale.setScalar(1 + Math.sin(performance.now() / 320) * 0.07);
      }
      if (air && !car) {
        air.car.root.position.y = air.car.pos.y;
        air.car.body.rotation.x = 0;
        air = null;
      }
    },
  };
}
