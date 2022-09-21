import type { Material } from '@babylonjs/core/Materials/material';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Nullable } from '@babylonjs/core/types';
import { GLTFLoader, IGLTFLoaderExtension, IMaterial } from '@babylonjs/loaders/glTF/2.0';
import { VRMMaterialGenerator } from './vrm-material-generator';

/**
 * `extensions` に入る拡張キー
 */
const NAME = 'VCAST_vci_material_unity';

/**
 * VCAST_vci_material_unity 拡張を処理する
 */
// eslint-disable-next-line camelcase
export class VCAST_vci_material_unity implements IGLTFLoaderExtension {
  /**
     * @inheritdoc
     */
  public readonly name = NAME;
  /**
     * @inheritdoc
     */
  public enabled = true;

  /**
     * @inheritdoc
     */
  public constructor(
        private loader: GLTFLoader,
  ) {}

  /**
     * @inheritdoc
     */
  public dispose(): void {
    (this.loader as any) = null;
  }

  /**
     * @inheritdoc
     */
  public _loadMaterialAsync(
    context: string,
    material: IMaterial,
    mesh: Mesh,
    babylonDrawMode: number,
    assign: (babylonMaterial: Material) => void,
  ): Nullable<Promise<Material>> {
    return (new VRMMaterialGenerator(this.loader)).generate(context, material, mesh, babylonDrawMode, assign);
  }
}

GLTFLoader.RegisterExtension(NAME, (loader) => new VCAST_vci_material_unity(loader));
