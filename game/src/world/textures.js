// Canvas-painted surface art: the shared window grid for every building and the glowing
// lettering on the hotel roofs. Everything is generated from code at load, so the game ships
// no image files.
import * as THREE from 'three';

export function makeFacadeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#efe9df';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    for (let x = 0; x < 128; x += 16) {
      g.fillStyle = '#5d7482';
      g.fillRect(x + 3, y + 4, 10, 8);
      g.fillStyle = 'rgba(255,244,205,.35)';
      g.fillRect(x + 3, y + 4, 10, 2);
    }
    g.fillStyle = '#cfc6b6';
    g.fillRect(0, y + 13, 128, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function makeNeonTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, 512, 128);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 82px "Avenir Next Condensed", Arial, sans-serif';
  g.shadowColor = color;
  g.shadowBlur = 26;
  g.fillStyle = color;
  g.fillText(text, 256, 68);
  g.shadowBlur = 10;
  g.fillStyle = '#fff6e8';
  g.font = 'bold 80px "Avenir Next Condensed", Arial, sans-serif';
  g.fillText(text, 256, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A free-standing neon sign board: a dark frame with glowing letters, readable from the street. */
export function makeNeonSign(text, color, height = 6) {
  const width = height * (text.length * 0.42 + 0.6);
  const texture = makeNeonTexture(text, color);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, toneMapped: false }),
  );
  board.userData.isSign = true;
  return board;
}
