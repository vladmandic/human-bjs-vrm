import { Color3, Vector4 } from '@babylonjs/core/Maths/math';
import { Material, PBRMaterial, BaseTexture, Texture, Nullable } from '@babylonjs/core';
import { MToonMaterial } from 'babylon-mtoon-material';
import type { IVRMBlendShapeMaterialBind } from './vrm-interfaces';

type SupportedMaterial = MToonMaterial | PBRMaterial;
type Setter = (value: number, firstValue: boolean) => void;

const PBRMaterialTextureMap: {[propertyName: string]: keyof PBRMaterial} = {
  _MainTex: 'albedoTexture',
};

const PBRMaterialColorMap: {[propertyName: string]: keyof PBRMaterial} = {
  _Color: 'albedoColor',
};

const MToonMaterialTextureMap: {[propertyName: string]: keyof MToonMaterial} = {
  _MainTex: 'diffuseTexture',
  _EmissionMap: 'emissiveTexture',
  _BumpMap: 'bumpTexture',
  _ShadeTexture: 'shadeTexture',
  _ReceiveShadowTexture: 'receiveShadowTexture',
  _ShadingGradeTexture: 'shadingGradeTexture',
  _RimTexture: 'rimTexture',
  _SphereAdd: 'matCapTexture',
  _OutlineWidthTexture: 'outlineWidthTexture',
  _UvAnimMaskTexture: 'uvAnimationMaskTexture',
};

const MToonMaterialColorMap: {[propertyName: string]: keyof MToonMaterial} = {
  _Color: 'diffuseColor',
  _ShadeColor: 'shadeColor',
  _RimColor: 'rimColor',
  _EmissionColor: 'emissiveColor',
  _OutlineColor: 'outlineColor',
};

/**
 * @see https://github.com/vrm-c/UniVRM/blob/4ffd97c2e9339683ce9bf21e73f510bd90c2a5b2/Assets/VRM/Runtime/BlendShape/MaterialValueBindingMerger.cs
 */
export class MaterialValueBindingMerger {
  private readonly m_materialMap: {[materialName: string]: SupportedMaterial} = {};
  private readonly m_materialSetterMap: {[bindingKey: string]: Setter} = {};
  private m_materialValueMap: {[bindingKey: string]: number} = {};
  private m_used: {[targetKey: string]: any} = {};

  private readonly baseValueCache: {[bindingKey: string]: Vector4} = {};
  private materialValuesToApply: {[bindingKey: string]: IVRMBlendShapeMaterialBind} = {};

  /**
     * @param materials VRMの全 Material
     * @param materialValues
     */
  public constructor(
    materials: Material[],
        private readonly materialValues: IVRMBlendShapeMaterialBind[],
  ) {
    if (materials.length === 0 || materialValues.length === 0) {
      return;
    }
    materials.forEach((material) => {
      if (material instanceof MToonMaterial || material instanceof PBRMaterial) {
        this.m_materialMap[material.name] = material;
      }
    });
    materialValues.forEach((materialValue) => {
      const bindingKey = this.makeBindingKey(materialValue);
      if (this.m_materialSetterMap[bindingKey]) {
        return;
      }
      const material = this.m_materialMap[materialValue.materialName];
      if (!material) {
        return;
      }
      const baseValue = this.getMaterialProperty(material, materialValue.propertyName);
      if (!baseValue || materialValue.targetValue.length !== 4) {
        return;
      }
      this.baseValueCache[bindingKey] = baseValue;
      this.materialValuesToApply[bindingKey] = materialValue;
      const targetValue = Vector4.FromArray(materialValue.targetValue);
      const valueName = materialValue.propertyName;
      if (material instanceof PBRMaterial) {
        if (Object.keys(PBRMaterialTextureMap).some((k) => valueName.startsWith(k))) {
          targetValue.w *= -1;
        }
      } else if (Object.keys(MToonMaterialTextureMap).some((k) => valueName.startsWith(k))) {
        targetValue.w *= -1;
      }
      if (valueName.endsWith('_ST_S')) {
        const setter: Setter = (value, firstValue) => {
          const propValue = firstValue
            ? baseValue.add((targetValue.subtract(baseValue)).scale(value))
            : this.getMaterialProperty(material, valueName)!.add(targetValue.subtract(baseValue).scale(value));
          const src = this.getMaterialProperty(material, valueName)!;
          src.x = propValue.x;
          src.z = propValue.z;
          this.updateMaterialProperty(material, valueName, src);
        };
        this.m_materialSetterMap[bindingKey] = setter;
      } else if (valueName.endsWith('_ST_T')) {
        const setter: Setter = (value, firstValue) => {
          const propValue = firstValue
            ? baseValue.add((targetValue.subtract(baseValue)).scale(value))
            : this.getMaterialProperty(material, valueName)!.add(targetValue.subtract(baseValue).scale(value));
          const src = this.getMaterialProperty(material, valueName)!;
          src.y = propValue.y;
          src.w = propValue.w;
          this.updateMaterialProperty(material, valueName, src);
        };
        this.m_materialSetterMap[bindingKey] = setter;
      } else {
        const setter: Setter = (value, firstValue) => {
          const propValue = firstValue
            ? baseValue.add((targetValue.subtract(baseValue)).scale(value))
            : this.getMaterialProperty(material, valueName)!.add(targetValue.subtract(baseValue).scale(value));
          this.updateMaterialProperty(material, valueName, propValue);
        };
        this.m_materialSetterMap[bindingKey] = setter;
      }
    });
  }

