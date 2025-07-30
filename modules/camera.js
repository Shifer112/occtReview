import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export default function initCamera(renderer) {
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100000);
  camera.position.set(0, 50, 150);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  camera.controls = controls;
  controls.enableDamping = true;
  controls.dampingFactor = 0.3;

  return camera;
}
