export default function onWindowResize(sceneData) {
  if (!sceneData || !sceneData.camera || !sceneData.renderer) {
    return; 
  }

  const {
    camera, renderer, composer, controls,
  } = sceneData;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  if (controls) {
    controls.update();
  }

  if (composer) {
    composer.setSize(window.innerWidth, window.innerHeight);
  }
}
