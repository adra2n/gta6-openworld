// Player: createPlayer, placePlayer and updatePlayer move Nico; playerMuzzle, damagePlayer, healPlayer. `player.pos` is the truth.
// Nico Vale, the player: a low-poly figure with a cream blazer, a walk/run/sprint cycle, a jump,
// and the little gun in his hand. The camera lives in main.js; this module only moves the body.

import * as THREE from 'three';
import { FOOT } from '../config.js';

const GROUND_Y = 0.25;

export function createPlayer(scene) {
  const group = new THREE.Group();
  group.name = 'NicoVale';
  const rig = buildFigure();
  group.add(rig.root);
  scene.add(group);

  return {
    group, rig,
    pos: new THREE.Vector3(0, GROUND_Y, 0),
    vel: new THREE.Vector3(),
    yaw: 0,
    health: 100,
    armour: 0,
    onGround: true,
    dead: false,
    inVehicle: null,
    speed: 0,
    walkPhase: 0,
    shootCooldown: 0,
    aimBlend: 0,
  };
}

function buildFigure() {
  const root = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xb9825e, roughness: 0.8 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0xf2e6cd, roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x2f7f7a, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x24262e, roughness: 0.85 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x221a16, roughness: 0.9 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.7 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.7, 0.34), jacket);
  torso.position.y = 1.34;
  torso.castShadow = true;
  root.add(torso);

  const shirtFront = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.06), shirt);
  shirtFront.position.set(0, 1.36, 0.19);
  root.add(shirtFront);

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.32), pants);
  hips.position.y = 0.96;
  root.add(hips);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.32), skin);
  head.position.y = 1.91;
  head.castShadow = true;
  root.add(head);

  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.13, 0.34), hair);
  hairTop.position.y = 2.11;
  root.add(hairTop);
  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.1), hair);
  hairBack.position.set(0, 2.0, -0.16);
  root.add(hairBack);

  const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.04), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.3 }));
  glasses.position.set(0, 1.96, 0.17);
  root.add(glasses);

  function limb(material, w, h, d, x, y) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.y = -h / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    root.add(pivot);
    return pivot;
  }

  const leftArm = limb(jacket, 0.17, 0.66, 0.2, -0.37, 1.62);
  const rightArm = limb(jacket, 0.17, 0.66, 0.2, 0.37, 1.62);
  const leftLeg = limb(pants, 0.21, 0.8, 0.24, -0.15, 0.9);
  const rightLeg = limb(pants, 0.21, 0.8, 0.24, 0.15, 0.9);

  for (const leg of [leftLeg, rightLeg]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.34), shoe);
    boot.position.set(0, -0.78, 0.06);
    leg.add(boot);
  }

  const gun = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.42), new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.4, metalness: 0.6 }));
  barrel.position.z = 0.2;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.1), new THREE.MeshStandardMaterial({ color: 0x3b2b22 }));
  grip.position.set(0, -0.1, 0.02);
  gun.add(barrel, grip);
  gun.position.set(0, -0.56, 0.1);
  rightArm.add(gun);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.32),
    new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  flash.position.set(0, -0.02, 0.44);
  flash.visible = false;
  gun.add(flash);

  return { root, leftArm, rightArm, leftLeg, rightLeg, torso, head, gun, flash };
}

export function placePlayer(player, x, z, yaw = 0) {
  player.pos.set(x, GROUND_Y, z);
  player.vel.set(0, 0, 0);
  player.yaw = yaw;
  player.dead = false;
  player.group.position.copy(player.pos);
  player.group.rotation.y = yaw;
  player.group.visible = true;
}

/** Moves the body from walk/run input, resolves buildings, jumps, and animates the limbs. */
export function updatePlayer(player, command, cameraYaw, dt, city) {
  if (player.inVehicle || player.dead) {
    player.group.visible = false;
    return;
  }
  player.group.visible = true;
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);

  const forward = command.forward ? 1 : 0;
  const back = command.back ? 1 : 0;
  const left = command.left ? 1 : 0;
  const right = command.right ? 1 : 0;
  let moveX = 0;
  let moveZ = 0;
  const camF = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  const camR = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
  moveX += camF.x * (forward - back) + camR.x * (right - left);
  moveZ += camF.z * (forward - back) + camR.z * (right - left);
  const moving = moveX !== 0 || moveZ !== 0;
  const len = Math.hypot(moveX, moveZ) || 1;
  const speed = command.sprint ? FOOT.sprint : FOOT.run;
  const targetX = (moveX / len) * speed * (moving ? 1 : 0);
  const targetZ = (moveZ / len) * speed * (moving ? 1 : 0);

  const blend = 1 - Math.pow(0.0008, dt);
  player.vel.x += (targetX - player.vel.x) * blend;
  player.vel.z += (targetZ - player.vel.z) * blend;
  player.speed = Math.hypot(player.vel.x, player.vel.z);

  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  city.resolve(player.pos, FOOT.radius);

  if (command.jump && player.onGround) {
    player.vel.y = FOOT.jump;
    player.onGround = false;
  }
  player.vel.y -= FOOT.gravity * dt;
  player.pos.y += player.vel.y * dt;
  if (player.pos.y <= GROUND_Y) {
    player.pos.y = GROUND_Y;
    player.vel.y = 0;
    player.onGround = true;
  }

  if (player.speed > 0.4) {
    const targetYaw = Math.atan2(player.vel.x, player.vel.z);
    player.yaw = turnToward(player.yaw, targetYaw, dt * 10);
  } else if (command.aiming) {
    player.yaw = turnToward(player.yaw, cameraYaw + Math.PI, dt * 12);
  }

  player.walkPhase += player.speed * dt * 1.6;
  const stride = Math.min(player.speed / FOOT.sprint, 1);
  const swing = Math.sin(player.walkPhase) * (0.25 + stride * 0.55);
  player.rig.leftLeg.rotation.x = swing;
  player.rig.rightLeg.rotation.x = -swing;
  player.rig.leftArm.rotation.x = -swing * 0.8;
  player.rig.rightArm.rotation.x = swing * 0.6 - (command.aiming ? 1.35 : 0);
  player.rig.leftArm.rotation.z = 0.06;
  player.rig.rightArm.rotation.z = -0.08;
  player.rig.root.position.y = Math.abs(Math.sin(player.walkPhase)) * 0.045 * stride;

  player.group.position.copy(player.pos);
  player.group.rotation.y = player.yaw;
}

export function playerMuzzle(player) {
  const out = new THREE.Vector3(0, 1.45, 0.55);
  return out.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw).add(player.pos).setY(player.pos.y + 1.45);
}

export function damagePlayer(player, amount) {
  if (player.dead) return;
  let left = amount;
  if (player.armour > 0) {
    const soak = Math.min(player.armour, left * 0.7);
    player.armour -= soak;
    left -= soak;
  }
  player.health = Math.max(0, player.health - left);
  if (player.health <= 0) player.dead = true;
}

export function healPlayer(player, health, armour = 0) {
  player.health = Math.min(100, player.health + health);
  player.armour = Math.min(100, player.armour + armour);
}

function turnToward(current, target, amount) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(1, amount);
}
