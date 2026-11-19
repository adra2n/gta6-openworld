// Races: createRaces(scene, city) builds three checkpoint routes along the city's own roads —
// glowing gates in order, a three-second countdown, a running clock and a cash prize that shrinks
// the longer the run takes. Each route keeps its own best time.

import * as THREE from 'three';

const ROUTES = [
  {
    name: 'Downtown Loop',
    points: [[-320, -160], [-320, 160], [0, 160], [0, -160], [-160, -160]],
  },
  {
    name: 'Coast Run',
    points: [[480, 320], [480, -80], [400, -80], [400, 160], [480, 160]],
  },
  {
    name: 'Docks Sprint',
    points: [[-240, 320], [160, 320], [160, 480], [-80, 480], [-80, 320]],
  },
];

const GATE_RADIUS = 7;
const PASS_RADIUS = 9;
const COUNTDOWN = 3.4;

export function createRaces(scene, city) {
  const group = new THREE.Group();
  group.name = 'Races';
  scene.add(group);

  const gates = [];
  const best = ROUTES.map(() => null);
  let run = null;
  let nextRoute = 0;

  // Every gate sits on a real road from the city grid, so a route is drivable by construction.
  const snap = (value) => city.xRoads.reduce((pick, road) => (Math.abs(road - value) < Math.abs(pick - value) ? road : pick), city.xRoads[0]);
  const tracks = ROUTES.map((route) => ({
    name: route.name,
    points: route.points.map(([x, z]) => [snap(x), snap(z)]),
  }));

  function headingBetween(route, index) {
    const from = route.points[index === 0 ? 0 : index - 1];
    const to = route.points[index === 0 ? 1 : index];
    return Math.atan2(to[0] - from[0], to[1] - from[1]);
  }

  for (let r = 0; r < tracks.length; r++) {
    const route = tracks[r];
    const list = [];
    for (let p = 0; p < route.points.length; p++) {
      const [x, z] = route.points[p];
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(GATE_RADIUS, 0.38, 6, 22),
        new THREE.MeshBasicMaterial({ color: 0x49e0c2, transparent: true, opacity: 0.9, toneMapped: false }),
      );
      ring.position.set(x, GATE_RADIUS + 0.6, z);
      ring.rotation.y = headingBetween(route, p);
      ring.visible = false;
      group.add(ring);
      list.push(ring);
    }
    gates.push(list);
  }

  function showGates(routeIndex, currentStep) {
    for (let r = 0; r < gates.length; r++) {
      for (let p = 0; p < gates[r].length; p++) {
        const gate = gates[r][p];
        const live = r === routeIndex;
        gate.visible = live;
        if (!live) continue;
        const isNext = p === currentStep;
        gate.material.color.setHex(isNext ? 0x49e0c2 : 0x9b8bff);
        gate.material.opacity = isNext ? 0.95 : 0.22;
      }
    }
  }

  function hideGates() {
    for (const routeGates of gates) for (const gate of routeGates) gate.visible = false;
  }

  function finish(state) {
    const routeIndex = run.route;
    const time = run.time;
    if (best[routeIndex] === null || time < best[routeIndex]) best[routeIndex] = time;
    const prize = Math.max(600, Math.round(2600 - time * 18));
    state.money += prize;
    state.hud?.bigMessage?.('RACE COMPLETE', `${time.toFixed(1)}s · +$${prize.toLocaleString('en-US')}`, 4);
    state.notify?.(`${tracks[routeIndex].name}: ${time.toFixed(1)}s +$${prize}`, 'cash');
    state.audio?.pickup?.();
    run = null;
    hideGates();
  }

  return {
    best,

    get active() { return !!run; },
    get route() { return run ? run.route : null; },
    get routes() { return tracks; },

    start() {
      if (run) return false;
      nextRoute = (nextRoute + 1) % tracks.length;
      run = { route: nextRoute, step: 0, countdown: COUNTDOWN, time: 0, started: false };
      showGates(run.route, 0);
      return true;
    },

    update(dt, state) {
      if (!run) return;
      if (state.mode === 'wasted' || state.mode === 'busted') {
        run = null;
        hideGates();
        return;
      }
      if (state.mode !== 'play') return;

      if (!run.started) {
        const before = Math.ceil(run.countdown);
        run.countdown -= dt;
        const after = Math.ceil(run.countdown);
        if (after !== before && after > 0) state.notify?.(String(after), 'mission');
        if (run.countdown <= 0) {
          run.started = true;
          run.time = 0;
          state.notify?.(`${tracks[run.route].name} — go`, 'mission');
          state.audio?.pickup?.();
        }
        return;
      }

      run.time += dt;
      const point = tracks[run.route].points[run.step];
      const player = state.player.pos;
      const distance = Math.hypot(player.x - point[0], player.z - point[1]);
      if (distance > PASS_RADIUS) return;

      run.step += 1;
      if (run.step >= tracks[run.route].points.length) {
        finish(state);
        return;
      }
      showGates(run.route, run.step);
      state.audio?.pickup?.();
      state.notify?.(`Checkpoint ${run.step}/${tracks[run.route].points.length} · ${run.time.toFixed(1)}s`, 'mission');
      const gate = gates[run.route][run.step];
      gate.material.opacity = 0.95;
    },
  };
}
