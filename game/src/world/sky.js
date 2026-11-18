// Sky, sun and fog. One gradient dome plus a warm key light that casts the long shadows the
// coast is known for; the same module swaps the whole palette to dusk without rebuilding.
import * as THREE from 'three';
import { PALETTE } from '../config.js';

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
varying vec3 vDir;
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform vec3 sunColor;
uniform vec3 sunDir;
void main() {
  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 sky = mix(bottomColor, topColor, pow(h, 0.8));
  float glow = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 24.0);
  sky += sunColor * glow * 0.85;
  gl_FragColor = vec4(sky, 1.0);
}`;

const PRESETS = {
  day: {
    top: 0x3f8ec4, bottom: 0xdfe8d8, sun: 0xfff3cf, sunDir: [120, 150, 70],
    fog: 0xd6e3da, fogNear: 260, fogFar: 1500, sunLight: 2.5, hemi: 0.75, ground: 0xb7a98c,
  },
  dusk: {
    top: 0x241a3e, bottom: 0xff9a5c, sun: 0xffc07a, sunDir: [-90, 55, -120],
    fog: 0x7a5260, fogNear: 200, fogFar: 1200, sunLight: 2.6, hemi: 1.15, ground: 0x8a6552,
  },
};

export function createSky(scene) {
  const uniforms = {
    topColor: { value: new THREE.Color(PRESETS.day.top) },
    bottomColor: { value: new THREE.Color(PRESETS.day.bottom) },
    sunColor: { value: new THREE.Color(PRESETS.day.sun) },
    sunDir: { value: new THREE.Vector3(...PRESETS.day.sunDir).normalize() },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2600, 24, 16),
    new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false }),
  );
  dome.frustumCulled = false;
  scene.add(dome);

  const hemi = new THREE.HemisphereLight(0xd9ecff, PRESETS.day.ground, PRESETS.day.hemi);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xb9c4d6, 0.14);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff1d0, PRESETS.day.sunLight);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -150;
  sun.shadow.camera.right = 150;
  sun.shadow.camera.top = 150;
  sun.shadow.camera.bottom = -150;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const fog = new THREE.Fog(PRESETS.day.fog, PRESETS.day.fogNear, PRESETS.day.fogFar);
  scene.fog = fog;

  const offset = new THREE.Vector3();
  let mode = 'day';

  function setTime(next) {
    mode = next === 'dusk' ? 'dusk' : 'day';
    const p = PRESETS[mode];
    uniforms.topColor.value.setHex(p.top);
    uniforms.bottomColor.value.setHex(p.bottom);
    uniforms.sunColor.value.setHex(p.sun);
    uniforms.sunDir.value.set(...p.sunDir).normalize();
    fog.color.setHex(p.fog);
    fog.near = p.fogNear;
    fog.far = p.fogFar;
    sun.color.setHex(mode === 'dusk' ? 0xffb37a : 0xfff1d0);
    sun.intensity = p.sunLight;
    hemi.color.setHex(mode === 'dusk' ? 0x8d7bb8 : 0xd9ecff);
    hemi.groundColor.setHex(p.ground);
    hemi.intensity = p.hemi;
    ambient.color.setHex(mode === 'dusk' ? 0xa990a8 : 0xb9c4d6);
    ambient.intensity = mode === 'dusk' ? 0.62 : 0.14;
    offset.fromArray(p.sunDir).normalize().multiplyScalar(260);
  }

  function follow(target) {
    sun.position.copy(target).add(offset);
    sun.target.position.copy(target);
    sun.target.updateMatrixWorld();
  }

  setTime('day');
  return { dome, sun, hemi, fog, setTime, follow, get mode() { return mode; } };
}
