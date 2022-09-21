export class BoneNotFoundError extends Error {
  public override readonly name = 'BoneNotFoundError';

  public constructor(public readonly boneName: string) {
    super(`Bone:${boneName} NotFound`);
  }
}
