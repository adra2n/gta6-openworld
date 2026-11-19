// Heists: createHeists(scene, rng, city) sets three scores on the city's own blocks — a corner
// store, a jewellery shop and a bank. Stand in the marker to fill the hold timer; the alarm
// raises the wanted level and the payout drains the longer the bag stays open. Once the bag is
// shut the getaway window opens: get clear of the block and the money is yours.

import * as THREE from 'three';

const GROUND = 0.3;
const RADIUS = 6;
const ESCAPE_DISTANCE = 85;
const COOLDOWN = 20;

// Face value, hold time, police response and getaway window for each job.
const JOBS = [
  {
    id: 'store', label: 'Corner Store', hold: 4.5, pay: 700, floor: 280,
    stars: 2, window: 14, color: 0xffb454,
    where: (block) => block.x <= -120 && block.z >= 160,
  },
  {
    id: 'jewellery', label: 'Jewellery Shop', hold: 6.5, pay: 1800, floor: 700,
    stars: 3, window: 16, color: 0xff7ad9,
    where: (block) => block.x >= 320 && block.z >= 40,
  },
  {
    id: 'bank', label: 'Bank', hold: 9, pay: 4200, floor: 1500,
    stars: 4, window: 18, color: 0x64d2ff,
    where: (block) => Math.abs(block.x) <= 120 && Math.abs(block.z) <= 120,
  },
];

