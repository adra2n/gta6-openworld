// Economy: createEconomy(scene, city) owns the money side of the street. buy(kind) spends cash on
// armour, ammunition or a repair at the shops; two safehouses can be bought once, pay a small
// income every in-game hour and become the respawn point; payphones start a timed delivery job.

import * as THREE from 'three';
import { SHOP, WEAPONS } from '../config.js';
import { PLACES, placeAt } from '../world/city.js';

const SAFEHOUSES = [
  { id: 'marina-flat', label: 'Marina Flat', x: -330, z: 404, cost: 6000, rate: 180 },
  { id: 'pier-loft', label: 'Pier Loft', x: 606, z: -286, cost: 9000, rate: 260 },
];

const PHONES = [
  { x: -58, z: 64 },
  { x: 136, z: 228 },
  { x: 104, z: -250 },
  { x: 570, z: -272 },
];

const DROPS = [
  { x: -340, z: 420, label: 'the marina' },
  { x: 150, z: 470, label: 'the docks' },
  { x: 430, z: -20, label: 'Hotel Laguna' },
  { x: 586, z: -286, label: 'Paloma Pier' },
];

const PRICE = { armour: SHOP.armourCost, ammo: SHOP.ammoCost, repair: 90 };
const DELIVERY_PAY = 450;
const DELIVERY_TIME = 75;
const HOUR = 60;

