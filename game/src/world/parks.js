// Parks: createParks(scene, rng, city) takes three of the city's open blocks and dresses them as
// small parks — mown grass, a path cross, low hedges, benches, a stone fountain with rippling
// water and a few trees whose foliage sways. Flat colours only, everything under one group.

import * as THREE from 'three';

const PARK_Y = 0.45;
const BENCHES = 4;
const TREES = 3;
const FALLBACK_BLOCKS = [
  { x: -360, z: 120 },
  { x: 120, z: 280 },
  { x: -280, z: -120 },
];

/** Blocks with no building on them are the parks the city generator left open. */
function chooseBlocks(city) {
  const centres = city?.blockCenters ?? city?.blocks ?? [];
  const clear = (block) => (typeof city?.clearSpotNear === 'function' ? city.clearSpotNear(block.x, block.z, 6) : true);
  const open = centres.filter((block) => Number.isFinite(block.x) && Number.isFinite(block.z) && clear(block));
  return open.length >= 3 ? open.slice(0, 3) : FALLBACK_BLOCKS;
}

export function createParks(scene, rng, city) {
  const group = new THREE.Group();
  group.name = 'Parks';
  scene.add(group);

  const blocks = chooseBlocks(city);
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const dummy = new THREE.Object3D();

  function place(mesh, index, x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }

  // ---------- grass and the path cross ----------
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x7cab62, roughness: 1 });
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xd8c7a2, roughness: 0.95 });

  function slab(x, z, w, h, d, y, material) {
    const mesh = new THREE.Mesh(boxGeometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  for (const park of blocks) {
    slab(park.x, park.z, 46, 0.05, 46, 0.425, grassMat);
    slab(park.x, park.z, 40, 0.04, 4.6, 0.47, pathMat);
    slab(park.x, park.z, 4.6, 0.04, 40, 0.47, pathMat);
  }

  // ---------- hedges, benches and trees, gathered first so each is one instanced mesh ----------
  const hedgeSpots = [];
  const benchSpots = [];
  const treeSpots = [];

  blocks.forEach((park, index) => {
    for (const side of [-1, 1]) {
      hedgeSpots.push({ x: park.x + side * 22.6, z: park.z, sx: 1.5, sz: 46, height: rng.range(0.7, 1.0) });
      hedgeSpots.push({ x: park.x, z: park.z + side * 22.6, sx: 46, sz: 1.5, height: rng.range(0.7, 1.0) });
    }
    for (let bench = 0; bench < BENCHES; bench++) {
      const angle = Math.PI / 4 + (bench / BENCHES) * Math.PI * 2;
      const x = park.x + Math.cos(angle) * 10.5;
      const z = park.z + Math.sin(angle) * 10.5;
      benchSpots.push({ x, z, yaw: Math.atan2(park.x - x, park.z - z) });
    }
    for (let tree = 0; tree < TREES; tree++) {
      const angle = index * 0.9 + (tree / TREES) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const radius = rng.range(13, 17);
      treeSpots.push({
        x: park.x + Math.cos(angle) * radius,
        z: park.z + Math.sin(angle) * radius,
        scale: rng.range(0.85, 1.15),
      });
    }
  });

  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x3f7a45, roughness: 0.95, flatShading: true });
  const hedges = new THREE.InstancedMesh(boxGeometry, hedgeMat, hedgeSpots.length);
  hedgeSpots.forEach((spot, index) => place(hedges, index, spot.x, PARK_Y + spot.height / 2, spot.z, 0, spot.sx, spot.height, spot.sz));
  hedges.castShadow = true;
  hedges.receiveShadow = true;
  group.add(hedges);

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9c6b45, roughness: 0.85 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x4f5754, roughness: 0.7, metalness: 0.25 });
  const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.14, 0.55), woodMat, benchSpots.length);
  const backs = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.55, 0.1), woodMat, benchSpots.length);
  const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.45, 0.5), ironMat, benchSpots.length * 2);

  function benchPart(mesh, index, spot, ox, oy, oz) {
    const c = Math.cos(spot.yaw);
    const s = Math.sin(spot.yaw);
    place(mesh, index, spot.x + ox * c + oz * s, PARK_Y + oy, spot.z - ox * s + oz * c, spot.yaw);
  }

  benchSpots.forEach((spot, index) => {
    benchPart(seats, index, spot, 0, 0.5, 0);
    benchPart(backs, index, spot, 0, 0.82, -0.26);
    benchPart(legs, index * 2, spot, -0.72, 0.225, 0);
    benchPart(legs, index * 2 + 1, spot, 0.72, 0.225, 0);
  });
  for (const mesh of [seats, backs, legs]) {
    mesh.castShadow = true;
    group.add(mesh);
  }

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b6f4e, roughness: 0.95 });
  const trunkGeometry = new THREE.CylinderGeometry(0.22, 0.34, 3.6, 7);
  trunkGeometry.translate(0, 1.8, 0);
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMat, treeSpots.length);
  treeSpots.forEach((spot, index) => place(trunks, index, spot.x, PARK_Y, spot.z, 0, spot.scale, spot.scale, spot.scale));
  trunks.castShadow = true;
  group.add(trunks);

  const leafGeometry = new THREE.IcosahedronGeometry(1, 1);
  const leafMats = [0x4f8f4a, 0x5c9b52, 0x457f3f].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }),
  );
  const trees = [];
  treeSpots.forEach((spot, index) => {
    const pivot = new THREE.Group();
    pivot.position.set(spot.x, PARK_Y + 3.4 * spot.scale, spot.z);
    const material = leafMats[index % leafMats.length];
    const lower = new THREE.Mesh(leafGeometry, material);
    lower.scale.set(1.9 * spot.scale, 1.4 * spot.scale, 1.9 * spot.scale);
    lower.position.y = 0.5 * spot.scale;
    lower.castShadow = true;
    const upper = new THREE.Mesh(leafGeometry, material);
    upper.scale.setScalar(1.15 * spot.scale);
    upper.position.set(0.55 * spot.scale, 1.75 * spot.scale, 0.3 * spot.scale);
    upper.castShadow = true;
    pivot.add(lower, upper);
    group.add(pivot);
    trees.push({ pivot, phase: rng.range(0, Math.PI * 2) });
  });

  // ---------- fountains ----------
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcfc4ad, roughness: 0.9 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x4fb3c4, roughness: 0.25, metalness: 0.15, transparent: true, opacity: 0.85 });
  const jetMat = new THREE.MeshBasicMaterial({ color: 0xcdf2f0, transparent: true, opacity: 0.55, toneMapped: false });
  const basinGeometry = new THREE.CylinderGeometry(4.6, 5.0, 0.8, 20);
  const rimGeometry = new THREE.TorusGeometry(4.6, 0.16, 6, 24);
  const waterGeometry = new THREE.CylinderGeometry(4.35, 4.35, 0.08, 20);
  const columnGeometry = new THREE.CylinderGeometry(0.5, 0.72, 2.2, 10);
  const bowlGeometry = new THREE.CylinderGeometry(1.7, 1.25, 0.3, 14);
  const jetGeometry = new THREE.CylinderGeometry(0.08, 0.16, 1.6, 8);
  jetGeometry.translate(0, 0.8, 0);
  const rippleGeometry = new THREE.RingGeometry(0.9, 1.06, 26);
  const fountains = [];

  for (const park of blocks) {
    const root = new THREE.Group();
    root.position.set(park.x, PARK_Y, park.z);
    const basin = new THREE.Mesh(basinGeometry, stoneMat);
    basin.position.y = 0.4;
    basin.castShadow = basin.receiveShadow = true;
    const rim = new THREE.Mesh(rimGeometry, stoneMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.78;
    const water = new THREE.Mesh(waterGeometry, waterMat);
    water.position.y = 0.8;
    const column = new THREE.Mesh(columnGeometry, stoneMat);
    column.position.y = 1.9;
    column.castShadow = true;
    const bowl = new THREE.Mesh(bowlGeometry, stoneMat);
    bowl.position.y = 3.1;
    bowl.castShadow = true;
    const jet = new THREE.Mesh(jetGeometry, jetMat);
    jet.position.y = 3.25;
    root.add(basin, rim, water, column, bowl, jet);

    const ripples = [];
    for (let ring = 0; ring < 2; ring++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xd8f6f4, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
      });
      const mesh = new THREE.Mesh(rippleGeometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.86;
      root.add(mesh);
      ripples.push({ mesh, offset: ring * 0.5 });
    }

    group.add(root);
    fountains.push({ water, jet, ripples, phase: rng.range(0, Math.PI * 2) });
    city?.colliders?.push({ x: park.x, z: park.z, hw: 5, hd: 5, h: 3.2 });
  }

  // ---------- animation ----------
  let clock = 0;

  return {
    benches: benchSpots,

    update(dt) {
      clock += dt;
      for (const fountain of fountains) {
        fountain.jet.scale.y = 1 + Math.sin(clock * 2.4 + fountain.phase) * 0.16;
        fountain.water.position.y = 0.8 + Math.sin(clock * 1.6 + fountain.phase) * 0.015;
        for (const ripple of fountain.ripples) {
          const frac = (clock * 0.32 + ripple.offset + fountain.phase) % 1;
          ripple.mesh.scale.setScalar(0.8 + frac * 4.2);
          ripple.mesh.material.opacity = (1 - frac) * 0.45;
        }
      }
      for (const tree of trees) {
        tree.pivot.rotation.z = Math.sin(clock * 1.1 + tree.phase) * 0.055;
        tree.pivot.rotation.x = Math.cos(clock * 0.85 + tree.phase) * 0.035;
      }
    },
  };
}
