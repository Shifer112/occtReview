import * as THREE from 'three';

export default function initScene(hdrEquirect) {
  const scene = new THREE.Scene();

  scene.background = new THREE.Color(0x333333);
  scene.environment = hdrEquirect;

  return scene;
}
