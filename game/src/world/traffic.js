// Traffic that keeps to the grid: each car follows a lane toward the next intersection, picks a
// direction there, stops for Nico or a car in front, and honks when it has been waiting.

import * as THREE from 'three';
import { createVehicle, placeVehicle, updateVehicle } from '../entities/vehicle.js';

const CAR_COLORS = [0xf3e7cd, 0xe4604d, 0x2f7f7a, 0xf5d78a, 0x9fc2d8, 0xc9b6dc, 0xf7f4ea, 0x8b9b8f, 0xd98c63, 0x5d6b8a];

export function createTraffic(scene, rng, city, count = 18) {
  const roadsX = city.xRoads;
  const roadsZ = city.zRoads;
  const cars = [];
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function pickDirection(car, preferStraight = true) {
    if (preferStraight && rng.chance(0.55)) return;
    const options = directions.filter(([dx, dz]) => !(dx === -car.dx && dz === -car.dz));
    const [dx, dz] = rng.pick(options);
    car.dx = dx;
    car.dz = dz;
  }

  function targetFor(car) {
    const heading = Math.atan2(car.dx, car.dz);
    const rightX = Math.cos(heading);
    const rightZ = -Math.sin(heading);
    car.target = {
      x: roadsX[car.ix] + rightX * 4.2,
      z: roadsZ[car.iz] + rightZ * 4.2,
    };
  }

  for (let i = 0; i < count; i++) {
    const ix = rng.int(1, roadsX.length - 2);
    const iz = rng.int(1, roadsZ.length - 2);
    const [dx, dz] = rng.pick(directions);
    const kind = rng.pick(['sedan', 'sedan', 'sedan', 'sports', 'van']);
    const v = createVehicle(kind, rng.pick(CAR_COLORS), scene);
    const car = { v, ix, iz, dx, dz, target: null, honk: 0, wait: 0, stolen: false };
    const behind = rng.range(16, 62);
    placeVehicle(v, roadsX[ix] - dx * behind, roadsZ[iz] - dz * behind, Math.atan2(dx, dz));
    v.traffic = car;
    targetFor(car);
    cars.push(car);
  }

  return {
    cars,
    update(dt, state) {
      const player = state.player;
      for (const car of cars) {
        if (car.stolen || car.v.driver === 'player') continue;
        const v = car.v;
        if (!v.alive) continue;
        const distance = Math.hypot(car.target.x - v.pos.x, car.target.z - v.pos.z);
        if (distance < 8) {
          car.ix += car.dx;
          car.iz += car.dz;
          if (car.ix < 0 || car.ix >= roadsX.length || car.iz < 0 || car.iz >= roadsZ.length) {
            car.ix -= car.dx * 2;
            car.iz -= car.dz * 2;
            car.dx *= -1;
            car.dz *= -1;
          }
          pickDirection(car);
          targetFor(car);
        }

        const heading = Math.atan2(car.dx, car.dz);
        let diff = heading - v.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        // Is something in the way? Look a short cone ahead.
        let blocked = false;
        const fx = Math.sin(v.heading);
        const fz = Math.cos(v.heading);
        const gap = 7 + Math.abs(v.speed) * 0.45;
        const aheadOf = (x, z) => {
          const ox = x - v.pos.x;
          const oz = z - v.pos.z;
          const along = ox * fx + oz * fz;
          const side = Math.abs(ox * fz - oz * fx);
          return along > 0.5 && along < gap && side < 2.4;
        };
        if (!player.inVehicle && aheadOf(player.pos.x, player.pos.z)) blocked = true;
        for (const other of cars) {
          if (other === car || other.stolen || !other.v.alive) continue;
          if (aheadOf(other.v.pos.x, other.v.pos.z)) { blocked = true; break; }
        }
        if (state.player.inVehicle && state.player.inVehicle !== v && aheadOf(state.player.inVehicle.pos.x, state.player.inVehicle.pos.z)) blocked = true;

        if (blocked) {
          car.wait += dt;
          if (car.wait > 1.4) {
            car.honk -= dt;
            if (car.honk <= 0) {
              car.honk = 3.5;
              if (Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z) < 70) state.audio.horn();
            }
          }
        } else {
          car.wait = 0;
        }

        const steer = THREE.MathUtils.clamp(diff * 1.6, -1, 1);
        const wanted = blocked ? 0 : v.spec.maxSpeed * (distance < 26 ? 0.4 : 0.56);
        const throttle = THREE.MathUtils.clamp((wanted - v.speed) / 5, -1, 0.85);
        updateVehicle(v, { throttle, steer, handbrake: false }, dt, city);
      }
    },
  };
}
