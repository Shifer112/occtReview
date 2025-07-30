import * as THREE from 'three';

export default function initLight(scene) {
  const ambientLight = new THREE.AmbientLight(0x404040, 1);
  scene.add(ambientLight);
}
