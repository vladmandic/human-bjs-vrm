import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { GLTFFileLoader } from '@babylonjs/loaders/glTF/glTFFileLoader';

export class VRMFileLoader extends GLTFFileLoader {
  public override name = 'vrm';
  public override extensions = {
    '.vrm': { isBinary: true },
    '.vci': { isBinary: true },
  };

  // eslint-disable-next-line class-methods-use-this
  public override createPlugin() {
    return new VRMFileLoader();
  }
}

if (SceneLoader) SceneLoader.RegisterPlugin(new VRMFileLoader());
