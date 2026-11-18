// Vehicles: four silhouettes (sedan, sports, van, cruiser) with arcade handling that scales
// steering with speed, handbrake drift, suspension lean, spinning wheels and damage smoke.

import * as THREE from 'three';
import { VEHICLES } from '../config.js';

const GROUND_Y = 0.3;

export function createVehicle(kind, color, scene) {
  const spec = VEHICLES[kind] ?? VEHICLES.sedan;
  const built = buildVehicleMesh(kind, color, spec);
  scene.add(built.root);
  return {
    kind, spec, color,
    root: built.root,
    body: built.body,
    wheels: built.wheels,
    lights: built.lights,
    pos: new THREE.Vector3(0, GROUND_Y, 0),
    heading: 0,
    speed: 0,
    steer: 0,
    health: spec.health,
    maxHealth: spec.health,
    wheelSpin: 0,
    smoke: 0,
    siren: 0,
    alive: true,
    driver: null,
    isPolice: kind === 'police',
    lean: 0,
    pitch: 0,
  };
}

export function placeVehicle(v, x, z, heading = 0) {
  v.pos.set(x, GROUND_Y, z);
  v.heading = heading;
  v.speed = 0;
  v.root.position.copy(v.pos);
  v.root.rotation.y = heading;
}

function buildVehicleMesh(kind, color, spec) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const w = spec.width;
  const h = spec.height;
  const l = spec.length;
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.4, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x18252e, roughness: 0.12, metalness: 0.55 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd7d9d4, roughness: 0.28, metalness: 0.8 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.55, l), paint);
  chassis.position.y = h * 0.5 + 0.18;
  chassis.castShadow = true;
  body.add(chassis);

  if (kind === 'van') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.8, l * 0.78), paint);
    box.position.set(0, h * 0.82, -l * 0.08);
    box.castShadow = true;
    body.add(box);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 0.3, 0.08), glass);
    windshield.position.set(0, h * 0.9, l * 0.32);
    body.add(windshield);
  } else {
    const cabinLength = kind === 'sports' ? l * 0.42 : l * 0.5;
    const cabinHeight = kind === 'sports' ? h * 0.48 : h * 0.55;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, cabinHeight, cabinLength), glass);
    cabin.position.set(0, h * 0.72 + cabinHeight * 0.4, kind === 'sports' ? -0.15 : -0.2);
    cabin.castShadow = true;
    body.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.1, cabinLength * 0.94), paint);
    roof.position.set(0, h * 0.72 + cabinHeight * 0.9, kind === 'sports' ? -0.15 : -0.2);
    body.add(roof);
  }

  if (kind === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.08, 0.5), dark);
    spoiler.position.set(0, h * 0.85, -l * 0.46);
    body.add(spoiler);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.12), dark);
      strut.position.set(side * w * 0.4, h * 0.72, -l * 0.44);
      body.add(strut);
    }
  }

  if (kind === 'police') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, h * 0.2, l * 0.42), dark);
    stripe.position.set(0, h * 0.5, -0.1);
    body.add(stripe);
    const push = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.22, 0.18), chrome);
    push.position.set(0, h * 0.38, l * 0.5);
    body.add(push);
  }

  // Wheels: pivots steer, inner groups roll.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.9 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.3, metalness: 0.7 });
  for (const [sx, sz, front] of [[-1, 1, true], [1, 1, true], [-1, -1, false], [1, -1, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * w * 0.48, 0.38, sz * l * 0.32);
    const spin = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, wheelMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.28, 8), hubMat);
    hub.rotation.z = Math.PI / 2;
    spin.add(tyre, hub);
    pivot.add(spin);
    root.add(pivot);
    wheels.push({ pivot, spin, front });
  }

  // Lights.
  const lights = { head: [], tail: [], bar: [] };
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a, toneMapped: false });
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.08), headMat);
    head.position.set(sx * w * 0.3, h * 0.5, l * 0.5);
    body.add(head);
    lights.head.push(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.07), tailMat);
    tail.position.set(sx * w * 0.3, h * 0.52, -l * 0.5);
    body.add(tail);
    lights.tail.push(tail);
  }
  if (kind === 'police') {
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2030, toneMapped: false }));
    red.position.set(-0.3, h * 0.95 + 0.12, -0.1);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x2060ff, toneMapped: false }));
    blue.position.set(0.3, h * 0.95 + 0.12, -0.1);
    body.add(red, blue);
    lights.bar.push(red, blue);
  }

  // A simple shadow catcher for parked cars looks wrong on the road; rely on the sun instead.
  return { root, body, wheels, lights };
}

