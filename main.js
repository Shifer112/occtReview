import GUI from 'lil-gui';
import * as THREE from 'three';
import initScene from './modules/scene';
import initRenderer from './modules/renderer';
import initCamera from './modules/camera';
import initPostProcessing from './modules/postprocessing';
import initStats from './modules/stats';
import initLight from './modules/light';
import initSpector from './modules/spector';
import onWindowResize from './modules/utils';
import createCutMesh from './modules/cutDemo';

const sceneData = {};

const tessellationOptions = {
  deflection: 1,
  angularDeflection: 1,
};

const animate = () => {
  requestAnimationFrame(animate);
  sceneData.composer.render();
  sceneData.renderer.render(sceneData.scene, sceneData.camera);
  sceneData.controls.update();
  sceneData.stats.update();
};

const onCubemapLoaded = async (cubemap) => {
  const envMap = sceneData.pmremGenerator.fromCubemap(cubemap).texture;
  sceneData.hdrEquirect = envMap;
  cubemap.dispose();
  sceneData.pmremGenerator.dispose();

  sceneData.scene = initScene(sceneData.hdrEquirect);
  sceneData.camera = initCamera(sceneData.renderer);
  sceneData.controls = sceneData.camera.controls;

  initLight(sceneData.scene);
  sceneData.stats = initStats();

  const postProcessing = initPostProcessing(
    sceneData.scene,
    sceneData.camera,
    sceneData.renderer,
  );
  sceneData.renderPass = postProcessing.renderPass;
  sceneData.saoPass = postProcessing.saoPass;
  sceneData.taaRenderPass = postProcessing.taaRenderPass;
  sceneData.composer = postProcessing.composer;

  const gui = new GUI();
  const { stats, runTest, parts } = await createCutMesh(sceneData.scene, tessellationOptions, gui);

  console.log('Parts returned:', parts);
  console.log('Number of parts:', parts.length);

  // Если parts не пуст, добавим первый объект в сцену (хотя он должен быть уже добавлен)
  if (parts.length > 0) {
      console.log('Adding first part to scene explicitly');
      sceneData.scene.add(parts[0]);
  }

  // Проверим сцену еще раз
  console.log('Objects in scene after:', sceneData.scene.children.length);
  sceneData.scene.children.forEach((child, index) => {
      console.log(`Child ${index}:`, child.type, child.position);
  });

  onWindowResize(sceneData);
  animate();
};

const loadTextures = () => {
  const { TextureLoader, CubeTextureLoader } = THREE;
  sceneData.textureLoader = new TextureLoader();
  sceneData.BC = sceneData.textureLoader.load('./resources/textures/T_Wood_01_BC.png');
  sceneData.N = sceneData.textureLoader.load('./resources/textures/T_Wood_01_N.png');
  sceneData.R = sceneData.textureLoader.load('./resources/textures/T_Wood_01_R.png');

  new CubeTextureLoader().load(
    [
      './resources/cubemap/px.jpg',
      './resources/cubemap/nx.jpg',
      './resources/cubemap/py.jpg',
      './resources/cubemap/ny.jpg',
      './resources/cubemap/pz.jpg',
      './resources/cubemap/nz.jpg',
    ],
    onCubemapLoaded,
  );
};

const init = () => {
  sceneData.renderer = initRenderer();
  document.body.appendChild(sceneData.renderer.domElement);

  sceneData.pmremGenerator = new THREE.PMREMGenerator(sceneData.renderer);
  sceneData.pmremGenerator.compileEquirectangularShader();

  initSpector();

  window.addEventListener('resize', () => onWindowResize(sceneData));
  loadTextures();
};

init();