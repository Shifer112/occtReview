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
import { createCutMesh } from './modules/cutDemo';

const sceneData = {};

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

  const cutGroup = await createCutMesh();
  sceneData.scene.add(cutGroup);

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