export function createHeists(scene, rng, city) {
  const group = new THREE.Group();
  group.name = 'Heists';
  scene.add(group);

  const centres = city?.blockCenters ?? city?.blocks ?? [];
  const used = new Set();
  const clearAt = (x, z) => (typeof city?.clearSpotNear === 'function' ? city.clearSpotNear(x, z, 1.6) : true);
  const builtAt = (block) => (typeof city?.clearSpotNear === 'function' ? !city.clearSpotNear(block.x, block.z, 4) : true);
  const keyOf = (block) => `${Math.round(block.x)},${Math.round(block.z)}`;

  // A job wants a block with a building on it; the marker goes on the pavement outside the door.
  function pickBlock(job) {
    const open = centres.filter((block) => !used.has(keyOf(block)) && builtAt(block));
    const matching = open.filter(job.where);
    const block = (matching.length ? matching : open).length
      ? rng.pick(matching.length ? matching : open)
      : { x: 40, z: 40 };
    used.add(keyOf(block));
    return block;
  }

  function markerPoint(block) {
    for (const [ox, oz] of [[30, 0], [-30, 0], [0, 30], [0, -30], [30, 30], [-30, -30]]) {
      if (clearAt(block.x + ox, block.z + oz)) return { x: block.x + ox, z: block.z + oz };
    }
    return { x: block.x + 30, z: block.z };
  }

  function makeMarker(job, at) {
    const root = new THREE.Group();
    root.position.set(at.x, GROUND, at.z);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: job.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, toneMapped: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(RADIUS - 0.75, RADIUS, 30), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.16;
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(RADIUS - 0.85, 30),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(job.color).offsetHSL(0, 0, 0.18),
        transparent: true, opacity: 0.3, side: THREE.DoubleSide, toneMapped: false,
      }),
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.15;
    fill.scale.setScalar(0.01);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(RADIUS * 0.8, RADIUS, 16, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: job.color, transparent: true, opacity: 0.1, side: THREE.DoubleSide,
        depthWrite: false, toneMapped: false,
      }),
    );
    beam.position.y = 8;
    root.add(ring, fill, beam);
    return { root, ring, fill, beam };
  }

  const heists = JOBS.map((job) => {
    const block = pickBlock(job);
    const at = markerPoint(block);
    const marker = makeMarker(job, at);
    group.add(marker.root);
    return {
      id: job.id, label: job.label, x: at.x, z: at.z,
      hold: job.hold, payMax: job.pay, minPay: job.floor, stars: job.stars, window: job.window,
      phase: 'idle', progress: 0, timer: 0, payout: job.pay, take: 0, cooldown: 0, alarm: false,
      pulse: rng.range(0, Math.PI * 2), marker,
    };
  });

  let running = null;
  let doneCount = 0;
  let lastState = null;

  function inMarker(heist, state) {
    return Math.hypot(state.player.pos.x - heist.x, state.player.pos.z - heist.z) < RADIUS;
  }

  function raiseWanted(state, level) {
    // state.police only exposes counters here, so the game's own crime call is the clean route.
    if (typeof state.addCrime === 'function') {
      state.addCrime(level);
      return;
    }
    const police = state.police;
    if (!police) return;
    police.wanted = Math.max(police.wanted ?? 0, level);
    police.heat = 1;
    police.decay = 0;
  }

  function begin(heist, state) {
    running = heist;
    heist.phase = 'holding';
    heist.progress = 0;
    heist.payout = heist.payMax;
    heist.take = 0;
    heist.alarm = false;
    state.notify?.(`${heist.label}: stay in the marker and empty the till.`, 'mission');
    state.audio?.pickup?.();
  }

  function soundAlarm(heist, state) {
    heist.alarm = true;
    raiseWanted(state, heist.stars);
    state.hud?.bigMessage?.('ALARM', `${heist.label} · $${Math.round(heist.payout)} on the table`, 3);
    state.notify?.(`Alarm at the ${heist.label}. ${heist.stars} stars inbound.`, 'warning');
    state.audio?.impact?.(0.9);
  }

  function collect(heist, state, reason) {
    const paid = Math.max(0, Math.round(heist.payout));
    state.money += paid;
    heist.take = paid;
    heist.phase = 'done';
    heist.marker.root.visible = false;
    running = null;
    doneCount += 1;
    state.hud?.bigMessage?.('PAYDAY', `+$${paid.toLocaleString('en-US')}`, 3.5);
    state.notify?.(`${heist.label} take: +$${paid} (${reason})`, 'cash');
    state.audio?.pickup?.();
  }

  function lose(heist, state) {
    heist.phase = 'cooldown';
    heist.cooldown = COOLDOWN;
    heist.progress = 0;
    heist.payout = heist.payMax;
    heist.marker.root.visible = false;
    running = null;
    state.notify?.(`The ${heist.label} take is gone.`, 'warning');
  }

  function start() {
    const state = lastState;
    if (!state || running || state.mode !== 'play') return false;
    if (state.player.inVehicle) return false;
    const heist = heists.find((entry) => entry.phase === 'idle' && inMarker(entry, state));
    if (!heist) return false;
    begin(heist, state);
    return true;
  }

  return {
    heists,
    start,

    get active() { return running; },
    get done() { return doneCount; },
    get blip() {
      const player = lastState?.player?.pos;
      let best = null;
      let bestDistance = Infinity;
      for (const heist of heists) {
        if (heist.phase === 'done') continue;
        const distance = player ? Math.hypot(player.x - heist.x, player.z - heist.z) : 0;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = heist;
        }
      }
      return best ? { x: best.x, z: best.z } : null;
    },

    update(dt, state) {
      lastState = state;
      const now = performance.now();

      for (const heist of heists) {
        const marker = heist.marker;
        if (heist.phase === 'done') continue;
        if (heist.phase === 'cooldown') {
          heist.cooldown -= dt;
          if (heist.cooldown <= 0) {
            heist.phase = 'idle';
            marker.root.visible = true;
          }
          continue;
        }
        if (heist.phase === 'idle') marker.fill.scale.setScalar(0.01);
        marker.ring.scale.setScalar(1 + Math.sin(now / 420 + heist.pulse) * 0.05);
        marker.ring.material.opacity = 0.62 + Math.sin(now / 300 + heist.pulse) * 0.2;
        marker.beam.material.opacity = 0.07 + Math.sin(now / 600 + heist.pulse) * 0.04;
      }

      if (state.mode !== 'play') {
        if (running) lose(running, state);
        return;
      }

      if (!running) {
        start();
        return;
      }

      const heist = running;
      const away = Math.hypot(state.player.pos.x - heist.x, state.player.pos.z - heist.z);

      if (heist.phase === 'holding') {
        if (inMarker(heist, state) && !state.player.inVehicle) {
          heist.progress = Math.min(1, heist.progress + dt / heist.hold);
          heist.payout = Math.max(
            heist.minPay,
            heist.payout - ((heist.payMax - heist.minPay) / (heist.hold * 1.35)) * dt,
          );
        } else {
          heist.progress -= dt / (heist.hold * 1.4);
          if (heist.progress <= 0) {
            heist.phase = 'idle';
            heist.progress = 0;
            heist.payout = heist.payMax;
            running = null;
            state.notify?.(`You stepped out of the ${heist.label}. No take.`, 'warning');
            return;
          }
        }
        heist.marker.fill.scale.setScalar(Math.max(0.01, heist.progress));
        if (!heist.alarm && heist.progress >= 0.55) soundAlarm(heist, state);
        if (heist.progress >= 1) {
          heist.phase = 'window';
          heist.timer = heist.window;
          heist.marker.fill.scale.setScalar(1);
          state.hud?.bigMessage?.('GETAWAY', `$${Math.round(heist.payout).toLocaleString('en-US')} if you get clear`, 3);
          state.notify?.('Bag is shut. Lose the cops.', 'mission');
          state.audio?.impact?.(0.7);
        }
        return;
      }

      if (heist.phase === 'window') {
        heist.timer -= dt;
        heist.marker.fill.material.opacity = Math.sin(now / 120) > 0 ? 0.4 : 0.12;
        if (away > ESCAPE_DISTANCE) {
          collect(heist, state, 'clean getaway');
          return;
        }
        if (heist.timer <= 0) {
          collect(heist, state, 'slipped the search');
          return;
        }
        if ((state.police?.wanted ?? 0) <= 0 || state.player.dead) {
          lose(heist, state);
        }
      }
    },
  };
}