export function vehicleForward(v, out = new THREE.Vector3()) {
  return out.set(Math.sin(v.heading), 0, Math.cos(v.heading));
}

export function updateVehicle(v, controls, dt, city) {
  const spec = v.spec;
  const throttle = controls.throttle ?? 0;
  const steerInput = controls.steer ?? 0;
  const handbrake = !!controls.handbrake;

  const top = spec.maxSpeed * (v.health < 25 ? 0.6 : 1);
  if (throttle > 0) {
    v.speed += spec.accel * throttle * (1 - Math.min(1, Math.abs(v.speed) / top)) * dt;
  } else if (throttle < 0) {
    if (v.speed > 0.4) v.speed -= spec.brake * dt;
    else v.speed = Math.max(-top * 0.34, v.speed + spec.accel * 0.55 * throttle * dt);
  }
  const drag = handbrake ? 3.4 : 0.55;
  v.speed -= v.speed * drag * dt;
  if (handbrake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 9 * dt);
  v.speed = THREE.MathUtils.clamp(v.speed, -top * 0.34, top);

  v.steer += (steerInput - v.steer) * Math.min(1, dt * 8);
  const grip = handbrake ? 0.4 : Math.min(1, Math.abs(v.speed) / 5);
  const turn = v.steer * spec.steer * grip * Math.min(1, 22 / (Math.abs(v.speed) + 6)) * Math.sign(v.speed || 1);
  v.heading += turn * dt * (handbrake ? 1.6 : 1);

  const forward = vehicleForward(v);
  v.pos.x += forward.x * v.speed * dt;
  v.pos.z += forward.z * v.speed * dt;

  const beforeX = v.pos.x;
  const beforeZ = v.pos.z;
  city.resolve(v.pos, Math.max(spec.width, spec.length * 0.32));
  if (Math.abs(v.pos.x - beforeX) > 0.01 || Math.abs(v.pos.z - beforeZ) > 0.01) {
    if (Math.abs(v.speed) > 6) damageVehicle(v, Math.abs(v.speed) * 0.9);
    v.speed *= -0.18;
  }

  v.wheelSpin += (v.speed * dt) / 0.36;
  for (const wheel of v.wheels) {
    wheel.spin.rotation.x = v.wheelSpin;
    wheel.pivot.rotation.y = wheel.front ? v.steer * 0.45 : 0;
  }

  v.lean += (-v.steer * Math.abs(v.speed) * 0.006 - v.lean) * Math.min(1, dt * 6);
  v.pitch += ((throttle > 0 ? -0.025 : throttle < 0 ? 0.03 : 0) - v.pitch) * Math.min(1, dt * 5);
  v.body.rotation.z = v.lean;
  v.body.rotation.x = v.pitch;
  v.root.position.copy(v.pos);
  v.root.rotation.y = v.heading;
  v.siren += dt;
  if (v.isPolice) {
    const blink = Math.sin(v.siren * 10) > 0;
    if (v.lights.bar[0]) v.lights.bar[0].material.color.setHex(blink ? 0xff3040 : 0x330008);
    if (v.lights.bar[1]) v.lights.bar[1].material.color.setHex(blink ? 0x101040 : 0x4080ff);
  }
}

/** Steers an AI car toward a point: returns the control bag updateVehicle wants. */
export function driveToward(v, target, maxSpeed = 1) {
  const dx = target.x - v.pos.x;
  const dz = target.z - v.pos.z;
  const wanted = Math.atan2(dx, dz);
  let diff = wanted - v.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = THREE.MathUtils.clamp(diff * 1.8, -1, 1);
  const distance = Math.hypot(dx, dz);
  const targetSpeed = Math.min(v.spec.maxSpeed * maxSpeed, distance * 1.4);
  const throttle = v.speed < targetSpeed ? 1 : -1;
  return { throttle, steer, handbrake: false, maxSpeed: targetSpeed };
}

export function damageVehicle(v, amount) {
  v.health = Math.max(0, v.health - amount);
  if (v.health < 35) v.smoke = 1;
  if (v.health <= 0) v.alive = false;
}
