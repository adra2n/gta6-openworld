// Dispatch: createDispatch(scene, city) is the police scanner and its answer. Wanted-level
// changes queue spoken-style chatter; call('roadblock') parks cruisers across the road ahead,
// a helicopter shadows the player from three stars up, and an ambulance drives out to collect a
// downed pedestrian. Everything is capped and freed when the level drops.

import * as THREE from 'three';
import { createVehicle, placeVehicle, driveToward, updateVehicle } from '../entities/vehicle.js';

const CHATTER = {
  1: [
    'Dispatch, possible 10-50 near the marina. One unit responding.',
    'All units, a report of a disturbance. Keep it quiet, it is early.',
  ],
  2: [
    'Dispatch to all, we have a 10-52. Two cars, code two.',
    'Suspect is on foot and moving. Watch the alleys.',
  ],
  3: [
    'Air one, you are cleared to shadow. Keep the lights on him.',
    'Road units, set a block on the coast road. Nobody through.',
  ],
  4: [
    'All units, this is a 10-99. Every car in the south bay.',
    'He is not getting to the bridge. Shut it down.',
  ],
  5: [
    'Dispatch, we have lost visual and the whole bay is calling.',
    'Chief is on the line. Somebody bring me something.',
  ],
};

const MAX_ROADBLOCKS = 2;
const MAX_AMBULANCES = 2;
const HELI_HEIGHT = 44;

function nearestRoad(roads, value) {
  return roads.reduce((pick, road) => (Math.abs(road - value) < Math.abs(pick - value) ? road : pick), roads[0]);
}

