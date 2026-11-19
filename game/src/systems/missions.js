// Missions: createMissions and updateMissions run the jobs; startMission, stageMission, failCurrentMission.
// Rosa Delgado's seven jobs, from a first pistol to the Paloma Pier heist. Each job is a list of
// steps — drive here, kill these, steal that, lose the cops — with a world marker, a minimap
// blip, dialogue lines and a cash reward that autosaves.

import * as THREE from 'three';
import { PLACES, placeAt } from '../world/city.js';
import { createPerson, posePerson } from '../entities/person.js';
import { createVehicle, placeVehicle, updateVehicle } from '../entities/vehicle.js';
import { reportCrime } from './police.js';
import { npcShoot } from './combat.js';

const THUG_LOOK = { jacket: 0x7c5844, shirt: 0x2f2a26, pants: 0x3a3a3a, skin: 0xa87852, hair: 0x1b1410 };

const MISSIONS = [
  {
    id: 'first-tide',
    title: 'First Tide',
    contact: 'Rosa Delgado',
    reward: 600,
    intro: [
      'Rosa: Nico Vale. You look like a man with a car and no plan.',
      'Rosa: I run this marina, and this marina runs the south bay.',
      'Rosa: Take this pistol. See Sal at the pawn shop, then come back.',
    ],
    steps: [
      { kind: 'goto', at: placeAt(PLACES.shop), radius: 7, text: 'Meet Sal at Vega Pawn', talk: 'Sal: Rosa sent you? This once it is on the house.' },
      { kind: 'goto', at: PLACES.marina, radius: 8, text: 'Return to Rosa at the marina', talk: 'Rosa: Good. Now you are somebody with a car, a gun and a plan.' },
    ],
    outro: ['Rosa: Get some sleep. Tomorrow the bay starts paying you.'],
  },
  {
    id: 'beach-run',
    title: 'Beach Run',
    contact: 'Rosa Delgado',
    reward: 900,
    intro: [
      'Rosa: The Laguna has a package that has to be on the docks in ninety seconds.',
      'Rosa: Drive fast, do not open it, and do not stop for anyone with a badge.',
    ],
    steps: [
      { kind: 'goto', at: PLACES.hotel, radius: 7, text: 'Pick up the package at Hotel Laguna', time: 100 },
      { kind: 'goto', at: PLACES.docks, radius: 8, text: 'Deliver the package to the docks' },
    ],
    outro: ['Rosa: Early. The dockmaster hates early. That is how I know it worked.'],
  },
  {
    id: 'bad-reception',
    title: 'Bad Reception',
    contact: 'Rosa Delgado',
    reward: 1500,
    intro: [
      'Rosa: The Salvage Crew has been lifting our crates off the quay.',
      'Rosa: Five of them are at the docks right now. Make it expensive for them.',
    ],
    steps: [
      { kind: 'goto', at: PLACES.docks, radius: 12, text: 'Drive to the Vega Docks', talk: 'Rosa: That is them. Keep your head down.' },
      {
        kind: 'kill', at: PLACES.docks, count: 5, radius: 40, text: 'Take out the Salvage Crew',
        spawn: [[160, 452], [226, 462], [248, 438], [182, 498], [242, 504]],
      },
      { kind: 'escape', text: 'Lose the police', crime: 2 },
    ],
    outro: ['Rosa: Five less problem solvers. The bay noticed.'],
  },
  {
    id: 'wake-rider',
    title: 'Wake Rider',
    contact: 'Sal Moretti',
    reward: 1800,
    intro: [
      'Sal: A courier is running hotel money north along the coast road.',
      'Sal: Grey Manta GT. Wreck it before it reaches the bridge and the money is ours.',
    ],
    steps: [
      { kind: 'goto', at: PLACES.hotel, radius: 8, text: 'Spot the courier at the Laguna' },
      {
        kind: 'chase', at: { x: 470, z: -180 }, radius: 260, text: 'Wreck the grey Manta',
        spawn: { x: 470, z: -60, kind: 'sports', color: 0x8f969e, route: [{ x: 470, z: -260 }, { x: 470, z: -440 }, { x: 300, z: -440 }, { x: 40, z: -440 }] },
      },
    ],
    outro: ['Sal: Beautiful noise. The money is in the trunk. Rosa will pay you out.'],
  },
  {
    id: 'night-shift',
    title: 'Night Shift',
    contact: 'Rosa Delgado',
    reward: 2200,
    intro: [
      'Rosa: There is a Manta GT parked out on the pier. Keys are in it. Shame.',
      'Rosa: Take it for a drive. The CVE will notice. Let them not catch you.',
    ],
    steps: [
      { kind: 'goto', at: PLACES.pier, radius: 14, text: 'Get to Paloma Pier' },
      {
        kind: 'steal', at: { x: 556, z: -272 }, radius: 6, text: 'Steal the Manta GT',
        spawn: { x: 556, z: -272, kind: 'sports', color: 0xff5470 },
      },
      { kind: 'escape', text: 'Lose the police', crime: 2 },
    ],
    outro: ['Rosa: That car is worth more than the marina. Park it somewhere I can sell it.'],
  },
  {
    id: 'tide-table',
    title: 'Tide Table',
    contact: 'Sal Moretti',
    reward: 2500,
    intro: [
      'Sal: Three buyers on the coast tonight, one bag each.',
      'Sal: Pier, beach club, marina. A hundred and ten seconds. Go.',
    ],
    steps: [
      { kind: 'goto', at: { x: 560, z: -220 }, radius: 10, text: 'Drop at the north beach', time: 110 },
      { kind: 'goto', at: { x: 566, z: 250 }, radius: 10, text: 'Drop at the beach club' },
      { kind: 'goto', at: { x: 400, z: 470 }, radius: 10, text: 'Drop at the marina road' },
      { kind: 'goto', at: PLACES.marina, radius: 8, text: 'Get back to Rosa' },
    ],
    outro: ['Sal: On time. Do you know how rare that is on this coast?'],
  },
  {
    id: 'king-tide',
    title: 'King Tide',
    contact: 'Rosa Delgado',
    reward: 8000,
    intro: [
      'Rosa: This is the one, Nico. The pier casino counts its take on the roof deck.',
      'Rosa: Six guards, one bag, and every cruiser in Costa Vega between you and the marina.',
      'Rosa: Bring it home and the marina is yours.',
    ],
    steps: [
      { kind: 'goto', at: PLACES.pier, radius: 16, text: 'Get to the Paloma Pier pavilion', talk: 'Rosa: Go in loud. Come out rich.' },
      {
        kind: 'kill', at: PLACES.pier, count: 6, radius: 40, text: 'Clear the pier guards',
        spawn: [[570, -318], [600, -304], [618, -282], [574, -268], [604, -256], [588, -338]],
      },
      { kind: 'grab', at: { x: 574, z: -300 }, radius: 4, text: 'Grab the take from the pavilion', cash: 4000, crime: 3 },
      { kind: 'escape', text: 'Lose the police and get clear', crime: 3 },
    ],
    outro: [
      'Rosa: You did it. The marina, the pier, the whole south bay.',
      'Rosa: Go home, Nico. You are not famous. That is the whole trick.',
    ],
  },
];

