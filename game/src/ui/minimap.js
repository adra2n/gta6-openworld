// Minimap drawn from the city's own roads, with blips and the player.
// The round minimap: a north-up slice of the grid around Nico, with water, beach, roads, the
// objective blip, police, shops and the marina. Drawn into a 2x canvas for crisp lines.

import { PLACES, placeAt } from '../world/city.js';

const VIEW_METRES = 170;

export function drawMinimap(canvas, state, timeMs) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 5;
  const scale = radius / VIEW_METRES;
  const px = state.player.pos.x;
  const pz = state.player.pos.z;
  const sx = (x) => cx + (x - px) * scale;
  const sy = (z) => cy + (z - pz) * scale;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#17606c';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#7c7f78';
  ctx.fillRect(sx(-820), sy(-820), (640 + 820) * scale, (640 + 820) * scale);
  ctx.fillStyle = '#d8c79a';
  ctx.fillRect(sx(496), sy(-820), 144 * scale, 1460 * scale);
  ctx.fillStyle = '#a5a29a';
  ctx.fillRect(sx(-300), sy(520), 940 * scale, 120 * scale);

  // blocks, so the grid reads even between roads
  ctx.fillStyle = 'rgba(52,54,50,.55)';
  for (const bx of state.city.blockCenters ?? []) {
    ctx.fillRect(sx(bx.x) - 30 * scale, sy(bx.z) - 30 * scale, 60 * scale, 60 * scale);
  }

  ctx.fillStyle = '#e7ddc0';
  const roadWidth = 16 * scale;
  for (const road of state.city.xRoads) {
    const x = sx(road);
    if (x < -roadWidth || x > size + roadWidth) continue;
    ctx.fillRect(x - roadWidth / 2, 0, roadWidth, size);
  }
  for (const road of state.city.zRoads) {
    const y = sy(road);
    if (y < -roadWidth || y > size + roadWidth) continue;
    ctx.fillRect(0, y - roadWidth / 2, size, roadWidth);
  }

  // coastal glow so the sea edge reads at a glance
  ctx.strokeStyle = 'rgba(240,250,245,.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx(496), sy(-820));
  ctx.lineTo(sx(496), sy(640));
  ctx.lineTo(sx(-820), sy(640));
  ctx.stroke();

  function blip(x, z, color, radiusPx = 6, ring = false) {
    const bx = sx(x);
    const by = sy(z);
    ctx.beginPath();
    ctx.fillStyle = color;
    if (ring) {
      ctx.arc(bx, by, radiusPx * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `${color}55`;
      ctx.fill();
      ctx.beginPath();
    }
    ctx.arc(bx, by, radiusPx, 0, Math.PI * 2);
    ctx.fill();
  }

  const pulse = 1 + Math.sin(timeMs / 260) * 0.25;
  if (state.missionBlip) blip(state.missionBlip.x, state.missionBlip.z, '#ffd35c', 6 * pulse, true);
  for (const [key, color, size] of [['shop', '#64d2ff', 4.5], ['garage', '#9b8bff', 4.5], ['hospital', '#f4f1e8', 4.5], ['marina', '#8ff0a4', 5.5]]) {
    const place = placeAt(PLACES[key]);
    blip(place.x, place.z, color, size);
  }

  for (const unit of state.police?.units ?? []) {
    if (!unit.alive) continue;
    if (unit.vehicle) blip(unit.vehicle.pos.x, unit.vehicle.pos.z, '#ff4d5e', 5.5);
    else blip(unit.pos.x, unit.pos.z, '#ff8a95', 4);
  }

  // player arrow, pointing where Nico faces
  const dx = Math.sin(state.player.yaw);
  const dy = Math.cos(state.player.yaw);
  const perpX = -dy;
  const perpY = dx;
  ctx.fillStyle = '#fff8e6';
  ctx.beginPath();
  ctx.moveTo(cx + dx * 11, cy + dy * 11);
  ctx.lineTo(cx + perpX * 6 - dx * 5, cy + perpY * 6 - dy * 5);
  ctx.lineTo(cx - perpX * 6 - dx * 5, cy - perpY * 6 - dy * 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.strokeStyle = 'rgba(10,12,14,.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
}
