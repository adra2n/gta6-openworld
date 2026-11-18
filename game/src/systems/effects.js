// Short-lived visual feedback: smoke off a wrecked car, sparks off a wall, dust under a
// landing, and tracers that show where every bullet went.

import * as THREE from 'three';

function makePuffTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function createEffects(scene) {
  const texture = makePuffTexture();
  const puffs = [];
  for (let i = 0; i < 110; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 }));
    sprite.visible = false;
    scene.add(sprite);
    puffs.push({ sprite, life: 0, max: 1, rise: 1, size: 1, drift: new THREE.Vector3() });
  }

  const tracers = [];
  for (let i = 0; i < 24; i++) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const material = new THREE.LineBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0, toneMapped: false });
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let puffCursor = 0;
  let tracerCursor = 0;

  function spawnPuff(pos, { color = 0xcfcfcf, size = 1.2, life = 0.9, rise = 1.4, opacity = 0.6 } = {}) {
    const p = puffs[puffCursor++ % puffs.length];
    p.sprite.position.copy(pos);
    p.sprite.material.color.setHex(color);
    p.sprite.material.opacity = opacity;
    p.sprite.scale.setScalar(size);
    p.sprite.visible = true;
    p.life = life;
    p.max = life;
    p.rise = rise;
    p.size = size;
    p.drift.set((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 1.2);
  }

  return {
    smoke(pos, strength = 1) { spawnPuff(pos, { color: 0x5a5552, size: 1.4 * strength, life: 1.3 + strength * 0.4, rise: 1.7 + strength, opacity: 0.45 }); },
    dust(pos) { spawnPuff(pos, { color: 0xd9c9a6, size: 0.9, life: 0.6, rise: 0.5, opacity: 0.4 }); },
    spark(pos) { spawnPuff(pos, { color: 0xffd27a, size: 0.45, life: 0.22, rise: 0.6, opacity: 0.9 }); },
    blood(pos) { spawnPuff(pos, { color: 0xb03030, size: 0.5, life: 0.35, rise: 0.2, opacity: 0.7 }); },
    splash(pos) { spawnPuff(pos, { color: 0xd8f4f4, size: 0.7, life: 0.45, rise: 0.4, opacity: 0.5 }); },
    tracer(from, to, color = 0xffe6a8) {
      const t = tracers[tracerCursor++ % tracers.length];
      const pos = t.line.geometry.attributes.position;
      pos.setXYZ(0, from.x, from.y, from.z);
      pos.setXYZ(1, to.x, to.y, to.z);
      pos.needsUpdate = true;
      t.line.material.color.setHex(color);
      t.line.material.opacity = 0.9;
      t.line.visible = true;
      t.life = 0.09;
    },
    update(dt) {
      for (const p of puffs) {
        if (!p.sprite.visible) continue;
        p.life -= dt;
        if (p.life <= 0) { p.sprite.visible = false; continue; }
        const k = p.life / p.max;
        p.sprite.position.y += p.rise * dt;
        p.sprite.position.x += p.drift.x * dt;
        p.sprite.position.z += p.drift.z * dt;
        p.sprite.material.opacity = k * 0.55;
        p.sprite.scale.setScalar(p.size * (1.6 - k * 0.6));
      }
      for (const t of tracers) {
        if (!t.line.visible) continue;
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
        if (t.life <= 0) t.line.visible = false;
      }
    },
  };
}