export function createMissions(scene) {
  const marker = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 2.1, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd35c, side: THREE.DoubleSide, transparent: true, opacity: 0.85, toneMapped: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.9, 22, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd35c, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
  );
  beam.position.y = 11;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, toneMapped: false }),
  );
  diamond.position.y = 5.5;
  marker.add(ring, beam, diamond);
  marker.visible = false;
  scene.add(marker);

  return {
    list: MISSIONS,
    index: 0,
    active: null,
    stepIndex: 0,
    timer: 0,
    enemies: [],
    vehicle: null,
    courierRoute: [],
    courierLeg: 0,
    lostTimer: 0,
    marker,
    markerPos: new THREE.Vector3(),
    blip: null,
    talkTimer: 0,
    talkQueue: [],
    markerPulse: 0,
  };
}

function mission(missions) {
  return missions.active ?? missions.list[missions.index] ?? null;
}

function pointOf(at) {
  return { x: at.x, z: at.z };
}

export function updateMissions(missions, state, dt) {
  missions.markerPulse += dt;
  const pulse = 1 + Math.sin(missions.markerPulse * 3) * 0.08;
  missions.marker.scale.set(pulse, 1, pulse);

  // dialogue lines come out one at a time
  if (missions.talkQueue.length) {
    missions.talkTimer -= dt;
    if (missions.talkTimer <= 0) {
      const line = missions.talkQueue.shift();
      state.hud.say('', line, 5);
      missions.talkTimer = 4.2;
    }
  }

  if (!missions.active) {
    const next = missions.list[missions.index];
    if (!next) {
      missions.blip = null;
      missions.marker.visible = false;
      state.objectiveTitle = 'COSTA VEGA';
      state.objectiveText = 'All seven jobs done. The bay is yours.';
      state.objectiveTimer = '';
      return;
    }
    missions.blip = { x: PLACES.marina.x, z: PLACES.marina.z };
    missions.marker.visible = true;
    missions.marker.position.set(PLACES.marina.x, 0.2, PLACES.marina.z);
    missions.markerPos.copy(missions.marker.position);
    state.objectiveTitle = 'ROSA DELGADO';
    state.objectiveText = `Meet Rosa at the marina — ${next.title}`;
    state.objectiveTimer = 'Press E at the marker';
    return;
  }

  const active = missions.active;
  const step = active.steps[missions.stepIndex];
  if (!step) return;

  if (missions.timer > 0) {
    missions.timer -= dt;
    state.objectiveTimer = `Time ${Math.max(0, Math.ceil(missions.timer))}s`;
    if (missions.timer <= 0) {
      failMission(missions, state, 'Out of time.');
      return;
    }
  } else if (step.time) {
    missions.timer = step.time;
  }

  // World marker and blip.
  let target = step.at ?? (step.kind === 'escape' ? PLACES.marina : active.steps[missions.stepIndex - 1]?.at ?? PLACES.marina);
  if (step.kind === 'chase' && missions.vehicle) target = missions.vehicle.pos;
  if (step.kind === 'steal' && missions.vehicle) target = missions.vehicle.pos;
  missions.blip = { x: target.x, z: target.z };
  missions.marker.visible = true;
  missions.marker.position.set(target.x, 0.2, target.z);
  missions.markerPos.copy(missions.marker.position);

  state.objectiveTitle = active.title.toUpperCase();
  state.objectiveText = step.text;
  if (!step.time) {
    if (step.kind === 'kill') state.objectiveTimer = `${Math.max(0, step.count - (state.missionKills ?? 0))} left`;
    else if (step.kind === 'escape') state.objectiveTimer = 'Wanted level must clear';
    else state.objectiveTimer = '';
  }

  switch (step.kind) {
    case 'goto': {
      if (near(state.player.pos, step.at, step.radius ?? 7)) advanceStep(missions, state, step);
      break;
    }
    case 'kill': {
      if ((state.missionKills ?? 0) >= step.count) advanceStep(missions, state, step);
      break;
    }
    case 'grab': {
      if (near(state.player.pos, step.at, step.radius ?? 4)) {
        state.money += step.cash ?? 0;
        state.hud.toast(`+$${(step.cash ?? 0).toLocaleString('en-US')} — the take is in the bag`, 3);
        state.audio?.pickup();
        if (step.crime) reportCrime(state.police, step.crime);
        advanceStep(missions, state, step);
      }
      break;
    }
    case 'steal': {
      if (missions.vehicle && state.player.inVehicle === missions.vehicle) advanceStep(missions, state, step);
      break;
    }
    case 'chase': {
      const car = missions.vehicle;
      if (!car) { advanceStep(missions, state, step); break; }
      if (!car.alive || car.health <= 0) {
        state.hud.toast('Courier wrecked. The money is yours.', 3);
        advanceStep(missions, state, step);
        break;
      }
      driveCourier(missions, state, car, dt);
      const distance = Math.hypot(car.pos.x - state.player.pos.x, car.pos.z - state.player.pos.z);
      if (distance > 260) {
        missions.lostTimer += dt;
        if (missions.lostTimer > 7) failMission(missions, state, 'The courier got away.');
      } else missions.lostTimer = 0;
      break;
    }
    case 'escape': {
      if ((state.police?.wanted ?? 0) <= 0) advanceStep(missions, state, step);
      break;
    }
    default:
      break;
  }

  updateThugs(missions, state, dt);
}

