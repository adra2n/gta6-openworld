// Third-person camera: mouse orbit on foot, a wider chase camera in a car that drifts back
// behind the car when the mouse rests, and a little shake when shots land.

import * as THREE from 'three';

const target = new THREE.Vector3();
const desired = new THREE.Vector3();

export function createView(player) {
  return { yaw: player.yaw + Math.PI, pitch: 0.18, distance: 5.6, restTimer: 0, shake: 0 };
}

export function updateCamera(camera, view, player, mouse, dt, snap = false) {
  const moved = Math.abs(mouse.x) + Math.abs(mouse.y) > 0.01;
  view.yaw -= mouse.x * 0.0026;
  view.pitch = THREE.MathUtils.clamp(view.pitch + mouse.y * 0.0018, -0.35, 0.85);
  if (player.inVehicle) {
    view.restTimer = moved ? 0 : view.restTimer + dt;
    if (view.restTimer > 1.4) {
      const wanted = player.inVehicle.heading + Math.PI;
      let diff = wanted - view.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      view.yaw += diff * Math.min(1, dt * 2.4);
    }
  }

  const inCar = !!player.inVehicle;
  const distance = inCar ? 8.8 : view.distance;
  const height = inCar ? 1.5 : 1.2;
  const horizontal = distance * Math.cos(view.pitch);
  target.set(player.pos.x, player.pos.y + height + 0.4, player.pos.z);
  desired.set(
    target.x + Math.sin(view.yaw) * horizontal,
    target.y + 1.0 + distance * Math.sin(view.pitch),
    target.z + Math.cos(view.yaw) * horizontal,
  );
  if (desired.y < 1.0) desired.y = 1.0;

  if (view.shake > 0) {
    desired.x += (Math.random() - 0.5) * view.shake;
    desired.y += (Math.random() - 0.5) * view.shake;
    view.shake = Math.max(0, view.shake - dt * 2.4);
  }

  camera.position.lerp(desired, snap ? 1 : Math.min(1, dt * 11));
  const ahead = inCar ? 4 : 1.2;
  camera.lookAt(
    target.x - Math.sin(view.yaw) * ahead,
    target.y + (inCar ? 0.3 : 0.5),
    target.z - Math.cos(view.yaw) * ahead,
  );
  const wantedFov = inCar ? 66 : 58;
  camera.fov += (wantedFov - camera.fov) * (snap ? 1 : Math.min(1, dt * 4));
  camera.updateProjectionMatrix();
}
