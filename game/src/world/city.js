// City: buildCity raises the grid, blocks and landmarks; PLACES and placeAt locate mission spots.
// Costa Vega, built from data: a 1.1 km grid of roads, sidewalks and blocks that changes
// character from the downtown towers through the art-deco hotel strip to the docks, plus the
// beach, the pier, the bridge and the wheel that give the skyline its landmarks.
//
// Every building is merged into two meshes (textured facades, flat props) so the whole city
// draws in a handful of calls; palms, umbrellas and lamps are instanced.

import * as THREE from 'three';
import { CITY, PALETTE } from '../config.js';
import { makeFacadeTexture, makeNeonSign } from './textures.js';

const CENTERS = [];
for (let k = 0; k <= 12; k++) CENTERS.push(CITY.roadsMin + 40 + k * CITY.pitch);
const ROADS = [];
for (let v = CITY.roadsMin; v <= CITY.roadsMax; v += CITY.pitch) ROADS.push(v);

// Buildings sit on the block centre; `front` is the pavement outside their door, which is where
// markers and interaction radii have to point — the centre itself is inside the collision box.
export const PLACES = {
  marina:   { x: -360, z: 440, label: "Rosa's Marina" },
  shop:     { x: -40,  z: 40,  label: 'Vega Pawn & Ammo', front: { x: -40, z: 58 } },
  hotel:    { x: 440,  z: -40, label: 'Hotel Laguna' },
  docks:    { x: 200,  z: 470, label: 'Vega Docks' },
  garage:   { x: 120,  z: 200, label: 'Manta Motors', front: { x: 120, z: 217 } },
  pier:     { x: 596,  z: -300, label: 'Paloma Pier' },
  hospital: { x: 120,  z: -280, label: 'Bay Hospital', front: { x: 120, z: -261 } },
  station:  { x: -240, z: -120, label: 'CVE Station', front: { x: -240, z: -100 } },
};

/** The walkable point of a place: its doorstep when the building covers the centre. */
export function placeAt(place) {
  return place.front ?? place;
}

const NEON_NAMES = ['LAGUNA', 'SOL', 'CASA BAHIA', 'DINER', 'PAWN', 'MARINA', 'TIDES', 'MOTEL'];