export function createDispatch(scene, city) {
  const events = [];
  const roadblocks = [];
  const ambulances = [];
  const chatter = [];
  let helicopter = null;
  let lastWanted = 0;
  let chatterCooldown = 0;
  let ambulanceScan = 0;
  let clock = 0;
  let lastState = null;

  const heliGroup = new THREE.Group();
  const heliBody = new THREE.MeshStandardMaterial({ color: 0x27395c, roughness: 0.55, metalness: 0.2 });
  const heliGlass = new THREE.MeshStandardMaterial({ color: 0x9fd0e0, roughness: 0.2, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 4.6), heliBody);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.8), heliGlass);
  nose.position.set(0, -0.05, 2.7);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 4), heliBody);
  tail.position.set(0, 0.2, -3.9);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 0.8), heliBody);
  fin.position.set(0, 0.9, -5.6);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 6), heliBody);
  mast.position.y = 0.95;
  const rotor = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 4.6), heliBody);
    blade.rotation.y = (i / 4) * Math.PI;
    rotor.add(blade);
  }
  rotor.position.y = 1.35;
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.22), heliBody);
  tailRotor.position.set(0.3, 1.0, -5.7);
  const skidLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), heliBody);
  skidLeft.position.set(-1.1, -0.85, 0);
  const skidRight = skidLeft.clone();
  skidRight.position.x = 1.1;
  const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2030, toneMapped: false }));
  beacon.position.set(0, 0.72, 0.4);
  heliGroup.add(body, nose, tail, fin, mast, rotor, tailRotor, skidLeft, skidRight, beacon);
  heliGroup.visible = false;
  scene.add(heliGroup);

  function log(text) {
    events.push({ at: clock, text });
    if (events.length > 24) events.shift();
  }

  function say(text) {
    log(text);
    lastState?.notify?.(text, 'radio');
  }

  function queueChatter(level) {
    const lines = CHATTER[level];
    if (!lines) return;
    const line = lines[Math.floor(Math.random() * lines.length)];
    chatter.push(line);
  }

  function nearestDownedPed(state) {
    let best = null;
    let bestDistance = 170;
    for (const ped of state.peds?.list ?? []) {
      if (ped.alive || ped.claimed) continue;
      const distance = Math.hypot(ped.pos.x - state.player.pos.x, ped.pos.z - state.player.pos.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = ped;
      }
    }
    return best;
  }

  function callAmbulance(state) {
    if (ambulances.length >= MAX_AMBULANCES) return false;
    const ped = nearestDownedPed(state);
    if (!ped) return false;
    ped.claimed = true;
    const x = nearestRoad(city.xRoads, ped.pos.x);
    const z = nearestRoad(city.zRoads, ped.pos.z);
    const van = createVehicle('van', 0xf4f1e8, scene);
    placeVehicle(van, x, z, Math.atan2(ped.pos.x - x, ped.pos.z - z));
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.9), new THREE.MeshBasicMaterial({ color: 0xe4604d, toneMapped: false }));
    cross.position.set(1.13, 1.35, -0.3);
    van.root.add(cross);
    state.vehicles.push(van);
    ambulances.push({ van, ped, life: 26, phase: 'drive', wait: 0 });
    log('Dispatch: ambulance rolling to a downed civilian.');
    return true;
  }

  function callRoadblock(state) {
    if (roadblocks.length >= MAX_ROADBLOCKS) return false;
    const heading = state.player.inVehicle?.heading ?? state.player.yaw;
    const aheadX = state.player.pos.x + Math.sin(heading) * 64;
    const aheadZ = state.player.pos.z + Math.cos(heading) * 64;
    const roadX = nearestRoad(city.xRoads, aheadX);
    const roadZ = nearestRoad(city.zRoads, aheadZ);
    const northSouth = Math.abs(roadX - aheadX) < Math.abs(roadZ - aheadZ);
    const cars = [];
    for (let i = -1; i <= 1; i++) {
      const car = createVehicle('police', 0xf3f5f2, scene);
      if (northSouth) {
        placeVehicle(car, roadX, aheadZ + i * 7, Math.PI / 2);
      } else {
        placeVehicle(car, aheadX + i * 7, roadZ, 0);
      }
      state.vehicles.push(car);
      cars.push(car);
    }
    roadblocks.push({ cars, life: 30 });
    say('Dispatch: roadblock set. Nobody comes through.');
    return true;
  }

  function freeVehicles(list, state) {
    for (const entry of list) {
      const cars = entry.cars ?? [entry.van];
      for (const car of cars) {
        if (state.player.inVehicle === car) continue;
        scene.remove(car.root);
        const index = state.vehicles.indexOf(car);
        if (index >= 0) state.vehicles.splice(index, 1);
      }
    }
    list.length = 0;
  }

  return {
    events,

    call(kind) {
      const state = lastState;
      if (!state) return false;
      if (kind === 'roadblock') return callRoadblock(state);
      if (kind === 'ambulance') return callAmbulance(state);
      if (kind === 'helicopter') {
        if ((state.police?.wanted ?? 0) < 3) return false;
        heliGroup.visible = true;
        return true;
      }
      return false;
    },

    update(dt, state) {
      lastState = state;
      clock += dt;
      chatterCooldown -= dt;

      const wanted = state.police?.wanted ?? 0;
      if (Math.round(wanted) !== Math.round(lastWanted)) {
        if (wanted > lastWanted) queueChatter(Math.min(5, Math.ceil(wanted)));
        else if (wanted <= 0) say('Dispatch: suspect lost. Units stand down.');
        lastWanted = wanted;
      }

      // Chatter comes out one line at a time so it reads like a scanner, not a list.
      if (chatter.length > 0 && chatterCooldown <= 0) {
        say(chatter.shift());
        chatterCooldown = 3.4;
      }

      // The helicopter only exists for a high chase.
      const wantsAir = wanted >= 3 && state.mode === 'play';
      heliGroup.visible = wantsAir;
      if (wantsAir) {
        const angle = clock * 0.32;
        const targetX = state.player.pos.x + Math.cos(angle) * 42;
        const targetZ = state.player.pos.z + Math.sin(angle) * 42;
        const targetY = state.player.pos.y + HELI_HEIGHT + Math.sin(clock * 1.3) * 1.6;
        heliGroup.position.x += (targetX - heliGroup.position.x) * Math.min(1, dt * 0.9);
        heliGroup.position.z += (targetZ - heliGroup.position.z) * Math.min(1, dt * 0.9);
        heliGroup.position.y += (targetY - heliGroup.position.y) * Math.min(1, dt * 0.9);
        heliGroup.rotation.y = angle + Math.PI / 2;
        rotor.rotation.y += dt * 22;
        tailRotor.rotation.x += dt * 30;
        beacon.visible = Math.sin(clock * 12) > 0;
      }

      // Roadblocks time out, and everything police-side goes when the stars do.
      for (const block of [...roadblocks]) {
        block.life -= dt;
        if (block.life <= 0 || wanted <= 0) {
          freeVehicles([block], state);
          const index = roadblocks.indexOf(block);
          if (index >= 0) roadblocks.splice(index, 1);
        }
      }

      // Ambulances drive to the body, load it, then leave.
      ambulanceScan -= dt;
      if (ambulanceScan <= 0) {
        ambulanceScan = 3;
        if (ambulances.length < MAX_AMBULANCES) callAmbulance(state);
      }
      for (const entry of [...ambulances]) {
        entry.life -= dt;
        const ped = entry.ped;
        if (entry.phase === 'drive') {
          if (!ped || ped.pos === undefined) {
            entry.phase = 'leave';
            entry.life = Math.min(entry.life, 2);
            continue;
          }
          updateVehicle(entry.van, driveToward(entry.van, ped.pos, 0.7), dt, city);
          if (entry.van.pos.distanceTo(ped.pos) < 6) {
            entry.phase = 'load';
            entry.wait = 1.4;
          }
        } else if (entry.phase === 'load') {
          entry.wait -= dt;
          if (entry.wait <= 0) {
            scene.remove(ped.group ?? ped.rig?.root);
            const index = state.peds.list.indexOf(ped);
            if (index >= 0) state.peds.list.splice(index, 1);
            entry.phase = 'leave';
            entry.life = 1.4;
            log('Dispatch: ambulance collected a civilian.');
          }
        }
        if (entry.life <= 0 && entry.phase === 'leave') {
          freeVehicles([entry], state);
          const index = ambulances.indexOf(entry);
          if (index >= 0) ambulances.splice(index, 1);
        }
      }
    },
  };
}
