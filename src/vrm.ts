import * as B from '@babylonjs/core';
import { Vector3 } from '@babylonjs/core';
import type * as H from '@vladmandic/human'; // just import typedefs as we dont need human here
import '../vrm/index';
import type { VRMManager } from '../vrm/index';

let vrm: VRMManager;

export async function init(t: B.Scene) {
  const scene = await B.SceneLoader.AppendAsync('', 'assets/models/victoria-jeans.vrm', t);
  vrm = scene.metadata.vrmManagers[0];
  console.log({ vrm, morphs: vrm.getMorphingList() });
  scene.onBeforeRenderObservable.add(() => vrm.update(scene.getEngine().getDeltaTime())); // Update secondary animation
  // vrm.rootMesh.translate(new B.Vector3(1, 0, 0), 1); // Model Transformation
  // vrm.humanoidBone.leftUpperArm.addRotation(0, 1, 0); // Work with HumanoidBone
  // vrm.morphing('Joy', 1.0); // Work with BlendShape(MorphTarget)
}

let leanBody = 0; // face angle is relative to body so we set it globally

const angle = (pt1: H.Point | null, pt2: H.Point | null) => {
  if (!pt1 || !pt2 || pt1.length < 2 || pt2.length < 2) return 0;
  const radians = Math.atan2(pt2[1] - pt1[1], pt2[0] - pt1[0]);
  return radians;
};

async function updateBody(res: H.Result) {
  const body = (res && res.body) ? res.body[0] : null;
  if (!body) return;

  const part = (what: string) => {
    const found = body.keypoints.find((a) => a.part === what);
    const pos = found ? found.positionRaw : null;
    return pos;
  };

  // lean body
  leanBody = angle(part('rightShoulder'), part('leftShoulder'));
  vrm.humanoidBone.chest.rotation = new Vector3(0, 0, leanBody);

  // arms
  // vrm.humanoidBone.rightUpperArm.rotation = new Vector3(0, angle(part('rightElbow'), part('rightShoulder')), 0);
  // vrm.humanoidBone.leftUpperArm.rotation = new Vector3(0, angle(part('leftShoulder'), part('leftElbow')), 0);

  // elbows
  // vrm.humanoidBone.rightLowerArm.rotation = new Vector3(0, angle(part('rightWrist'), part('rightElbow')) - angle(part('rightElbow'), part('rightShoulder')), 0);
  // vrm.humanoidBone.leftLowerArm.rotation = new Vector3(0, angle(part('leftElbow'), part('leftWrist')) - angle(part('leftShoulder'), part('leftElbow')), 0);

  // legs
  // vrm.humanoidBone.rightUpperLeg.rotation = new Vector3(0, 0, angle(part('rightHip'), part('rightKnee')) - (Math.PI / 2));
  // vrm.humanoidBone.leftUpperLeg.rotation = new Vector3(0, 0, angle(part('leftHip'), part('leftKnee')) - (Math.PI / 2));

  // knees
  // vrm.humanoidBone.rightLowerLeg.rotation = new Vector3(0, 0, angle(part('rightHip'), part('rightAnkle')) - (Math.PI / 2));
  // vrm.humanoidBone.leftLowerLeg.rotation = new Vector3(0, 0, angle(part('leftHip'), part('leftAnkle')) - (Math.PI / 2));
}

