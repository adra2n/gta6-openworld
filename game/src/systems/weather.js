// Weather: createWeather(scene, sky) runs five states — clear, overcast, rain, storm, fog — and
// owns the sky's fog, the sun's strength and one Points cloud of rain that follows the player and
// wraps inside a box. A storm slants the rain, flashes a light and calls state.audio.thunder().
// The state changes by itself every two to four minutes; set(kind) forces one.

import * as THREE from 'three';

const DROPS = 1800;
const BOX = 110;
const TOP = 62;
const FLOOR = -4;

const PRESETS = {
  clear: {
    fog: 0xd6e3da, near: 260, far: 1500, rain: 0, wind: 0.4,
    sun: 1, hemi: 1, lightning: 0,
  },
  overcast: {
    fog: 0xbcc5c5, near: 175, far: 940, rain: 0, wind: 1.6,
    sun: 0.46, hemi: 0.92, lightning: 0,
  },
  rain: {
    fog: 0x9dabb0, near: 95, far: 540, rain: 0.75, wind: 3.4,
    sun: 0.3, hemi: 0.8, lightning: 0,
  },
  storm: {
    fog: 0x5e6a74, near: 65, far: 390, rain: 1, wind: 8.5,
    sun: 0.2, hemi: 0.62, lightning: 1,
  },
  fog: {
    fog: 0xd2d8d2, near: 34, far: 225, rain: 0, wind: 0.5,
    sun: 0.44, hemi: 0.9, lightning: 0,
  },
};

const KINDS = Object.keys(PRESETS);

export function createWeather(scene, sky) {
  // The rain is one buffer: x/y/z offsets around the player, wrapped when they leave the box.
  const positions = new Float32Array(DROPS * 3);
  for (let i = 0; i < DROPS; i++) {
    positions[i * 3] = (Math.random() - 0.5) * BOX;
    positions[i * 3 + 1] = FLOOR + Math.random() * (TOP - FLOOR);
    positions[i * 3 + 2] = (Math.random() - 0.5) * BOX;
  }
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const rainMaterial = new THREE.PointsMaterial({
    color: 0xc8d6dd, size: 0.34, transparent: true, opacity: 0, depthWrite: false,
    sizeAttenuation: true, toneMapped: false,
  });
  const rain = new THREE.Points(rainGeometry, rainMaterial);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  // Fog and light come from the sky module; the weather keeps the untouched presets as a base so
  // a forced day/dusk switch still reads through the rain.
  let baseFog = sky.fog.color.clone();
  let baseNear = sky.fog.near;
  let baseFar = sky.fog.far;
  let baseSun = sky.sun.intensity;
  let baseHemi = sky.hemi.intensity;
  let skyMode = sky.mode;

  const current = {
    fog: PRESETS.clear.fog, near: baseNear, far: baseFar, rain: 0, wind: 0.4,
    sun: 1, hemi: 1,
  };
  const fogColor = new THREE.Color(PRESETS.clear.fog);
  const flashColor = new THREE.Color(0xf4f7ff);

  let kind = 'clear';
  let announce = 'clear';
  let changeIn = 120 + Math.random() * 120;
  let lightningIn = 5 + Math.random() * 8;
  let flash = 0;
  let lastState = null;

  function set(next) {
    if (!PRESETS[next] || next === kind) return kind;
    kind = next;
    changeIn = 120 + Math.random() * 120;
    lightningIn = 4 + Math.random() * 7;
    return kind;
  }

  function step(dt) {
    const preset = PRESETS[kind];
    const blend = Math.min(1, dt * 0.85);
    current.near += (preset.near - current.near) * blend;
    current.far += (preset.far - current.far) * blend;
    current.rain += (preset.rain - current.rain) * blend;
    current.wind += (preset.wind - current.wind) * blend;
    current.sun += (preset.sun - current.sun) * blend;
    current.hemi += (preset.hemi - current.hemi) * blend;
    fogColor.lerp(flashColor.setHex(preset.fog), blend);

    if (sky.mode !== skyMode) {
      skyMode = sky.mode;
      baseFog = sky.fog.color.clone();
      baseNear = sky.fog.near;
      baseFar = sky.fog.far;
      baseSun = sky.sun.intensity;
      baseHemi = sky.hemi.intensity;
    }

    sky.fog.color.copy(baseFog).lerp(fogColor, 0.82);
    sky.fog.near = Math.min(baseNear, current.near);
    sky.fog.far = Math.min(baseFar, current.far);
    sky.sun.intensity = baseSun * current.sun;
    sky.hemi.intensity = baseHemi * current.hemi;

    rain.visible = current.rain > 0.03;
    rainMaterial.opacity = 0.5 * current.rain;
    rainMaterial.size = 0.28 + current.rain * 0.12;
  }

  function moveRain(dt, player) {
    const attribute = rainGeometry.attributes.position;
    const fall = (34 + current.rain * 14) * dt;
    const wind = current.wind * 3.2 * dt;
    const half = BOX / 2;
    for (let i = 0; i < DROPS; i++) {
      let x = attribute.getX(i) + wind;
      let y = attribute.getY(i) - fall;
      let z = attribute.getZ(i);
      if (y < FLOOR) y += TOP - FLOOR;
      if (x > half) x -= BOX;
      else if (x < -half) x += BOX;
      if (z > half) z -= BOX;
      else if (z < -half) z += BOX;
      attribute.setXYZ(i, x, y, z);
    }
    attribute.needsUpdate = true;
    rain.position.set(player.x, 0, player.z);
    rain.rotation.z = -current.wind * 0.012;
  }

  function lightning(dt) {
    if (flash > 0) {
      flash = Math.max(0, flash - dt * 5);
      sky.hemi.intensity += flash * 22;
      sky.fog.color.lerp(flashColor.setHex(0xdfe8ff), flash * 0.6);
    }
    if (PRESETS[kind].lightning === 0) return;
    lightningIn -= dt;
    if (lightningIn > 0) return;
    lightningIn = 6 + Math.random() * 10;
    flash = 0.45;
    lastState?.audio?.thunder?.();
  }

  return {
    get kind() { return kind; },
    get intensity() { return current.rain; },
    set,

    update(dt, state) {
      lastState = state;
      const player = state?.player?.pos;
      if (!player) return;

      changeIn -= dt;
      if (changeIn <= 0) {
        const options = KINDS.filter((name) => name !== kind);
        set(options[Math.floor(Math.random() * options.length)]);
      }

      step(dt);
      if (current.rain > 0.02) moveRain(dt, player);
      lightning(dt);

      if (kind !== announce) {
        announce = kind;
        state.notify?.(`Weather turning ${kind}`, 'radio');
        if (kind === 'rain' || kind === 'storm') state.hud?.toast?.(kind === 'storm' ? 'Storm rolling in' : 'Rain on the coast', 2.5);
      }
    },
  };
}
