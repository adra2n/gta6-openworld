// Sidewalk life: people loop their block, cross at the corners, and scatter when a gun goes off
// or a car comes at them. Cheap and readable: one figure, one loop, four corners.

import * as THREE from 'three';
import { createPerson, posePerson } from '../entities/person.js';
import { damagePed } from '../systems/combat.js';

const SHIRTS = [0xf2b8a2, 0xa8d8cd, 0xf5d78a, 0xc9b6dc, 0xefc1b0, 0x8fb8d8, 0xf4efe3, 0xff9b8a];
const PANTS = [0x24262e, 0x3b4a55, 0xd9d2c2, 0x6d5f4f, 0x2f4a46];
const SKIN = [0xb9825e, 0x8b5a3c, 0xe0b089, 0x6b4327, 0xc99b74];

export function createPedestrians(scene, rng, city, count = 26) {
  const list = [];
  const loops = city.pedLoops;
  for (let i = 0; i < count; i++) {
    const loop = loops[Math.floor(rng.next() * loops.length)];
    const start = Math.floor(rng.next() * 4);
    const rig = createPerson({
      jacket: rng.pick(SHIRTS),
      shirt: rng.pick(SHIRTS),
      pants: rng.pick(PANTS),
      skin: rng.pick(SKIN),
      hair: rng.pick([0x221a16, 0x3a2a1e, 0x6b5230, 0x111111]),
    });
    scene.add(rig.root);
    const ped = {
      rig, group: rig.root, loop, corner: start, dir: rng.chance(0.5) ? 1 : -1,
      pos: new THREE.Vector3(loop[start].x, 0.25, loop[start].z),
      yaw: 0, speed: rng.range(1.1, 1.7), health: 30, alive: true, flee: 0, down: 0,
      isPed: true,
    };
    // pedestrians start a little along their edge so they do not overlap on the corners
    ped.pos.x += rng.range(-20, 20);
    ped.pos.z += rng.range(-20, 20);
    rig.root.position.copy(ped.pos);
    list.push(ped);
  }

  function nextCorner(ped) {
    ped.corner = (ped.corner + ped.dir + 4) % 4;
    const point = ped.loop[ped.corner];
    ped.pos.x = point.x;
    ped.pos.z = point.z;
  }

  return {
    list,
    update(dt, state) {
      const playerPos = state.player.pos;
      const car = state.player.inVehicle;
      for (const ped of list) {
        if (!ped.alive) {
          if (ped.down > 0) {
            ped.down -= dt;
            ped.group.rotation.z = Math.min(Math.PI / 2, ped.group.rotation.z + dt * 5);
          }
          continue;
        }
        const dx = ped.pos.x - playerPos.x;
        const dz = ped.pos.z - playerPos.z;
        const near = Math.hypot(dx, dz);

        if (state.noise > 0 && near < 55) ped.flee = Math.max(ped.flee, 5);
        if (car && near < 9 && Math.abs(car.speed) > 6) ped.flee = Math.max(ped.flee, 4);
        if (near < 4 && !car) ped.flee = Math.max(ped.flee, 2);

        let speed = ped.speed;
        if (ped.flee > 0) {
          ped.flee -= dt;
          const away = Math.atan2(dx, dz);
          ped.yaw = away;
          speed = 4.6;
          ped.pos.x += Math.sin(ped.yaw) * speed * dt;
          ped.pos.z += Math.cos(ped.yaw) * speed * dt;
          city.resolve(ped.pos, 0.5);
          if (ped.pos.x > city.bounds.maxX - 1 || ped.pos.z > city.bounds.maxZ - 1) {
            ped.flee = 0;
          }
        } else {
          const target = ped.loop[ped.corner];
          const tx = target.x - ped.pos.x;
          const tz = target.z - ped.pos.z;
          if (Math.hypot(tx, tz) < 2.5) nextCorner(ped);
          else {
            ped.yaw = Math.atan2(tx, tz);
            ped.pos.x += Math.sin(ped.yaw) * speed * dt;
            ped.pos.z += Math.cos(ped.yaw) * speed * dt;
          }
        }
        // keep them on the block ring when a building shoves them
        city.resolve(ped.pos, 0.4);
        ped.group.position.set(ped.pos.x, 0.25, ped.pos.z);
        ped.group.rotation.y = ped.yaw;
        posePerson(ped.rig, speed, dt);
      }
    },
    damage(ped, amount) {
      damagePed(ped, amount);
    },
  };
}
