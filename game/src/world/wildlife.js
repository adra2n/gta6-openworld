// Wildlife: createWildlife(scene, rng, city) puts gulls over the marina, pigeons on the pavement
// and cats in the alleys. Three shared materials, forty animals at most, every one animated in
// place: gulls circle on a flap cycle, pigeons burst up from the player and settle again, cats
// sit, then take a short patrol, then sit.

import * as THREE from 'three';
import { PLACES } from './city.js';

const GROUND = 0.25;
const CAP = 40;
const GULL_COUNT = 12;
const PIGEON_COUNT = 18;
const CAT_COUNT = CAP - GULL_COUNT - PIGEON_COUNT;

/** A flat wing triangle with its tip out along +X and its trailing edge behind -Z. */
function wingGeometry(span, chord) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    span, 0, -chord * 0.25,
    span * 0.3, 0, -chord,
  ], 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Every block corner is walkable pavement; animals spawn from this list, never inside a wall. */
function collectCorners(city) {
  const corners = [];
  for (const loop of city.pedLoops) {
    for (const point of loop) corners.push(point);
  }
  if (corners.length === 0) {
    corners.push({ x: PLACES.marina.x + 18, z: PLACES.marina.z - 18 });
  }
  return corners;
}

export function createWildlife(scene, rng, city) {
  const gullMat = new THREE.MeshStandardMaterial({ color: 0xf6f3e8, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
  const pigeonMat = new THREE.MeshStandardMaterial({ color: 0x8b8f9b, roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
  const catMat = new THREE.MeshStandardMaterial({ color: 0xd39a57, roughness: 0.95, flatShading: true, side: THREE.DoubleSide });

  const gullWing = wingGeometry(1.05, 0.62);
  const pigeonWing = wingGeometry(0.36, 0.2);
  const catEar = new THREE.ConeGeometry(0.05, 0.14, 3);

  const corners = collectCorners(city);
  const birds = [];
  const pigeons = [];
  const cats = [];

  function makeGull() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.17, 0.64), gullMat);
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, 0.16), gullMat);
    head.position.set(0, 0.07, 0.36);
    const tail = new THREE.Mesh(gullWing, gullMat);
    tail.scale.setScalar(0.42);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0.02, -0.3);
    const leftPivot = new THREE.Group();
    leftPivot.position.set(-0.11, 0.05, 0);
    const left = new THREE.Mesh(gullWing, gullMat);
    left.scale.x = -1;
    leftPivot.add(left);
    const rightPivot = new THREE.Group();
    rightPivot.position.set(0.11, 0.05, 0);
    rightPivot.add(new THREE.Mesh(gullWing, gullMat));
    group.add(body, head, tail, leftPivot, rightPivot);
    return { group, leftPivot, rightPivot };
  }

  function makePigeon() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.15, 0.32), pigeonMat);
    body.position.y = 0.14;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), pigeonMat);
    head.position.set(0, 0.27, 0.15);
    const tail = new THREE.Mesh(pigeonWing, pigeonMat);
    tail.scale.setScalar(0.7);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0.1, -0.16);
    const leftPivot = new THREE.Group();
    leftPivot.position.set(-0.08, 0.17, 0);
    const left = new THREE.Mesh(pigeonWing, pigeonMat);
    left.scale.x = -1;
    leftPivot.add(left);
    const rightPivot = new THREE.Group();
    rightPivot.position.set(0.08, 0.17, 0);
    rightPivot.add(new THREE.Mesh(pigeonWing, pigeonMat));
    group.add(body, head, tail, leftPivot, rightPivot);
    return { group, leftPivot, rightPivot };
  }

  function makeCat() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.58), catMat);
    body.position.y = 0.16;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.18), catMat);
    head.position.set(0, 0.28, 0.3);
    const earLeft = new THREE.Mesh(catEar, catMat);
    earLeft.position.set(-0.06, 0.41, 0.3);
    const earRight = new THREE.Mesh(catEar, catMat);
    earRight.position.set(0.06, 0.41, 0.3);
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.2, -0.28);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.42), catMat);
    tail.position.z = -0.2;
    tailPivot.add(tail);
    group.add(body, head, earLeft, earRight, tailPivot);
    return { group, head, tailPivot };
  }

  // ---------- gulls: a wide, slow circle over the marina ----------
  for (let i = 0; i < GULL_COUNT; i++) {
    const built = makeGull();
    scene.add(built.group);
    birds.push({
      ...built,
      cx: PLACES.marina.x + rng.range(-26, 26),
      cz: PLACES.marina.z + rng.range(-26, 26),
      radius: rng.range(15, 42),
      height: rng.range(14, 30),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(0.16, 0.4) * (rng.chance(0.5) ? 1 : -1),
      flap: rng.range(0, 12),
      bob: rng.range(0, 8),
    });
  }

  // ---------- pigeons: pavement birds that panic and re-land ----------
  for (let i = 0; i < PIGEON_COUNT; i++) {
    const built = makePigeon();
    scene.add(built.group);
    const corner = rng.pick(corners);
    const x = corner.x + rng.range(-7, 7);
    const z = corner.z + rng.range(-7, 7);
    pigeons.push({
      ...built,
      x, z, y: GROUND,
      vx: 0, vy: 0, vz: 0,
      mode: 'ground',
      timer: 0,
      cooldown: rng.range(0, 2),
      yaw: rng.range(-Math.PI, Math.PI),
      peck: rng.range(0, 5),
    });
    built.group.position.set(x, GROUND, z);
    built.group.rotation.y = pigeons[pigeons.length - 1].yaw;
  }

  // ---------- cats: a sit, a short walk, a sit somewhere else ----------
  for (let i = 0; i < CAT_COUNT; i++) {
    const built = makeCat();
    scene.add(built.group);
    const corner = rng.pick(corners);
    const home = { x: corner.x + rng.range(-4, 4), z: corner.z + rng.range(-4, 4) };
    cats.push({
      ...built,
      home,
      x: home.x,
      z: home.z,
      target: { ...home },
      yaw: rng.range(-Math.PI, Math.PI),
      mode: 'sit',
      timer: rng.range(3, 9),
      speed: rng.range(1.1, 1.9),
      sway: rng.range(0, 6),
    });
    built.group.position.set(home.x, GROUND, home.z);
  }

  const scratch = new THREE.Vector3();
  const playerScratch = new THREE.Vector3();

  return {
    birds,
    cats,
    pigeons,

    update(dt, state) {
      const player = state?.player?.pos ?? playerScratch.set(0, 0, 0);

      // Gulls.
      for (const gull of birds) {
        gull.angle += gull.speed * dt;
        gull.flap += dt * (7 + Math.abs(gull.speed) * 5);
        const x = gull.cx + Math.cos(gull.angle) * gull.radius;
        const z = gull.cz + Math.sin(gull.angle) * gull.radius;
        const y = gull.height + Math.sin(gull.flap * 0.23 + gull.bob) * 1.3;
        gull.group.position.set(x, y, z);
        gull.group.rotation.y = -gull.angle + (gull.speed > 0 ? 0 : Math.PI);
        const flap = Math.sin(gull.flap) * 0.62;
        gull.leftPivot.rotation.z = flap;
        gull.rightPivot.rotation.z = -flap;
        gull.group.rotation.z = Math.sin(gull.flap * 0.5) * 0.08;
      }

      // Pigeons.
      for (const pigeon of pigeons) {
        pigeon.cooldown = Math.max(0, pigeon.cooldown - dt);
        pigeon.peck += dt;
        if (pigeon.mode === 'ground') {
          const near = Math.hypot(pigeon.x - player.x, pigeon.z - player.z);
          if (near < 6.5 && pigeon.cooldown <= 0) {
            const away = Math.atan2(pigeon.x - player.x, pigeon.z - player.z);
            const hurry = 3.2 + Math.random() * 2.2;
            pigeon.mode = 'fly';
            pigeon.timer = 1.8 + Math.random() * 2.4;
            pigeon.vx = Math.sin(away) * hurry;
            pigeon.vz = Math.cos(away) * hurry;
            pigeon.vy = 3.4 + Math.random() * 1.6;
            pigeon.yaw = away;
          }
          pigeon.leftPivot.rotation.z = 0;
          pigeon.rightPivot.rotation.z = 0;
          const bob = Math.max(0, Math.sin(pigeon.peck * 5)) * 0.02;
          pigeon.group.position.set(pigeon.x, pigeon.y + bob, pigeon.z);
        } else {
          pigeon.timer -= dt;
          pigeon.y += pigeon.vy * dt;
          pigeon.vy -= 8.5 * dt;
          pigeon.x += pigeon.vx * dt;
          pigeon.z += pigeon.vz * dt;
          const glide = Math.sin(pigeon.timer * 26) * 0.9;
          pigeon.leftPivot.rotation.z = glide;
          pigeon.rightPivot.rotation.z = -glide;
          if (pigeon.timer <= 0 && pigeon.y <= GROUND) {
            pigeon.y = GROUND;
            pigeon.vy = 0;
            pigeon.mode = 'ground';
            pigeon.cooldown = 2.5;
          }
          pigeon.x = THREE.MathUtils.clamp(pigeon.x, city.bounds.minX, city.bounds.maxX);
          pigeon.z = THREE.MathUtils.clamp(pigeon.z, city.bounds.minZ, city.bounds.maxZ);
          pigeon.group.position.set(pigeon.x, pigeon.y, pigeon.z);
        }
        pigeon.group.rotation.y = pigeon.yaw;
      }

      // Cats.
      for (const cat of cats) {
        cat.timer -= dt;
        cat.sway += dt * 1.6;
        if (cat.timer <= 0) {
          if (cat.mode === 'sit') {
            cat.mode = 'walk';
            cat.timer = 5 + Math.random() * 5;
            const angle = Math.random() * Math.PI * 2;
            const reach = 9 + Math.random() * 12;
            cat.target.x = THREE.MathUtils.clamp(cat.home.x + Math.cos(angle) * reach, city.bounds.minX + 4, city.bounds.maxX - 4);
            cat.target.z = THREE.MathUtils.clamp(cat.home.z + Math.sin(angle) * reach, city.bounds.minZ + 4, city.bounds.maxZ - 4);
          } else {
            cat.mode = 'sit';
            cat.timer = 5 + Math.random() * 8;
          }
        }
        if (cat.mode === 'walk') {
          const dx = cat.target.x - cat.x;
          const dz = cat.target.z - cat.z;
          const distance = Math.hypot(dx, dz);
          if (distance < 1.2) {
            cat.mode = 'sit';
            cat.timer = 4 + Math.random() * 7;
          } else {
            cat.yaw = Math.atan2(dx, dz);
            const step = Math.min(distance, cat.speed * dt);
            cat.x += Math.sin(cat.yaw) * step;
            cat.z += Math.cos(cat.yaw) * step;
            scratch.set(cat.x, GROUND, cat.z);
            city.resolve(scratch, 0.32);
            cat.x = scratch.x;
            cat.z = scratch.z;
          }
          cat.head.rotation.x = 0;
        } else {
          cat.head.rotation.x = 0.12 + Math.sin(cat.sway) * 0.06;
        }
        cat.tailPivot.rotation.y = Math.sin(cat.sway * 1.4) * (cat.mode === 'sit' ? 0.5 : 0.9);
        cat.group.position.set(cat.x, GROUND, cat.z);
        cat.group.rotation.y = cat.yaw;
      }
    },
  };
}