function near(pos, at, radius) {
  return Math.hypot(pos.x - at.x, pos.z - at.z) < radius;
}

function advanceStep(missions, state, step) {
  missions.stepIndex += 1;
  if (missions.stepIndex >= missions.active.steps.length) {
    completeMission(missions, state);
  } else {
    enterStep(missions, state);
  }
}

function enterStep(missions, state) {
  const step = missions.active.steps[missions.stepIndex];
  if (!step) return;
  missions.timer = step.time ?? 0;
  state.hud.say('', step.talk ?? '', 4);
  state.audio?.pickup();

  if (step.kind === 'kill' && step.spawn) {
    clearEnemies(missions, state);
    state.missionKills = 0;
    for (const [x, z] of step.spawn) spawnThug(missions, state, x, z);
  }
  if ((step.kind === 'chase' || step.kind === 'steal') && step.spawn) {
    const info = step.spawn;
    const car = createVehicle(info.kind ?? 'sports', info.color ?? 0x8f969e, state.scene);
    placeVehicle(car, info.x, info.z, 0);
    missions.vehicle = car;
    missions.courierRoute = info.route ?? [];
    missions.courierLeg = 0;
    state.vehicles.push(car);
  }
  if (step.kind === 'escape' && (state.police?.wanted ?? 0) < (step.crime ?? 1)) {
    reportCrime(state.police, step.crime ?? 1);
  }
}

