import { Vector3 } from '@babylonjs/core/Maths/math';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { MorphTarget } from '@babylonjs/core/Morph/morphTarget';
import type { Scene } from '@babylonjs/core/scene';
import type { Nullable } from '@babylonjs/core/types';
import { SpringBoneController } from './secondary-animation/spring-bone-controller';
import { HumanoidBone } from './humanoid-bone';
import type { IVRM } from './vrm-interfaces';
import { MaterialValueBindingMerger } from './material-value-binding-merger';

interface IsBinaryMap {
  [morphName: string]: boolean;
}

interface MorphTargetSetting {
  target: MorphTarget;
  weight: number;
}

interface MorphTargetMap {
  [morphName: string]: MorphTargetSetting[];
}

interface MaterialValueBindingMergerMap {
  [morphName: string]: MaterialValueBindingMerger;
}

interface TransformNodeMap {
  [humanBoneName: string]: TransformNode;
}

interface TransformNodeCache {
  [nodeIndex: number]: TransformNode;
}

interface MeshCache {
  [meshIndex: number]: Mesh[];
}

/**
 * Unity Humanoid Bone 名
 */
// eslint-disable-next-line max-len
export type HumanBoneName = 'hips' | 'leftUpperLeg' | 'rightUpperLeg' | 'leftLowerLeg' | 'rightLowerLeg' | 'leftFoot' | 'rightFoot' | 'spine' | 'chest' | 'neck' | 'head' | 'leftShoulder' | 'rightShoulder' | 'leftUpperArm' | 'rightUpperArm' | 'leftLowerArm' | 'rightLowerArm' | 'leftHand' | 'rightHand' | 'leftToes' | 'rightToes' | 'leftEye' | 'rightEye' | 'jaw' | 'leftThumbProximal' | 'leftThumbIntermediate' | 'leftThumbDistal' | 'leftIndexProximal' | 'leftIndexIntermediate' | 'leftIndexDistal' | 'leftMiddleProximal' | 'leftMiddleIntermediate' | 'leftMiddleDistal' | 'leftRingProximal' | 'leftRingIntermediate' | 'leftRingDistal' | 'leftLittleProximal' | 'leftLittleIntermediate' | 'leftLittleDistal' | 'rightThumbProximal' | 'rightThumbIntermediate' | 'rightThumbDistal' | 'rightIndexProximal' | 'rightIndexIntermediate' | 'rightIndexDistal' | 'rightMiddleProximal' | 'rightMiddleIntermediate' | 'rightMiddleDistal' | 'rightRingProximal' | 'rightRingIntermediate' | 'rightRingDistal' | 'rightLittleProximal' | 'rightLittleIntermediate' | 'rightLittleDistal' | 'upperChest' | string;

/**
 * VRM キャラクターを動作させるためのマネージャ
 */
export class VRMManager {
  private isBinaryMorphMap: IsBinaryMap = {};
  private morphTargetMap: MorphTargetMap = {};
  private materialValueBindingMergerMap: MaterialValueBindingMergerMap = {};
  private presetMorphTargetMap: MorphTargetMap = {};
  private transformNodeMap: TransformNodeMap = {};
  private transformNodeCache: TransformNodeCache = {};
  private meshCache: MeshCache = {};
  private _humanoidBone: HumanoidBone;
  private _rootMesh: Mesh | undefined;

  /** Secondary Animation として定義されている VRM Spring Bone のコントローラ */
  public readonly springBoneController: SpringBoneController;

  /**
     * @param ext glTF.extensions.VRM の中身 json
     * @param scene
     * @param meshesFrom この番号以降のメッシュがこの VRM に該当する
     * @param transformNodesFrom この番号以降の TransformNode がこの VRM に該当する
     * @param materialsNodesFrom この番号以降の Material がこの VRM に該当する
     */
  public constructor(public readonly ext: IVRM, public readonly scene: Scene, private readonly meshesFrom: number, private readonly transformNodesFrom: number, private readonly materialsNodesFrom: number) {
    this.meshCache = this.constructMeshCache();
    this.transformNodeCache = this.constructTransformNodeCache();
    this.springBoneController = new SpringBoneController(this.ext.secondaryAnimation, this.findTransformNode.bind(this));
    if (this.ext.blendShapeMaster && this.ext.blendShapeMaster.blendShapeGroups) {
      this.constructIsBinaryMap();
      this.constructMorphTargetMap();
      this.constructMaterialValueBindingMergerMap();
    }
    this.constructTransformNodeMap();
    this._humanoidBone = new HumanoidBone(this.transformNodeMap);
  }

  /** Secondary Animation を更新する
     * @param deltaTime 前フレームからの経過秒数(sec)
     */
  public async update(deltaTime: number): Promise<void> {
    await this.springBoneController.update(deltaTime);
  }

  public dispose(): void {
    this.springBoneController.dispose();
    this._humanoidBone.dispose();
    (this.morphTargetMap as any) = null;
    (this.materialValueBindingMergerMap as any) = null;
    (this.presetMorphTargetMap as any) = null;
    (this.transformNodeMap as any) = null;
    (this.transformNodeCache as any) = null;
    (this.meshCache as any) = null;
    (this._rootMesh as any) = null;
  }

