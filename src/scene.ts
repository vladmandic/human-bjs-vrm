import * as B from '@babylonjs/core';
import * as M from '@babylonjs/materials';
import '@babylonjs/inspector';

export class Scene {
  engine!: B.Engine;
  canvas!: HTMLCanvasElement;
  scene!: B.Scene;
  materialBone!: M.PBRCustomMaterial;
  materialJoint!: M.PBRCustomMaterial;
  materialHead!: M.PBRCustomMaterial;
  camera!: B.ArcRotateCamera;
  light!: B.DirectionalLight;
  spotlight!: B.SpotLight;
  ambient!: B.HemisphericLight;
  shadows!: B.ShadowGenerator;
  environment!: B.EnvironmentHelper;
  skybox: B.Mesh | undefined;
  ground: B.Mesh | undefined;
  skeleton?: B.Skeleton | undefined;
  highlight: B.HighlightLayer;
  currentMesh: B.Nullable<B.Mesh> = null;
  hoverMesh: B.Nullable<B.Mesh> = null;
  pointerPosition: B.Nullable<B.Vector3> = null;
  initialized = false;

  constructor(outputCanvas: HTMLCanvasElement, cameraRadius: number, introDurationMs: number) {
    this.canvas = outputCanvas;
    // engine & scene
    this.engine = new B.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false, doNotHandleContextLost: true, audioEngine: false });
    this.engine.enableOfflineSupport = false;

    B.Animation.AllowMatricesInterpolation = true;
    this.scene = new B.Scene(this.engine);
    this.scene.clearCachedVertexData();

    this.materialHead = new M.PBRCustomMaterial('head', this.scene);
    this.materialHead.metallic = 1.0;
    this.materialHead.roughness = 0.65;
    this.materialHead.alpha = 1.0;
    this.materialHead.albedoColor = B.Color3.FromHexString('#91ECFF');
    this.materialHead.iridescence.isEnabled = true;
    this.materialHead.backFaceCulling = false;

    this.materialBone = new M.PBRCustomMaterial('bone', this.scene);
    this.materialBone.metallic = 1.0;
    this.materialBone.roughness = 0.4;
    this.materialBone.alpha = 1.0;
    this.materialBone.albedoColor = B.Color3.FromHexString('#B1ECFF');
    this.materialBone.iridescence.isEnabled = true;

    this.materialJoint = new M.PBRCustomMaterial('joint', this.scene);
    this.materialJoint.metallic = 1.0;
    this.materialJoint.roughness = 0.0;
    this.materialJoint.alpha = 0.5;
    this.materialJoint.albedoColor = B.Color3.FromHexString('#FFFFFF');
    this.materialJoint.iridescence.isEnabled = true;

    // this.materialHead.subSurface.isRefractionEnabled = true;
    /*
    this.materialBone = new StandardMaterial('materialBone', this.scene);
    this.materialBone.diffuseColor = new Color3(0.0, 0.6, 0.6);
    this.materialBone.alpha = 1.0;
    this.materialBone.useSpecularOverAlpha = true;
    this.materialJoint = new StandardMaterial('materialJoint', this.scene);
    this.materialJoint.diffuseColor = new Color3(0.2, 0.5, 0.5);
    this.materialJoint.alpha = 0.6;
    this.materialJoint.useSpecularOverAlpha = true;
    this.materialHead = new StandardMaterial('materialHead', this.scene);
    this.materialHead.diffuseColor = new Color3(0.6, 1.0, 1.0);
    */

    this.highlight = new B.HighlightLayer('highlight', this.scene);
    // start scene
    this.engine.runRenderLoop(() => this.scene.render());
    // camera
    if (this.camera) this.camera.dispose();
    this.camera = new B.ArcRotateCamera('camera', 0, 0, cameraRadius, new B.Vector3(0.5, 0.5, 0.5), this.scene);
    this.camera.attachControl(this.canvas, false);
    this.camera.lowerRadiusLimit = 0.001;
    this.camera.upperRadiusLimit = 200;
    this.camera.wheelDeltaPercentage = 0.01;
    this.camera.position = new B.Vector3(0, 2.0, -12);
    this.camera.target = new B.Vector3(0.3, 1, -1); // slightly elevated initial view
    this.camera.alpha = (2 * Math.PI + this.camera.alpha) % (2 * Math.PI); // normalize so its not in negative range
    // environment
    if (this.environment) this.environment.dispose();
    this.environment = this.scene.createDefaultEnvironment({
      environmentTexture: '../assets/scene-environment.env',
      createSkybox: true,
      skyboxTexture: '../assets/scene-skybox.dds',
      skyboxColor: new B.Color3(0.0, 0.0, 0.0),
      skyboxSize: 100,
      createGround: true,
      groundColor: new B.Color3(1.0, 1.0, 1.0),
      groundSize: 10,
      groundShadowLevel: 0.1,
      groundTexture: '../assets/scene-ground.png',
      enableGroundShadow: true,
    }) as B.EnvironmentHelper;
    // lights
    if (this.ambient) this.ambient.dispose();
    this.ambient = new B.HemisphericLight('spheric', new B.Vector3(0, 1, 0), this.scene);
    this.ambient.intensity = 0.5;
    this.ambient.specular = B.Color3.Black();
    if (this.light) this.light.dispose();
    this.light = new B.DirectionalLight('directional', new B.Vector3(0.3, -0.5, 1), this.scene);
    this.light.position = new B.Vector3(2.5, 5, -5);
    this.light.intensity = 0.5;
    if (this.shadows) this.shadows.dispose();
    this.shadows = new B.ShadowGenerator(1024, this.light);
    this.shadows.useBlurExponentialShadowMap = true;
    this.shadows.blurKernel = 8;
    this.shadows.depthScale = 60.0;
    // animate
    if (introDurationMs > 0) this.intro(introDurationMs);
    // @ts-ignore
    window.t = this;
    // this.scene.debugLayer.show();
  }

  intro(ms: number) {
    B.Animation.CreateAndStartAnimation('camera', this.camera, 'fov', 60, 60 * ms / 500, /* start */ 1.0, /* end */ 0.2, /* loop */ 0, new B.BackEase());
    B.Animation.CreateAndStartAnimation('light', this.light, 'direction.x', 60, 60 * ms / 500, /* start */ -0.6, /* end */ 0.3, /* loop */ 0, new B.CircleEase());
    B.Animation.CreateAndStartAnimation('light', this.light, 'direction.y', 60, 60 * ms / 500, /* start */ -0.1, /* end */ -0.5, /* loop */ 0, new B.CircleEase());
  }
}

let t: Scene;

export async function init(canvasOutput: HTMLCanvasElement): Promise<Scene> {
  if (!t) t = new Scene(canvasOutput, 2, 1000);
  t.scene.debugLayer.show({ embedMode: true, overlay: true, showExplorer: true, showInspector: true });
  t.initialized = false;
  return t;
}
