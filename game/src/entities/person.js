// Articulated low-poly bodies and the walk cycle shared by crowd and crew.
// A reusable low-poly person for pedestrians, officers and the Salvage Crew. Same limbs as Nico
// so the walk cycle code is shared; colours set who they are.

import * as THREE from 'three';

const materialCache = new Map();

function material(color) {
  if (!materialCache.has(color)) {
    materialCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  }
  return materialCache.get(color);
}

export function createPerson(colors, armed = false) {
  const { jacket = 0xf2e6cd, shirt = 0x2f7f7a, pants = 0x24262e, skin = 0xb9825e, hair = 0x221a16 } = colors;
  const root = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.68, 0.32), material(jacket));
  torso.position.y = 1.32;
  torso.castShadow = true;
  const shirtFront = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.46, 0.05), material(shirt));
  shirtFront.position.set(0, 1.34, 0.18);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.3), material(pants));
  hips.position.y = 0.94;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.3), material(skin));
  head.position.y = 1.88;
  head.castShadow = true;
  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.32), material(hair));
  hairMesh.position.y = 2.07;
  root.add(torso, shirtFront, hips, head, hairMesh);

  function limb(w, h, d, x, y, mat) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.y = -h / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    root.add(pivot);
    return pivot;
  }

  const leftArm = limb(0.16, 0.62, 0.18, -0.35, 1.6, material(jacket));
  const rightArm = limb(0.16, 0.62, 0.18, 0.35, 1.6, material(jacket));
  const leftLeg = limb(0.2, 0.78, 0.22, -0.14, 0.88, material(pants));
  const rightLeg = limb(0.2, 0.78, 0.22, 0.14, 0.88, material(pants));

  if (armed) {
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.34), new THREE.MeshStandardMaterial({ color: 0x25282b, metalness: 0.6, roughness: 0.4 }));
    gun.position.set(0, -0.52, 0.12);
    rightArm.add(gun);
  }

  return { root, leftArm, rightArm, leftLeg, rightLeg, torso, head, walkPhase: 0 };
}

export function posePerson(rig, speed, dt, aiming = false) {
  rig.walkPhase += speed * dt * 2.1;
  const swing = Math.sin(rig.walkPhase) * Math.min(0.62, 0.16 + speed * 0.09);
  rig.leftLeg.rotation.x = swing;
  rig.rightLeg.rotation.x = -swing;
  rig.leftArm.rotation.x = -swing * 0.85;
  rig.rightArm.rotation.x = swing * 0.55 - (aiming ? 1.4 : 0);
  rig.root.position.y = Math.abs(Math.sin(rig.walkPhase)) * 0.04 * Math.min(1, speed / 3);
}

export function makeBloodColor() {
  return 0x9b2f2f;
}