  public morphing(label: string, value: number): void {
    const v = this.calcMorphValue(label, value);
    if (this.morphTargetMap[label]) {
      this.morphTargetMap[label].forEach((setting) => setting.target.influence = v * (setting.weight / 100));
    }
    if (this.materialValueBindingMergerMap[label]) this.materialValueBindingMergerMap[label].morphing(v);
  }

  public morphingPreset(label: string, value: number): void {
    if (!this.presetMorphTargetMap[label]) return;
    const v = this.calcMorphValue(label, value);
    this.presetMorphTargetMap[label].forEach((setting) => setting.target.influence = v * (setting.weight / 100));
  }

  private calcMorphValue(label: string, value: number): number {
    const v = Math.max(0.0, Math.min(1.0, value));
    if (this.isBinaryMorphMap[label]) return v > 0.5 ? 1.0 : 0.0;
    return v;
  }

  public getMorphingList(): string[] {
    return Object.keys(this.morphTargetMap);
  }

  public getFirstPersonCameraPosition(): Nullable<Vector3> {
    const firstPersonBone = this.getFirstPersonBone();
    if (!firstPersonBone) {
      return null;
    }

    const basePos = firstPersonBone.getAbsolutePosition();
    const offsetPos = this.ext.firstPerson.firstPersonBoneOffset;
    return new Vector3(
      basePos.x + offsetPos.x,
      basePos.y + offsetPos.y,
      basePos.z + offsetPos.z,
    );
  }

  public getFirstPersonBone(): Nullable<TransformNode> {
    return this.findTransformNode(this.ext.firstPerson.firstPersonBone);
  }

  public get humanoidBone(): HumanoidBone {
    return this._humanoidBone;
  }

  public get rootMesh(): Mesh {
    return this._rootMesh as Mesh;
  }

  public findTransformNode(nodeIndex: number): Nullable<TransformNode> {
    return this.transformNodeCache[nodeIndex] || null;
  }

  public findMeshes(meshIndex: number): Nullable<Mesh[]> {
    return this.meshCache[meshIndex] || null;
  }

  private constructIsBinaryMap(): void {
    this.ext.blendShapeMaster.blendShapeGroups.forEach((g) => {
      this.isBinaryMorphMap[g.name] = g.isBinary;
    });
  }

  private constructMorphTargetMap(): void {
    this.ext.blendShapeMaster.blendShapeGroups.forEach((g) => {
      if (!g.binds) return;
      g.binds.forEach((b) => {
        const meshes = this.findMeshes(b.mesh);
        if (!meshes) return;
        meshes.forEach((mesh) => {
          const morphTargetManager = mesh.morphTargetManager;
          if (!morphTargetManager) return;
          const target = morphTargetManager.getTarget(b.index);
          this.morphTargetMap[g.name] = this.morphTargetMap[g.name] || [];
          this.morphTargetMap[g.name].push({ target, weight: b.weight });
          if (g.presetName) {
            this.presetMorphTargetMap[g.presetName] = this.presetMorphTargetMap[g.presetName] || [];
            this.presetMorphTargetMap[g.presetName].push({
              target,
              weight: b.weight,
            });
          }
        });
      });
    });
  }

  private constructMaterialValueBindingMergerMap() {
    const materials = this.scene.materials.slice(this.materialsNodesFrom);
    this.ext.blendShapeMaster.blendShapeGroups.forEach((g) => {
      if (!g.materialValues) return;
      this.materialValueBindingMergerMap[g.name] = new MaterialValueBindingMerger(
        materials,
        g.materialValues,
      );
    });
  }

  private constructTransformNodeMap() {
    this.ext.humanoid.humanBones.forEach((b) => {
      const node = this.findTransformNode(b.node);
      if (!node) return;
      this.transformNodeMap[b.bone] = node;
    });
  }

  private constructTransformNodeCache() {
    const cache: TransformNodeCache = {};
    for (let index = this.transformNodesFrom; index < this.scene.transformNodes.length; index++) {
      const node = this.scene.transformNodes[index];
      // ポインタが登録されていないものは省略
      if (!node || !node.metadata || !node.metadata.gltf || !node.metadata.gltf.pointers || node.metadata.gltf.pointers.length === 0) continue;
      for (const pointer of node.metadata.gltf.pointers) {
        if (pointer.startsWith('/nodes/')) {
          const nodeIndex = parseInt((pointer as string).substr(7), 10);
          cache[nodeIndex] = node;
          break;
        }
      }
    }
    return cache;
  }

  private constructMeshCache() {
    const cache: MeshCache = {};
    for (let index = this.meshesFrom; index < this.scene.meshes.length; index++) {
      const mesh = this.scene.meshes[index];
      if (mesh.id === '__root__') {
        this._rootMesh = mesh as Mesh;
        continue;
      }
      if (!mesh || !mesh.metadata || !mesh.metadata.gltf || !mesh.metadata.gltf.pointers || mesh.metadata.gltf.pointers.length === 0) continue;
      for (const pointer of mesh.metadata.gltf.pointers) {
        const match = (pointer as string).match(/^\/meshes\/(\d+).+$/);
        if (match) {
          const nodeIndex = parseInt(match[1], 10);
          cache[nodeIndex] = cache[nodeIndex] || [];
          cache[nodeIndex].push(mesh as Mesh);
          break;
        }
      }
    }
    return cache;
  }
}