export function createEconomy(scene, city) {
  const shopAt = placeAt(PLACES.shop);
  const garageAt = placeAt(PLACES.garage);
  const owned = [];
  const group = new THREE.Group();
  group.name = 'Economy';
  scene.add(group);

  let incomeTotal = 0;
  let hourClock = 0;
  let respawnPoint = null;
  let job = { active: false, time: 0, at: null, reward: 0 };
  let lastState = null;

  // ---------- street furniture the player can walk up to ----------
  const phoneMat = new THREE.MeshStandardMaterial({ color: 0x2b3438, roughness: 0.6, metalness: 0.3 });
  const phoneGlow = new THREE.MeshBasicMaterial({ color: 0x64d2ff, toneMapped: false });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x2f7f7a, roughness: 0.5, metalness: 0.2 });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x49e0c2, side: THREE.DoubleSide, transparent: true, opacity: 0.5, toneMapped: false });

  const phones = [];
  for (const spot of PHONES) {
    if (city && !city.clearSpotNear(spot.x, spot.z, 1.2)) {
      spot.x += 4;
      spot.z += 4;
    }
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.3, 0.7), phoneMat);
    box.position.set(spot.x, 1.15, spot.z);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.06), phoneGlow);
    panel.position.set(spot.x, 1.75, spot.z + 0.38);
    group.add(box, panel);
    phones.push({ ...spot, panel });
  }

  for (const house of SAFEHOUSES) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 0.4), doorMat);
    frame.position.set(house.x, 1.7, house.z - 0.4);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.8, 22), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(house.x, 0.16, house.z);
    group.add(frame, ring);
    house.frame = frame;
    house.ring = ring;
  }

  function near(state, x, z, radius) {
    return Math.hypot(state.player.pos.x - x, state.player.pos.z - z) < radius;
  }

  function spend(state, cost) {
    if (state.money < cost) return false;
    state.money -= cost;
    return true;
  }

  function buyArmour(state) {
    if (state.player.armour >= 100) {
      state.notify?.('The vest is already on.', 'warning');
      return false;
    }
    if (!spend(state, PRICE.armour)) {
      state.notify?.(`Armour is $${PRICE.armour}. Come back with cash.`, 'warning');
      return false;
    }
    state.player.armour = Math.min(100, state.player.armour + 50);
    state.notify?.(`Armour vest — $${PRICE.armour}`, 'cash');
    state.audio?.pickup?.();
    return true;
  }

  function buyAmmo(state) {
    if (!spend(state, PRICE.ammo)) {
      state.notify?.(`Ammunition is $${PRICE.ammo}.`, 'warning');
      return false;
    }
    for (const key of Object.keys(WEAPONS)) {
      const inventory = state.weapons[key];
      if (!inventory) continue;
      if (inventory.mag + inventory.reserve > 0) inventory.reserve += WEAPONS[key].mag * 2;
    }
    if (state.weapons.smg?.reserve === 0 && state.weapons.smg?.mag === 0) state.weapons.smg.reserve = 30;
    state.notify?.(`Ammunition — $${PRICE.ammo}`, 'cash');
    state.audio?.pickup?.();
    return true;
  }

  function buyRepair(state) {
    const car = state.player.inVehicle;
    if (!car) {
      state.notify?.('Drive the car to the garage first.', 'warning');
      return false;
    }
    if (car.health >= car.maxHealth) {
      state.notify?.('Nothing to fix on this one.', 'warning');
      return false;
    }
    if (!spend(state, PRICE.repair)) {
      state.notify?.(`A repair is $${PRICE.repair}.`, 'warning');
      return false;
    }
    car.health = car.maxHealth;
    car.smoke = 0;
    state.notify?.(`Repaired — $${PRICE.repair}`, 'cash');
    state.audio?.pickup?.();
    return true;
  }

  function buySafehouse(state) {
    const house = SAFEHOUSES.find((entry) => !owned.includes(entry.id) && near(state, entry.x, entry.z, 6));
    if (!house) return false;
    if (!spend(state, house.cost)) {
      state.notify?.(`${house.label} costs $${house.cost.toLocaleString('en-US')}.`, 'warning');
      return false;
    }
    owned.push(house.id);
    respawnPoint = { x: house.x, z: house.z, label: house.label };
    house.frame.material = new THREE.MeshBasicMaterial({ color: 0x49e0c2, toneMapped: false });
    state.hud?.bigMessage?.('SAFEHOUSE BOUGHT', `${house.label} · $${house.rate}/hour`, 4);
    state.notify?.(`${house.label} is yours. New respawn point.`, 'mission');
    state.audio?.pickup?.();
    return true;
  }

  function startDelivery(state) {
    if (job.active) {
      state.notify?.('Finish the delivery you already took.', 'warning');
      return false;
    }
    const drop = DROPS[Math.floor(Math.random() * DROPS.length)];
    job = { active: true, time: DELIVERY_TIME, at: drop, reward: DELIVERY_PAY };
    state.notify?.(`Delivery: take the parcel to ${drop.label}. ${DELIVERY_TIME}s.`, 'mission');
    state.audio?.pickup?.();
    return true;
  }

  function buy(kind) {
    const state = lastState;
    if (!state || state.mode !== 'play') return false;
    switch (kind) {
      case 'nearest': {
        if (near(state, shopAt.x, shopAt.z, 7)) {
          return state.player.armour < 100 && state.money >= PRICE.armour ? buyArmour(state) : buyAmmo(state);
        }
        if (near(state, garageAt.x, garageAt.z, 8)) return buyRepair(state);
        if (SAFEHOUSES.some((entry) => !owned.includes(entry.id) && near(state, entry.x, entry.z, 6))) return buySafehouse(state);
        if (PHONES.some((spot) => near(state, spot.x, spot.z, 4.5))) return startDelivery(state);
        return false;
      }
      case 'armour':
        return buyArmour(state);
      case 'ammo':
        return buyAmmo(state);
      case 'repair':
        return buyRepair(state);
      case 'safehouse':
        return buySafehouse(state);
      case 'delivery':
        return startDelivery(state);
      default:
        return false;
    }
  }

  return {
    owned,
    get income() { return incomeTotal; },
    get respawn() { return respawnPoint; },
    get job() { return job; },
    buy,

    update(dt, state) {
      lastState = state;

      // Safehouse income lands once an in-game hour.
      hourClock += dt;
      if (hourClock >= HOUR) {
        hourClock -= HOUR;
        if (owned.length > 0) {
          const pay = SAFEHOUSES.filter((entry) => owned.includes(entry.id)).reduce((sum, entry) => sum + entry.rate, 0);
          state.money += pay;
          incomeTotal += pay;
          state.notify?.(`Safehouse income +$${pay}`, 'cash');
        }
      }

      // The delivery clock only runs while the player is actually in the world.
      if (job.active && state.mode === 'play') {
        job.time -= dt;
        if (job.time <= 0) {
          job.active = false;
          state.notify?.('Delivery late. The parcel went back to the phone.', 'warning');
        } else if (near(state, job.at.x, job.at.z, 9)) {
          state.money += job.reward;
          state.notify?.(`Delivered to ${job.at.label} +$${job.reward}`, 'cash');
          state.hud?.bigMessage?.('DELIVERY DONE', `+$${job.reward}`, 3);
          state.audio?.pickup?.();
          job.active = false;
        }
      }

      // Blinking payphones and safehouse rings read from across the street.
      const blink = Math.sin(performance.now() / 260) > 0;
      for (const spot of phones) spot.panel.visible = job.active ? blink : true;
      for (const house of SAFEHOUSES) {
        if (!house.ring) continue;
        house.ring.scale.setScalar(1 + Math.sin(performance.now() / 500) * 0.06);
        house.ring.visible = !owned.includes(house.id);
      }
    },
  };
}
