import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { SAOPass } from 'three/examples/jsm/postprocessing/SAOPass';
import { TAARenderPass } from 'three/examples/jsm/postprocessing/TAARenderPass';

export default function initPostProcessing(scene, camera, renderer) {
  const renderPass = new RenderPass(scene, camera);
  renderPass.clear = false;
  renderPass.enabled = false;

  const saoPass = new SAOPass(scene, camera);
  saoPass.enabled = false;

  const taaRenderPass = new TAARenderPass(scene, camera);
  taaRenderPass.unbiased = false;
  taaRenderPass.enabled = false;

  const composer = new EffectComposer(renderer);
  composer.addPass(renderPass);
  composer.addPass(taaRenderPass);

  return {
    renderPass,
    saoPass,
    taaRenderPass,
    composer,
  };
}