/** Accumulates boxes with per-face UVs into one buffer geometry: the whole city is a few meshes. */
class GeoBuilder {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.uv = [];
    this.col = [];
  }

  box(x, y0, z, w, h, d, color, opts = {}) {
    const rot = opts.rotY || 0;
    const uvScale = opts.uv ?? 0.16;
    const c = new THREE.Color(color);
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;
    const cy = y0 + hh;
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const faces = [
      { n: [1, 0, 0], p: [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]], uw: d, uh: h },
      { n: [-1, 0, 0], p: [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]], uw: d, uh: h },
      { n: [0, 1, 0], p: [[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]], uw: w, uh: d },
      { n: [0, -1, 0], p: [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]], uw: w, uh: d },
      { n: [0, 0, 1], p: [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]], uw: w, uh: h },
      { n: [0, 0, -1], p: [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]], uw: w, uh: h },
    ];
    for (const f of faces) {
      const nx = f.n[0] * cr + f.n[2] * sr;
      const nz = -f.n[0] * sr + f.n[2] * cr;
      const quad = f.p.map(([lx, ly, lz]) => [x + lx * cr + lz * sr, cy + ly, z - lx * sr + lz * cr]);
      const uvs = [[0, 0], [f.uw * uvScale, 0], [f.uw * uvScale, f.uh * uvScale], [0, f.uh * uvScale]];
      for (const tri of [[0, 1, 2], [0, 2, 3]]) {
        for (const i of tri) {
          this.pos.push(...quad[i]);
          this.norm.push(nx, f.n[1], nz);
          this.uv.push(...uvs[i]);
          this.col.push(c.r, c.g, c.b);
        }
      }
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

function mergeMesh(builder, material) {
  const mesh = new THREE.Mesh(builder.build(), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

export function buildCity(scene, rng) {
  pendingSigns.length = 0;
  const group = new THREE.Group();
  group.name = 'CostaVega';
  scene.add(group);

  const buildings = new GeoBuilder();
  const props = new GeoBuilder();
  const ground = new GeoBuilder();
  const glow = new GeoBuilder();
  const colliders = [];
  const pedLoops = [];
  const parking = [];
  const palmSpots = [];
  const umbrellaSpots = [];
  const lampSpots = [];
  const obstacles = [];

  const facade = makeFacadeTexture();
  facade.repeat.set(1, 1);

  // ---------- land, water, beach, quay ----------
  const land = new THREE.Mesh(
    new THREE.BoxGeometry(1460, 4, 1460),
    new THREE.MeshStandardMaterial({ color: 0xb3a888, roughness: 1 }),
  );
  land.position.set(-90, -2.02, -90);
  land.receiveShadow = true;
  group.add(land);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(5000, 5000),
    new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.18, metalness: 0.25 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = CITY.waterY;
  group.add(water);

  ground.box(566, 0.02, -92, 148, 0.12, 1460, PALETTE.sand, { uv: 0.05 });
  ground.box(628, 0.06, -92, 16, 0.06, 1460, 0xe0c690, { uv: 0.05 });
  ground.box(170, 0.04, 580, 940, 0.2, 120, 0xa9a49a, { uv: 0.02 });
  ground.box(200, 0.05, 636, 880, 0.3, 10, 0x8f8a80, { uv: 0.02 });

  // ---------- roads ----------
  for (const x of ROADS) ground.box(x, 0.14, -40, CITY.roadWidth, 0.05, ROADS.length * CITY.pitch + 16, PALETTE.asphalt, { uv: 0.1 });
  for (const z of ROADS) ground.box(-40, 0.14, z, ROADS.length * CITY.pitch + 16, 0.05, CITY.roadWidth, PALETTE.asphalt, { uv: 0.1 });
  for (const x of ROADS) {
    for (let z = -552; z <= 472; z += 16) ground.box(x, 0.2, z, 0.28, 0.02, 7, 0xf0dfa8, { uv: 0 });
  }
  for (const z of ROADS) {
    for (let x = -552; x <= 472; x += 16) ground.box(x, 0.2, z, 7, 0.02, 0.28, 0xf0dfa8, { uv: 0 });
  }

  // Sidewalk slabs under each block.
  for (const bx of CENTERS) {
    for (const bz of CENTERS) {
      ground.box(bx, 0.19, bz, 64, 0.1, 64, PALETTE.sidewalk, { uv: 0.08 });
    }
  }

  // ---------- block fill ----------
  const specials = new Set([
    key(PLACES.hotel), key(PLACES.shop), key(PLACES.garage), key(PLACES.station),
    key(PLACES.hospital), key(PLACES.marina), '-40,-40',
  ]);
  const parks = new Set(['-360,120', '120,280', '-280,-120', '-40,200', '360,-120']);
  let blockIndex = 0;
  for (const bx of CENTERS) {
    for (const bz of CENTERS) {
      const id = key({ x: bx, z: bz });
      if (specials.has(id)) continue;
      blockIndex++;
      const industrial = bz >= 320;
      const beachside = bx >= 280;
      const downtown = Math.abs(bx) <= 200 && Math.abs(bz) <= 240;
      if (parks.has(id)) {
        ground.box(bx, 0.28, bz, 56, 0.12, 56, PALETTE.grass, { uv: 0.06 });
        for (let k = 0; k < 7; k++) palmSpots.push({ x: bx + rng.range(-24, 24), z: bz + rng.range(-24, 24), s: rng.range(0.8, 1.2) });
        pedLoops.push(loopAround(bx, bz));
        continue;
      }
      if (industrial) addIndustrial(bx, bz);
      else if (beachside) addHotelBlock(bx, bz, blockIndex);
      else if (downtown) addDowntownBlock(bx, bz, blockIndex);
      else addShopBlock(bx, bz, blockIndex);
      pedLoops.push(loopAround(bx, bz));
    }
  }
  for (const spot of collectParking()) parking.push(spot);

  // ---------- landmark: the special blocks ----------
  buildHotelLaguna();
  buildPawnShop();
  buildGarage();
  buildStation();
  buildHospital();
  buildMarina();
  buildSunspire();
  buildPier();
  buildBeachClub();

  // ---------- beach dressing ----------
  for (let z = -780; z < 620; z += 34) {
    palmSpots.push({ x: 512 + rng.range(0, 14), z: z + rng.range(-6, 6), s: rng.range(0.9, 1.35) });
  }
  for (let k = 0; k < 30; k++) {
    umbrellaSpots.push({ x: rng.range(556, 610), z: rng.range(-760, 600), color: rng.pick([PALETTE.coral, PALETTE.teal, 0xf3c46a, 0xf1e2c3]) });
  }
  // The wheel and the bridge.
  const wheel = buildWheel(572, 150);
  buildBridge();
  buildLighthouse();

  // ---------- street furniture ----------
  for (const x of ROADS) {
    for (const z of ROADS) {
      lampSpots.push({ x: x + 10, z: z + 10 });
      lampSpots.push({ x: x - 10, z: z - 10 });
    }
  }
  buildLamps();
  buildPalms();
  buildUmbrellas();

  // ---------- meshes ----------
  const buildingMesh = mergeMesh(buildings, new THREE.MeshStandardMaterial({ vertexColors: true, map: facade, roughness: 0.82, metalness: 0.04 }));
  group.add(buildingMesh);
  const propMesh = mergeMesh(props, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.08 }));
  group.add(propMesh);
  const groundMesh = mergeMesh(ground, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }));
  groundMesh.castShadow = false;
  group.add(groundMesh);
  group.add(mergeMesh(glow, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));

  const signMeshes = [];
  for (const sign of pendingSigns) {
    group.add(sign.mesh);
    signMeshes.push(sign.mesh);
  }

  // pedestrians and traffic need a walkable rectangle; the beach and quay stay open.
  const bounds = { minX: -800, maxX: CITY.coastEast - 4, minZ: -800, maxZ: CITY.coastSouth - 4 };

  const city = {
    group, buildings: buildingMesh, colliders, bounds, pedLoops, parking, palmSpots,
    xRoads: ROADS, zRoads: ROADS, signs: signMeshes, wheel,
    blockCenters: CENTERS.flatMap((x) => CENTERS.map((z) => ({ x, z }))),
    points: PLACES,
    update(dt) {
      if (wheel) wheel.spin.rotation.z += dt * 0.12;
    },
    resolve(pos, radius) {
      for (const c of colliders) {
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        if (Math.abs(dx) < c.hw + radius && Math.abs(dz) < c.hd + radius) {
          const px = c.hw + radius - Math.abs(dx);
          const pz = c.hd + radius - Math.abs(dz);
          if (px < pz) pos.x += Math.sign(dx || 1) * px;
          else pos.z += Math.sign(dz || 1) * pz;
        }
      }
      pos.x = THREE.MathUtils.clamp(pos.x, bounds.minX, bounds.maxX);
      pos.z = THREE.MathUtils.clamp(pos.z, bounds.minZ, bounds.maxZ);
      return city;
    },
    onBeach(x) { return x > 496; },
    clearSpotNear(x, z, radius = 10) { return !colliders.some((c) => Math.abs(x - c.x) < c.hw + radius && Math.abs(z - c.z) < c.hd + radius); },
  };
  return city;

  // ---------- generators ----------
  function key(p) {
    return `${Math.round(p.x)},${Math.round(p.z)}`;
  }

  function loopAround(x, z) {
    const r = 33;
    return [{ x: x - r, z: z - r }, { x: x + r, z: z - r }, { x: x + r, z: z + r }, { x: x - r, z: z + r }];
  }

  function addBuildingBox(x, z, w, d, floors, color, opts = {}) {
    const h = floors * 3.2;
    buildings.box(x, 0.3, z, w, h, d, color, opts);
    colliders.push({ x, z, hw: w / 2, hd: d / 2, h });
    const roof = opts.roof ?? true;
    if (roof) {
      props.box(x, h + 0.28, z, w * 0.98, 0.5, d * 0.98, 0xf0e6d2, { uv: 0.1 });
      props.box(x + w * 0.2, h + 0.7, z + d * 0.15, w * 0.14, 1.2, d * 0.16, 0xb9b2a5, { uv: 0.1 });
      props.box(x - w * 0.22, h + 0.7, z - d * 0.2, w * 0.1, 1.0, d * 0.1, 0x9aa3a2, { uv: 0.1 });
    }
    return h;
  }

  function addDowntownBlock(x, z) {
    const tower = rng.chance(0.36);
    if (tower) {
      const w = rng.range(26, 34);
      const d = rng.range(26, 34);
      const floors = rng.int(12, 30);
      const h1 = addBuildingBox(x, z, w, d, floors, rng.pick([PALETTE.glass, 0x8fa7b3, 0xcfd6d2, 0xe6ddcc]));
      const w2 = w * 0.72;
      const d2 = d * 0.72;
      buildings.box(x, h1 + 0.6, z, w2, 3.6, d2, 0xdfe6e2, { uv: 0.16 });
      props.box(x, h1 + 4.2, z, w2 * 1.05, 0.4, d2 * 1.05, 0xece3d3, { uv: 0.1 });
      if (rng.chance(0.7)) {
        props.box(x, h1 + 4.4, z, 0.35, rng.range(5, 12), 0.35, 0xd8d3c6, { uv: 0 });
      }
      colliders.push({ x, z, hw: w2 / 2, hd: d2 / 2, h: h1 + 4 });
      return;
    }
    const split = rng.chance(0.5);
    if (split) {
      addBuildingBox(x - 13, z, 24, 52, rng.int(4, 9), rng.pick(PALETTE.creams));
      addBuildingBox(x + 13, z, 24, 52, rng.int(3, 7), rng.pick(PALETTE.pastels));
    } else {
      addBuildingBox(x, z - 12, 52, 24, rng.int(3, 6), rng.pick(PALETTE.creams));
      addBuildingBox(x, z + 13, 52, 22, rng.int(4, 8), rng.pick(PALETTE.pastels));
    }
  }

  function addShopBlock(x, z) {
    const colors = PALETTE.pastels;
    const split = rng.chance(0.55);
    if (split) {
      addBuildingBox(x - 14, z, 24, 50, rng.int(2, 4), rng.pick(colors));
      addBuildingBox(x + 14, z, 24, 50, rng.int(2, 5), rng.pick(PALETTE.creams));
      props.box(x + 14, 3.4, z - 25, 22, 0.35, 4, PALETTE.coral, { uv: 0.1 });
    } else {
      addBuildingBox(x, z - 14, 50, 24, rng.int(2, 4), rng.pick(colors));
      addBuildingBox(x, z + 14, 50, 24, rng.int(3, 5), rng.pick(PALETTE.creams));
    }
    if (rng.chance(0.3)) {
      const sign = rng.pick(NEON_NAMES);
      const signMesh = makeNeonSign(sign, '#ff9b5c', 3.4);
      signMesh.position.set(x + 30, 6.4, z);
      signMesh.rotation.y = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      pendingSigns.push({ mesh: signMesh });
    }
  }

  function addHotelBlock(x, z) {
    const floors = rng.int(4, 8);
    const color = rng.pick([0xf6d7bd, 0xa8d8cd, 0xf5d78a, 0xf1e2c3, 0xefc1b0]);
    const h = addBuildingBox(x, z, 50, 34, floors, color);
    // balcony bands facing the sea and the street
    for (let f = 1; f < floors; f++) {
      props.box(x + 25.6, 0.4 + f * 3.2, z, 1.2, 0.35, 30, 0xfff4e2, { uv: 0.1 });
    }
    props.box(x, h + 0.5, z, 12, 2.6, 8, color, { uv: 0.1 });
    if (rng.chance(0.55)) {
      const sign = makeNeonSign(rng.pick(NEON_NAMES), rng.pick(['#ff5470', '#49e0c2', '#ff7ad9']), 4.2);
      sign.position.set(x + 24, h + 5.4, z);
      sign.rotation.y = -Math.PI / 2;
      pendingSigns.push({ mesh: sign });
    }
    for (let k = 0; k < 3; k++) palmSpots.push({ x: x + rng.range(-24, 24), z: z + rng.range(18, 28), s: rng.range(0.8, 1.1) });
  }

  function addIndustrial(x, z) {
    const floors = rng.int(2, 3);
    const w = rng.range(40, 54);
    addBuildingBox(x, z, w, 34, floors, rng.pick([0xc9c2b2, 0xb7c1b7, 0xd4cabb]), { roof: false });
    const h = floors * 3.2;
    props.box(x, h + 0.35, z, w + 1, 0.6, 36, 0x8f948c, { uv: 0.1 });
    props.box(x - 10, h + 0.9, z, 4, 3.4, 4, 0x9aa39d, { uv: 0.1 });
    props.box(x + 8, h + 0.9, z, 3, 2.4, 3, 0x848c88, { uv: 0.1 });
    if (rng.chance(0.7)) {
      const cols = [0xc65d4a, 0x3f7f96, 0xd7a34b, 0x5d7f5a];
      for (let k = 0; k < 6; k++) {
        const cz = z + 18 + (k % 2) * 3;
        props.box(x - 18 + (k % 3) * 13, 0.3 + Math.floor(k / 3) * 2.6, cz, 6.2, 2.5, 2.5, rng.pick(cols), { uv: 0.2 });
      }
    }
  }

  // ---------- special buildings ----------
  function buildHotelLaguna() {
    const { x, z } = PLACES.hotel;
    const color = 0xf3cdb0;
    const h = addBuildingBox(x, z + 8, 48, 26, 7, color);
    buildings.box(x, h + 0.5, z - 10, 30, 14, 18, 0xf6ddc2, { uv: 0.16 });
    colliders.push({ x, z: z - 10, hw: 15, hd: 9, h: h + 14 });
    for (let f = 1; f < 7; f++) props.box(x - 24.6, f * 3.2, z + 8, 1.4, 0.3, 24, 0xfff4e2, { uv: 0.1 });
    props.box(x, h + 15, z - 10, 32, 0.8, 20, 0xf2e7d5, { uv: 0.1 });
    const sign = makeNeonSign('LAGUNA', '#ff5470', 7.5);
    sign.position.set(x - 15.4, h + 18, z - 10);
    sign.rotation.y = -Math.PI / 2;
    pendingSigns.push({ mesh: sign });
    const sign2 = makeNeonSign('HOTEL', '#49e0c2', 4);
    sign2.position.set(x - 25, 13, z + 8);
    sign2.rotation.y = Math.PI / 2;
    pendingSigns.push({ mesh: sign2 });
    palmSpots.push({ x: x - 22, z: z + 26, s: 1.2 });
    palmSpots.push({ x: x + 22, z: z + 26, s: 1.15 });
    // beach club terrace out on the sand, clear of the coast road
    props.box(x + 78, 0.2, z + 4, 34, 0.3, 44, 0xf7ead2, { uv: 0.05 });
    for (let k = 0; k < 4; k++) props.box(x + 64 + k * 10, 0.5, z + 24, 7, 0.25, 0.6, 0xffffff, { uv: 0.1 });
    umbrellaSpots.push({ x: x + 80, z: z + 2, color: PALETTE.coral });
    umbrellaSpots.push({ x: x + 86, z: z + 16, color: PALETTE.teal });
    umbrellaSpots.push({ x: x + 74, z: z + 30, color: 0xf3c46a });
  }

  function buildPawnShop() {
    const { x, z } = PLACES.shop;
    addBuildingBox(x, z, 46, 32, 2, 0xe8d4b8);
    props.box(x, 6.8, z, 48, 0.7, 34, 0xcbb79b, { uv: 0.1 });
    props.box(x, 3.6, z + 17, 30, 0.3, 4.5, PALETTE.coral, { uv: 0.1 });
    const sign = makeNeonSign('PAWN', '#ffb454', 4);
    sign.position.set(x, 8.6, z + 16.4);
    pendingSigns.push({ mesh: sign });
    const sign2 = makeNeonSign('AMMO', '#49e0c2', 3);
    sign2.position.set(x - 17, 5, z + 16.4);
    pendingSigns.push({ mesh: sign2 });
    // gun-shop counter awning and a car bay for the dealer
    props.box(x + 20, 0.3, z - 8, 8, 0.3, 14, 0x8d8d8d, { uv: 0.1 });
  }

  function buildGarage() {
    const { x, z } = PLACES.garage;
    addBuildingBox(x, z, 48, 30, 2, 0xb9c5c2);
    props.box(x, 6.6, z, 50, 0.6, 32, 0x93a3a0, { uv: 0.1 });
    props.box(x - 12, 3.6, z + 15.8, 20, 3.2, 0.5, 0x2b3432, { uv: 0 });
    const sign = makeNeonSign('MANTA', '#9b8bff', 4.4);
    sign.position.set(x, 8, z + 15.6);
    pendingSigns.push({ mesh: sign });
    props.box(x + 24, 0.3, z + 4, 8, 0.25, 26, 0x5f5f5f, { uv: 0.1 });
  }

  function buildStation() {
    const { x, z } = PLACES.station;
    addBuildingBox(x, z, 50, 34, 3, 0xd9d7cc);
    props.box(x, 9.8, z, 52, 0.7, 36, 0xb6b9b0, { uv: 0.1 });
    const sign = makeNeonSign('CVE', '#64d2ff', 4.4);
    sign.position.set(x, 11.8, z + 17.6);
    pendingSigns.push({ mesh: sign });
    // parking lot with cruisers
    props.box(x, 0.22, z + 28, 52, 0.06, 18, 0x565a5c, { uv: 0.05 });
    for (let k = 0; k < 3; k++) {
      props.box(x - 16 + k * 16, 0.3, z + 28, 7, 0.05, 0.3, 0xf0e6c0, { uv: 0 });
    }
  }

  function buildHospital() {
    const { x, z } = PLACES.hospital;
    addBuildingBox(x, z, 46, 32, 6, 0xf4f1e8);
    props.box(x, 19.5, z, 48, 0.7, 34, 0xdfe3dc, { uv: 0.1 });
    const sign = makeNeonSign('BAY HOSPITAL', '#ff5470', 3.4);
    sign.position.set(x, 6.4, z + 16.4);
    pendingSigns.push({ mesh: sign });
    props.box(x, 2.6, z + 17, 10, 3.2, 3, 0xffffff, { uv: 0.1 });
  }

  function buildMarina() {
    const { x, z } = PLACES.marina;
    addBuildingBox(x, z - 10, 34, 22, 2, 0xf0e0c4);
    props.box(x, 6.8, z - 10, 36, 0.6, 24, 0xd8c4a4, { uv: 0.1 });
    const sign = makeNeonSign('MARINA', '#49e0c2', 4.6);
    sign.position.set(x, 8.4, z + 0.6);
    pendingSigns.push({ mesh: sign });
    // slips and boats along the block's water side
    for (let k = 0; k < 5; k++) {
      const bz = z + 16 + k * 9;
      props.box(x - 26, 0.3, bz, 3, 0.5, 7, 0xd9c9a8, { uv: 0.1 });
      addBoat(x - 18, bz, 0.95, rng.pick([0xf2f4f2, 0xf3c46a, 0xa8d8cd]), Math.PI / 2);
    }
    palmSpots.push({ x: x - 28, z: z + 6, s: 1.1 });
    palmSpots.push({ x: x + 24, z: z + 20, s: 0.95 });
  }

  function buildSunspire() {
    const x = -40;
    const z = -40;
    const h = 108;
    buildings.box(x, 0.3, z, 30, h, 30, PALETTE.glass, { uv: 0.14 });
    colliders.push({ x, z, hw: 15, hd: 15, h });
    for (let f = 1; f < 8; f++) props.box(x, f * 13, z, 31, 0.4, 31, 0xe4e8e4, { uv: 0.1 });
    buildings.box(x, h + 0.3, z, 20, 8, 20, 0xd5dcd8, { uv: 0.14 });
    buildings.box(x, h + 8.3, z, 12, 5, 12, 0xe9eee9, { uv: 0.14 });
    props.box(x, h + 13.3, z, 0.5, 16, 0.5, 0xe8e3d6, { uv: 0 });
    const sign = makeNeonSign('SOLSTICE', '#ffb454', 5);
    sign.position.set(x - 15.4, h - 8, z);
    sign.rotation.y = -Math.PI / 2;
    pendingSigns.push({ mesh: sign });
  }

  function buildPier() {
    const { x, z } = PLACES.pier;
    props.box(x - 16, 0.3, z, 64, 0.5, 18, 0xbfa98a, { uv: 0.08 });
    for (let k = 0; k < 6; k++) props.box(x - 44 + k * 12, -2, z - 10, 1, 4, 1, 0x8b7a63, { uv: 0 });
    for (let k = 0; k < 6; k++) props.box(x - 44 + k * 12, -2, z + 10, 1, 4, 1, 0x8b7a63, { uv: 0 });
    // pier pavilion: the heist venue
    addBuildingBox(x - 18, z, 22, 16, 2, 0xe9dcc2);
    props.box(x - 18, 7, z, 24, 0.5, 18, 0xcfb895, { uv: 0.1 });
    const sign = makeNeonSign('PALOMA PIER', '#ff7ad9', 4.2);
    sign.position.set(x - 4, 9.5, z + 9.4);
    pendingSigns.push({ mesh: sign });
    for (let k = 0; k < 5; k++) lampSpots.push({ x: x - 40 + k * 12, z: z + 8 });
  }

  function buildBeachClub() {
    const x = 560;
    const z = 430;
    props.box(x - 6, 0.2, z, 26, 0.3, 20, 0xf3e6cf, { uv: 0.05 });
    props.box(x - 6, 0.5, z - 8, 22, 3.4, 1, 0xfff6e4, { uv: 0.1 });
    props.box(x - 6, 3.9, z - 6, 26, 0.3, 6, PALETTE.coral, { uv: 0.1 });
    for (let k = 0; k < 4; k++) props.box(x - 16 + k * 7, 0.6, z + 10, 3.4, 0.25, 1.2, 0xffffff, { uv: 0.1 });
    umbrellaSpots.push({ x: x + 6, z: z - 4, color: PALETTE.teal });
    umbrellaSpots.push({ x: x + 10, z: z + 8, color: PALETTE.coral });
  }

  // ---------- decorative builders ----------
  function addBoat(x, z, s, color, rotY = 0) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6 * s, 1.1 * s, 6 * s), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    hull.position.y = 0.4;
    hull.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8 * s, 1.2 * s, 2.4 * s), new THREE.MeshStandardMaterial({ color: 0xf7f2e6, roughness: 0.6 }));
    cabin.position.set(0, 1.3 * s, -0.4 * s);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 4 * s, 5), new THREE.MeshStandardMaterial({ color: 0xdad5c8 }));
    mast.position.set(0, 3 * s, 0.6 * s);
    g.add(hull, cabin, mast);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(g);
  }

  function buildWheel(x, z) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = Math.PI / 2;
    const spin = new THREE.Group();
    spin.position.y = 20;
    root.add(spin);
    const steel = new THREE.MeshStandardMaterial({ color: 0xe9e4d6, roughness: 0.5, metalness: 0.3 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(17, 0.42, 8, 40), steel);
    ring.castShadow = true;
    spin.add(ring);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(15.4, 0.18, 6, 40), steel);
    spin.add(inner);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2), new THREE.MeshStandardMaterial({ color: k % 3 === 0 ? 0xff5470 : k % 3 === 1 ? 0x49e0c2 : 0xffb454, roughness: 0.55 }));
      cabin.position.set(Math.cos(a) * 17, Math.sin(a) * 17, 0);
      spin.add(cabin);
    }
    // A-frame legs
    for (const side of [-1, 1]) {
      for (const lean of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 23, 0.7), steel);
        leg.position.set(lean * 4.5, 11.5, side * 0.4);
        leg.rotation.z = lean * -0.2;
        leg.castShadow = true;
        root.add(leg);
      }
    }
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 8), steel);
    axle.rotation.x = Math.PI / 2;
    axle.position.y = 20;
    root.add(axle);
    group.add(root);
    return { root, spin };
  }

  function buildBridge() {
    const z = -462;
    props.box(818, 8.2, z, 364, 1.2, 15, 0xcfc6b2, { uv: 0.05 });
    props.box(818, 9.4, z - 7.2, 364, 1.3, 0.5, 0xf1e8d3, { uv: 0.1 });
    props.box(818, 9.4, z + 7.2, 364, 1.3, 0.5, 0xf1e8d3, { uv: 0.1 });
    for (let k = 0; k < 6; k++) {
      props.box(670 + k * 56, -1.5, z, 4, 10, 4, 0xb8ad96, { uv: 0.1 });
    }
    for (const tx of [760, 900]) {
      props.box(tx, 8.2, z - 8, 3, 34, 3, 0xd8cdb6, { uv: 0.1 });
      props.box(tx, 8.2, z + 8, 3, 34, 3, 0xd8cdb6, { uv: 0.1 });
      props.box(tx, 40.6, z, 3, 2.4, 19, 0xe7ddc8, { uv: 0.1 });
    }
    const cableMat = new THREE.LineBasicMaterial({ color: 0x5e564c });
    for (const side of [-1, 1]) {
      for (const span of [0, 1]) {
        const pts = [];
        const startX = span === 0 ? 650 : 900;
        const endX = span === 0 ? 900 : 986;
        for (let k = 0; k <= 12; k++) {
          const t = k / 12;
          const x = startX + (endX - startX) * t;
          const y = 38 - Math.sin(t * Math.PI) * 8 + 2;
          pts.push(new THREE.Vector3(x, y, z + side * 8));
        }
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat));
      }
    }
  }

  function buildLighthouse() {
    const island = new THREE.Mesh(new THREE.CylinderGeometry(66, 78, 5, 20), new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }));
    island.position.set(980, -2.5, -462);
    island.receiveShadow = true;
    group.add(island);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 5, 26, 10), new THREE.MeshStandardMaterial({ color: 0xf4f1e6, roughness: 0.8 }));
    tower.position.set(960, 14, -462);
    tower.castShadow = true;
    group.add(tower);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 4, 10), new THREE.MeshStandardMaterial({ color: PALETTE.coral, roughness: 0.8 }));
    band.position.set(960, 18, -462);
    group.add(band);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(4.2, 4, 10), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 }));
    cap.position.set(960, 30, -462);
    group.add(cap);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.6), new THREE.MeshBasicMaterial({ color: 0xfff2bc, toneMapped: false }));
    lamp.position.set(960, 27, -462);
    group.add(lamp);
  }

  // ---------- instanced trees / umbrellas / lamps ----------
  function buildPalms() {
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.36, 8, 5);
    trunkGeo.translate(0, 4, 0);
    const frondGeo = new THREE.ConeGeometry(0.62, 5.2, 4);
    frondGeo.translate(0, 2.6, 0);
    frondGeo.scale(1, 1, 0.22);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x9a8262, roughness: 0.95 });
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x4f8f4a, roughness: 0.9, side: THREE.DoubleSide });
    const count = palmSpots.length;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const fronds = new THREE.InstancedMesh(frondGeo, frondMat, count * 7);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    palmSpots.forEach((p, i) => {
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0, (i * 1.7) % 6.28, Math.sin(i * 2.1) * 0.08);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      for (let f = 0; f < 7; f++) {
        const a = (f / 7) * Math.PI * 2 + i;
        dummy.position.set(p.x, 7.6 * p.s, p.z);
        dummy.rotation.set(Math.cos(a) * 1.15, a, Math.sin(a) * 0.3);
        dummy.scale.set(p.s, p.s, p.s);
        dummy.updateMatrix();
        fronds.setMatrixAt(i * 7 + f, dummy.matrix);
        color.setHSL(0.27 + (f % 3) * 0.015, 0.4, 0.28 + (f % 2) * 0.04);
        fronds.setColorAt(i * 7 + f, color);
      }
    });
    trunks.castShadow = true;
    fronds.castShadow = true;
    if (fronds.instanceColor) fronds.instanceColor.needsUpdate = true;
    group.add(trunks, fronds);
  }

  function buildUmbrellas() {
    const canopyGeo = new THREE.ConeGeometry(2, 0.75, 8);
    canopyGeo.translate(0, 2.5, 0);
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.4, 4);
    poleGeo.translate(0, 1.2, 0);
    const canopies = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide }), umbrellaSpots.length);
    const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0xe6e0d0 }), umbrellaSpots.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    umbrellaSpots.forEach((u, i) => {
      dummy.position.set(u.x, 0.1, u.z);
      dummy.rotation.set(0, i * 0.7, 0.1);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      canopies.setMatrixAt(i, dummy.matrix);
      canopies.setColorAt(i, color.setHex(u.color));
      poles.setMatrixAt(i, dummy.matrix);
    });
    canopies.castShadow = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    group.add(canopies, poles);
  }

  function buildLamps() {
    for (const l of lampSpots) {
      props.box(l.x, 0.3, l.z, 0.22, 7.4, 0.22, 0x6c6f6a, { uv: 0 });
      props.box(l.x + 0.8, 7.3, l.z, 1.8, 0.18, 0.18, 0x6c6f6a, { uv: 0 });
      glow.box(l.x + 1.6, 7.05, l.z, 0.9, 0.22, 0.5, 0xffe6b0, { uv: 0 });
    }
  }

  function collectParking() {
    const spots = [];
    const lanes = [478, 398, 318, 238, 158, 78, -2, -82, -162, -242, -322, -402, -482, -562];
    for (const z of [-350, -190, -30, 130, 290, 420]) {
      spots.push({ x: 474, z, yaw: 0 });
    }
    for (const x of lanes) {
      if (x === 474) continue;
      if (Math.abs(x) > 500) continue;
      spots.push({ x, z: 466, yaw: Math.PI / 2 });
    }
    for (const x of [-440, -280, -120, 40, 200, 360, 440]) {
      spots.push({ x: x + 24, z: -474, yaw: -Math.PI / 2 });
    }
    return spots;
  }
}

const pendingSigns = [];