  private makeBindingKey(materialValue: IVRMBlendShapeMaterialBind): string {
    return `${materialValue.materialName}_${materialValue.propertyName}_${materialValue.targetValue.join('-')}`;
  }

  private makeTargetKey(materialValue: IVRMBlendShapeMaterialBind): string {
    return `${materialValue.materialName}_${materialValue.propertyName}`;
  }

  public morphing(value: number) {
    this.accumulateValue(value);
    this.apply();
  }

  private accumulateValue(value: number): void {
    this.materialValues.forEach((materialValue) => {
      const bindingKey = this.makeBindingKey(materialValue);
      if (this.m_materialValueMap[bindingKey]) {
        this.m_materialValueMap[bindingKey] += value;
      } else {
        this.m_materialValueMap[bindingKey] = value;
      }
    });
  }

  private apply(): void {
    this.m_used = {};
    Object.entries(this.materialValuesToApply).forEach(([bindingKey, materialValue]) => {
      const targetKey = this.makeTargetKey(materialValue);
      if (!(targetKey in this.m_used)) {
        const material = this.m_materialMap[materialValue.materialName];
        const value = this.baseValueCache[bindingKey].clone();
        const valueName = materialValue.propertyName;
        if (valueName.endsWith('_ST_S')) {
          const v = this.getMaterialProperty(material, valueName)!;
          value.y = v.y;
          value.w = v.w;
        } else if (valueName.endsWith('_ST_T')) {
          const v = this.getMaterialProperty(material, valueName)!;
          value.x = v.x;
          value.z = v.z;
        }
        this.updateMaterialProperty(material, valueName, value);
        this.m_used[targetKey] = true;
      }
      const setter = this.m_materialSetterMap[bindingKey];
      if (setter) {
        setter(this.m_materialValueMap[bindingKey], false);
      }
    });

    this.m_materialValueMap = {};
  }

  private getMaterialProperty(material: SupportedMaterial, propertyName: string): Nullable<Vector4> {
    const match = propertyName.match(/^(_[^_]+)/);
    if (!match || !match[1]) {
      return null;
    }
    const key = match[1];
    if (material instanceof PBRMaterial) {
      if (PBRMaterialTextureMap[key]) {
        return this.convertTextureIntoVector4WhenNotNull(material[PBRMaterialTextureMap[key]]);
      }
      if (PBRMaterialColorMap[key]) {
        return this.convertColorIntoVector4(material[PBRMaterialColorMap[key]], material.alpha);
      }
      return null;
    }
    if (MToonMaterialTextureMap[key]) return this.convertTextureIntoVector4WhenNotNull(material[MToonMaterialTextureMap[key]]);
    if (MToonMaterialColorMap[key]) return this.convertColorIntoVector4(material[MToonMaterialColorMap[key]], material.alpha);
    return null;
  }

  private convertTextureIntoVector4WhenNotNull(texture: Nullable<BaseTexture>): Nullable<Vector4> {
    if (!texture) return null;
    const t = texture as Texture;
    return new Vector4(t.uScale, t.vScale, t.uOffset, t.vOffset);
  }

  private convertColorIntoVector4(color: Color3, alpha: number): Vector4 {
    return new Vector4(color.r, color.g, color.b, alpha);
  }

  private updateMaterialProperty(material: SupportedMaterial, propertyName: string, value: Vector4): void {
    const match = propertyName.match(/^(_[^_]+)/);
    if (!match || !match[1]) return;
    const key = match[1];
    if (material instanceof PBRMaterial) {
      if (PBRMaterialTextureMap[key]) {
        this.updateTextureWhenNotNull(material[PBRMaterialTextureMap[key]], value);
        return;
      }
      if (PBRMaterialColorMap[key]) {
        if (key === '_Color') material.alpha = value.w;
        this.updateColor(material[PBRMaterialColorMap[key]], value);
      }
      return;
    }
    if (MToonMaterialTextureMap[key]) {
      this.updateTextureWhenNotNull(material[MToonMaterialTextureMap[key]], value);
      return;
    }
    if (MToonMaterialColorMap[key]) {
      if (key === '_Color') material.alpha = value.w;
      this.updateColor(material[MToonMaterialColorMap[key]], value);
    }
  }

  private updateTextureWhenNotNull(texture: Nullable<BaseTexture>, value: Vector4): void {
    if (texture) {
      const t = texture as Texture;
      t.uScale = value.x;
      t.vScale = value.y;
      t.uOffset = value.z;
      t.vOffset = value.w;
    }
  }

  private updateColor(color: Color3, value: Vector4): void {
    color.r = value.x;
    color.g = value.y;
    color.b = value.z;
  }
}
