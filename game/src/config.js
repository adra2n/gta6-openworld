// Tuning constants shared by the systems.
// Every tunable number the game shares: the city's grid, vehicle handling, weapon ballistics
// and the palette the whole coast is painted from. Modules read from here so the place stays
// one coherent object.

export const CITY = {
  pitch: 80,          // metres between road centre lines
  roadsMin: -560,     // first road on each axis
  roadsMax: 480,      // last road on each axis
  roadWidth: 16,
  sidewalk: 4,
  blockInner: 56,     // building footprint left between sidewalk and kerb
  coastEast: 640,
  coastSouth: 640,
  land: 1600,
  waterY: -1.6,
};

export const PALETTE = {
  sun: 0xfff0cf,
  skyDay: 0x9fd6ef,
  skyDusk: 0x2c2348,
  fogDay: 0xd8e6e2,
  fogDusk: 0x4a3450,
  asphalt: 0x4a4649,
  sidewalk: 0xd9cdb6,
  sand: 0xe8d5a3,
  water: 0x2a8f9c,
  grass: 0x6f9a5b,
  creams: [0xf1e2c3, 0xf6d7bd, 0xf4efe3, 0xe8d9c9],
  pastels: [0xf2b8a2, 0xa8d8cd, 0xf5d78a, 0xc9b6dc, 0x9fc2d8, 0xefc1b0],
  teal: 0x2f7f7a,
  coral: 0xe4604d,
  neon: [0xff5470, 0xffb454, 0x49e0c2, 0xff7ad9, 0x9b8bff],
  glass: 0x6e93a6,
};

export const VEHICLES = {
  sedan:  { name: 'Kestrel 4-door',  maxSpeed: 27, accel: 9,  brake: 18, steer: 1.6, grip: 6.5, health: 120, mass: 1.0, length: 4.5, width: 1.9, height: 1.3 },
  sports: { name: 'Manta GT',        maxSpeed: 39, accel: 15, brake: 20, steer: 1.75, grip: 7.5, health: 90,  mass: 0.85, length: 4.4, width: 2.0, height: 1.05 },
  van:    { name: 'Pelican Van',     maxSpeed: 21, accel: 6,  brake: 14, steer: 1.35, grip: 5.5, health: 180, mass: 1.5, length: 5.4, width: 2.2, height: 2.1 },
  police: { name: 'CVE Interceptor', maxSpeed: 33, accel: 12, brake: 19, steer: 1.8, grip: 7.6, health: 150, mass: 1.1, length: 4.8, width: 2.0, height: 1.4 },
};

export const WEAPONS = {
  pistol:  { name: 'Pistol',  damage: 26, rate: 0.26, spread: 0.010, pellets: 1, range: 90,  mag: 12, sound: 'pistol' },
  smg:     { name: 'SMG',     damage: 15, rate: 0.085, spread: 0.028, pellets: 1, range: 75,  mag: 30, sound: 'smg' },
  shotgun: { name: 'Shotgun', damage: 13, rate: 0.78, spread: 0.055, pellets: 6, range: 45,  mag: 6,  sound: 'shotgun' },
};

export const WANTED = { maxStars: 5, starDecay: 14, searchGrow: 26, bustRadius: 13 };

// Shop prices; every location lives in PLACES in world/city.js so there is one map.
export const SHOP = { armourCost: 250, ammoCost: 120, carCost: 1500 };

export const FOOT = { walk: 3.4, run: 6.0, sprint: 9.2, jump: 6.4, gravity: 22, radius: 0.55 };

// A clear intersection a short walk from the marina, facing Rosa's office.
export const START = { x: -316, z: 396, yaw: -Math.PI / 4 };