function spawnThug(missions, state, x, z) {
  const rig = createPerson(THUG_LOOK, true);
  state.scene.add(rig.root);
  const thug = {
    rig, group: rig.root, pos: new THREE.Vector3(x, 0.25, z), yaw: 0,
    health: 65, alive: true, isThug: true, shootTimer: 1 + state.rng.next(),
    walkPhase: 0, home: { x, z },
  };
  rig.root.position.copy(thug.pos);
  missions.enemies.push(thug);
  state.thugs.push(thug);
}

export function startMission(missions, state) {
  if (missions.active || missions.index >= missions.list.length) return false;
  const active = missions.list[missions.index];
  missions.active = active;
  missions.stepIndex = 0;
  missions.timer = 0;
  missions.enemies.length = 0;
  state.thugs.length = 0;
  state.missionKills = 0;
  state.lostTimer = 0;
  missions.talkQueue = [...active.intro];
  missions.talkTimer = 0.4;
  enterStep(missions, state);
  state.hud.toast(`Job started: ${active.title}`, 3);
  state.audio?.pickup();
  return true;
}

export function stageMission(missions, state, index, stepIndex) {
  missions.index = index;
  missions.active = missions.list[index];
  missions.stepIndex = stepIndex;
  missions.timer = 0;
  state.thugs.length = 0;
  missions.enemies.length = 0;
  state.missionKills = 0;
  missions.talkQueue.length = 0;
  enterStep(missions, state);
}

export function failCurrentMission(missions, state, reason) {
  if (missions.active) failMission(missions, state, reason);
}

function completeMission(missions, state) {
  const active = missions.active;
  state.money += active.reward;
  state.hud.bigMessage('JOB COMPLETE', `+$${active.reward.toLocaleString('en-US')} · ${active.title}`, 4.5);
  state.audio?.pickup();
  state.missions.talkQueue = [...(active.outro ?? [])];
  state.missions.talkTimer = 0.6;
  clearEnemies(missions, state);
  if (missions.vehicle) {
    const index = state.vehicles.indexOf(missions.vehicle);
    if (index >= 0) state.vehicles.splice(index, 1);
    missions.vehicle = null;
  }
  missions.active = null;
  missions.index += 1;
  state.onMissionComplete?.();
}

function failMission(missions, state, reason) {
  state.hud.bigMessage('MISSION FAILED', reason ?? 'Return to Rosa at the marina', 4.5);
  state.audio?.impact(1);
  clearEnemies(missions, state);
  if (missions.vehicle) {
    const index = state.vehicles.indexOf(missions.vehicle);
    if (index >= 0) state.vehicles.splice(index, 1);
    missions.vehicle = null;
  }
  missions.active = null;
  missions.stepIndex = 0;
  missions.timer = 0;
  state.objectiveTimer = '';
}

function clearEnemies(missions, state) {
  for (const thug of missions.enemies) {
    state.scene.remove(thug.group);
  }
  missions.enemies.length = 0;
  state.thugs.length = 0;
}

function updateThugs(missions, state, dt) {
  const player = state.player.pos;
  for (const thug of missions.enemies) {
    if (!thug.alive) continue;
    const dx = player.x - thug.pos.x;
    const dz = player.z - thug.pos.z;
    const distance = Math.hypot(dx, dz);
    thug.yaw = Math.atan2(dx, dz);
    const speed = distance > 16 ? 3.6 : 0;
    if (speed > 0) {
      thug.pos.x += Math.sin(thug.yaw) * speed * dt;
      thug.pos.z += Math.cos(thug.yaw) * speed * dt;
      state.city.resolve(thug.pos, 0.5);
      posePerson(thug.rig, speed, dt, false);
    } else {
      posePerson(thug.rig, 0, dt, true);
    }
    thug.group.position.copy(thug.pos);
    thug.group.rotation.y = thug.yaw;
    thug.shootTimer -= dt;
    if (distance < 30 && thug.shootTimer <= 0) {
      thug.shootTimer = 1.4 + state.rng.next() * 0.9;
      npcShoot(state, thug.pos, THREE.MathUtils.clamp(0.5 - distance / 90, 0.1, 0.45));
    }
  }
}

function driveCourier(missions, state, car, dt) {
  if (missions.courierRoute.length === 0) return;
  const target = missions.courierRoute[missions.courierLeg];
  const distance = Math.hypot(target.x - car.pos.x, target.z - car.pos.z);
  if (distance < 18) {
    missions.courierLeg = (missions.courierLeg + 1) % missions.courierRoute.length;
  }
  const dx = target.x - car.pos.x;
  const dz = target.z - car.pos.z;
  const heading = Math.atan2(dx, dz);
  let diff = heading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = THREE.MathUtils.clamp(diff * 1.5, -1, 1);
  updateVehicle(car, { throttle: 0.82, steer, handbrake: false }, dt, state.city);
  car.traffic = null;
}