/*
async function updateHands(res) {
  const hands = (res && res.hand) ? res.hand : [];
  for (const hand of hands) {
    const distanceLeft = posLeftWrist ? Math.sqrt((hand.boxRaw[0] - posLeftWrist[0]) ** 2) + ((hand.boxRaw[1] - posLeftWrist[1]) ** 2) : Number.MAX_VALUE;
    const distanceRight = posRightWrist ? Math.sqrt((hand.boxRaw[0] - posRightWrist[0]) ** 2) + ((hand.boxRaw[1] - posRightWrist[1]) ** 2) : Number.MAX_VALUE;
    if (distanceLeft > 1 && distanceRight > 1) continue; // both hands are too far
    const left = distanceLeft < distanceRight;

    const handSize = Math.sqrt(((hand.box[2] || 1) ** 2) + (hand.box[3] || 1) ** 2) / Math.PI;
    const handRotation = (hand.annotations.pinky[0][2] - hand.annotations.thumb[0][2]) / handSize; // normalized z-coord of root of pinky and thumb fingers
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[left ? 'LeftHand' : 'RightHand']).rotation.z = -handRotation * Math.PI / 2; // rotate palm towards camera

    // finger curls
    const getCurl = (finger) => {
      let val = 0;
      if (hand.landmarks[finger].curl === 'half') val = Math.PI / 8;
      else if (hand.landmarks[finger].curl === 'full') val = Math.PI / 4;
      return val;
    };

    let val;
    val = getCurl('index');
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}IndexIntermediate`]).rotation.z = val;
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}IndexProximal`]).rotation.z = val;
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}IndexDistal`]).rotation.z = val;
    val = getCurl('middle');
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}MiddleIntermediate`]).rotation.z = val;
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}MiddleProximal`]).rotation.z = val;
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}MiddleDistal`]).rotation.z = val;
    val = getCurl('ring');
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}RingIntermediate`]).rotation.z = val;
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}RingProximal`]).rotation.z = val;
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}RingDistal`]).rotation.z = val;
    val = getCurl('pinky');
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}LittleIntermediate`]).rotation.z = val;
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}LittleProximal`]).rotation.z = val;
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}LittleDistal`]).rotation.z = val;
    val = getCurl('thumb');
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}ThumbIntermediate`]).rotation.x = 2 * -val;
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}ThumbProximal`]).rotation.x = 2 * -val;
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}ThumbDistal`]).rotation.x = 2 * -val;

    // palm wave
    const q = angle(hand.annotations.index[3], hand.annotations.palm[0]) - (Math.PI / 2);
    vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName[`${left ? 'Left' : 'Right'}Hand`]).rotation.y = q;
  }
}
*/

async function updateFace(res: H.Result) {
  // face angles
  const face = res?.face?.[0];
  if (!face || face.mesh?.length < 300) return;

  for (const morph of vrm.getMorphingList()) vrm.morphing(morph, 0); // reset all morphs

  // face and neck angles
  const faceAngle = face.rotation?.angle || { roll: 0, yaw: 0, pitch: 0 };
  vrm.humanoidBone.head.rotation = new Vector3(-faceAngle.pitch / 2, -faceAngle.yaw / 2, faceAngle.roll / 2 - leanBody);
  vrm.humanoidBone.neck.rotation = new Vector3(-faceAngle.pitch / 2, -faceAngle.yaw / 2, (faceAngle.roll / 2 - leanBody) / 2);

  // tbd: emotions
  // emotions also control mouth so its either this or mouth
  /*
  switch (face.emotion?.[0]?.emotion) { // Possible morphs: Neutral, A, I, U, E, O, Blink, Blink_L, Blink_R, Angry, Fun, Joy, Sorrow, Surprised, Extra
    case 'happy': vrm.morphing('Joy', 1.0); break;
    case 'angry': vrm.morphing('Angry', 1.0); break;
    case 'neutral': vrm.morphing('Neutral', 1.0); break;
    case 'surprise': vrm.morphing('Surprised', 1.0); break;
    case 'sad': vrm.morphing('Sorrow', 1.0); break;
    case 'disgust': vrm.morphing('Extra', 1.0); break;
    // case 'fear': vrm.morphing('Extra', 1.0); break; // tbd
    default: vrm.morphing('Neutral', 1.0); break;
  }
  */

  // mouth open
  const mouth = Math.min(1, 5 * Math.abs(face.mesh[13][1] - face.mesh[14][1]) / Math.abs(face.mesh[10][1] - face.mesh[152][1]));
  vrm.morphing('O', mouth);
  vrm.morphing('A', mouth);

  // blink
  const blinkL = 3 * (Math.abs(face.mesh[443][1] - face.mesh[450][1]) / Math.abs(face.mesh[374][1] - face.mesh[386][1]) - 2.5) / 10;
  const blinkR = 3 * (Math.abs(face.mesh[223][1] - face.mesh[230][1]) / Math.abs(face.mesh[145][1] - face.mesh[159][1]) - 2.5) / 10;
  vrm.morphing('Blink_L', blinkL);
  vrm.morphing('Blink_R', blinkR);

  // tbd: gaze direction
  // babylon vrm loader does not support lookAt

  // console.log({ ts: Date.now(), res });
}

export async function update(res: H.Result) {
  await updateBody(res);
  await updateFace(res);
  // await updateHands(res);
}
