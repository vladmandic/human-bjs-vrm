import * as H from '@vladmandic/human';
import * as B from '@babylonjs/core';
import * as scene from './scene';
import * as overlay from './overlay';
import * as vrm from './vrm';

const width = 720;
const height = 720;

const samples = [
  { label: '[select input]', type: 'none' },
  { label: 'Live WebCam', type: 'webcam' },
  { label: 'Upload Video', type: 'upload' },
  { label: 'Sample: Baseball Pitch', url: '../assets/BaseballPitch.webm', type: 'video' },
];

const config: Partial<H.Config> = {
  backend: 'humangl' as const,
  modelBasePath: 'https://vladmandic.github.io/human-models/models/',
  filter: { enabled: true, equalization: false, width, height },
  face: { enabled: true, detector: { rotation: true, maxDetected: 1 }, mesh: { enabled: true }, attention: { enabled: true }, iris: { enabled: false }, description: { enabled: false }, emotion: { enabled: true } },
  // body: { enabled: true, minConfidence: 0.1, maxDetected: 1, modelPath: 'blazepose-heavy.json' },
  body: { enabled: true, minConfidence: 0.1, maxDetected: 1 },
  hand: { enabled: true, minConfidence: 0.2, maxDetected: 1, landmarks: true, rotation: false },
  object: { enabled: false },
  gesture: { enabled: true },
};

const human = new H.Human(config); // local instance of human used only to prepare input and interpolate results
const worker = new Worker('../dist/worker.js'); // processing is done inside web worker
let result: H.Result; // last known good result from human.detect
let drawTimestamp = 0; // used to calculate fps
let tensors = 0; // monitors tensor counts inside web worker
let busy = false; // busy flag set when posted message to worker and cleared when received message from worker
let totalTime = 0;
let totalCount = 0;

const dom = { // pointers to dom objects
  video: document.getElementById('video') as HTMLVideoElement,
  file: document.getElementById('file-input') as HTMLInputElement,
  input: document.getElementById('input') as HTMLSelectElement,
  status: document.getElementById('status') as HTMLPreElement,
  outputOverlay: document.getElementById('output-overlay') as HTMLCanvasElement,
  outputMesh: document.getElementById('output-mesh') as HTMLCanvasElement,
};

const log = (...msg: unknown[]) => console.log(...msg);

// draw loop runs at fixed 60 fps
async function drawResults() {
  if (result) {
    const now = Date.now();
    const age = now - result.timestamp;
    if (age > 500) { // let it run for just a bit longer so interpolation caches up
      dom.status.innerText = 'paused';
    } else {
      totalTime += age;
      totalCount += 1;
      dom.status.innerText = `process${(1000 / age).toFixed(1).padStart(5)} | refresh${(1000 / (now - drawTimestamp)).toFixed(1).padStart(5)} | avg${(1000 * totalCount / totalTime).toFixed(1).padStart(5)}`;
      drawTimestamp = now;
      const interpolated = human.next(result); // interpolate results
      await overlay.draw(width, height, interpolated, dom.video, true, true, true); // points, outlines, meshes
      await vrm.update(interpolated);
    }
  }
  // setTimeout(drawResults, 20);
  requestAnimationFrame(() => drawResults());
}

// detect loop runs as fast as results are received
async function requestDetect() {
  if (busy || dom.video.readyState < 2) return; // already processing or video not ready
  const processed = await human.image(dom.video, true); // only pre-process input video in main thread
  const image = await processed.tensor?.data() as Float32Array; // download data to use as transferrable object
  human.tf.dispose(processed.tensor);
  if (image) {
    busy = true;
    worker.postMessage({ image, width, height, config }, [image.buffer]); // immediately request next frame
  }
}

// receive message from worker thread
async function receiveMessage(msg: MessageEvent) {
  busy = false;
  if (msg?.data?.state) {
    const state = JSON.parse(msg?.data?.state);
    if (state.numTensors > (tensors + 10)) log(`state: tensors: ${state.numTensors.toLocaleString()} | bytes: ${state.numBytes.toLocaleString()} | ${human.env.webgl.version?.toLowerCase()}`);
    tensors = state.numTensors;
  }
  if (msg?.data?.result) result = msg.data.result as H.Result;
  if (!dom.video.paused) await requestDetect(); // if not paused request next frame
}

const resize = () => {
  dom.video.width = dom.video.videoWidth;
  dom.video.height = dom.video.videoHeight;
  dom.outputOverlay.width = dom.video.videoWidth;
  dom.outputOverlay.height = dom.video.videoHeight;
  dom.outputMesh.width = 2 * dom.video.videoWidth;
  dom.outputMesh.height = 2 * dom.video.videoHeight;
};

// load video from url
async function loadVideo(url: string, title?: string) {
  dom.status.innerText = 'loading video...';
  return new Promise((resolve, reject) => {
    dom.video.onerror = (err) => {
      dom.status.innerText = 'video error';
      log(`error loading: ${title || url} | ${dom.video.error?.message.toLowerCase()}`);
      reject(err);
    };
    dom.video.onloadeddata = () => {
      dom.video.controls = true;
      dom.video.playbackRate = 1.0;
      dom.status.innerText = '';
      resize();
      log(`video: ${title || url} resolution: ${dom.video.videoWidth} x ${dom.video.videoHeight} duration: ${Math.trunc(dom.video.duration)}`);
      resolve(true);
    };
    dom.video.onplay = () => requestDetect();
    dom.video.onseeked = () => requestDetect();
    if (dom.video.srcObject) dom.video.srcObject = null;
    dom.video.src = url;
  });
}

// initialize webcam and set video to use webcam as source
async function startWebCam() {
  const constraints = { audio: false, video: { facingMode: 'user', resizeMode: 'crop-and-scale', width: { ideal: width }, height: { ideal: height } } };
  const stream: MediaStream = await navigator.mediaDevices.getUserMedia(constraints);
  const ready = new Promise((resolve) => { dom.video.onloadeddata = () => resolve(true); });
  if (dom.video.src) dom.video.src = '';
  dom.video.srcObject = stream;
  dom.video.play();
  await ready;
  resize();
  const track: MediaStreamTrack = stream.getVideoTracks()[0];
  log('webcam:', dom.video.videoWidth, dom.video.videoHeight, track.label);
  dom.video.onclick = () => { // pause when clicked on screen and resume on next click
    if (dom.video.paused) {
      dom.video.play();
      requestDetect();
    } else {
      dom.video.pause();
    }
  };
  requestDetect();
}

// global initializer
async function init() {
  for (const sample of samples) { // enumerate video samples
    const input = document.createElement('option');
    input.value = JSON.stringify(sample);
    input.innerText = sample.label;
    dom.input.appendChild(input);
  }
  dom.input.onchange = (ev: Event) => { // event when video is selected
    const opt = (ev.target as HTMLSelectElement).options as HTMLOptionsCollection;
    const sample = JSON.parse(opt[opt.selectedIndex].value);
    if (sample.type === 'video') loadVideo(sample.url);
    if (sample.type === 'webcam') startWebCam();
    if (sample.type === 'upload') dom.file.click();
  };
  dom.file.onchange = (ev: Event) => { // event when loading video from file
    ev.preventDefault();
    if (!dom.file.files || !dom.file.files[0]) return;
    const file = dom.file.files[0];
    const reader = new FileReader();
    reader.onload = (read) => {
      if (read.target && read.target.result) loadVideo(read.target.result as string, file.name);
    };
    reader.readAsDataURL(file);
  };
}

async function main() {
  dom.status.innerText = 'loading...';
  await human.validate(config); // check for possible configuration errors
  await human.init(); // requires explicit init since were not using any of the auto functions
  log('human', human.version, '| tfjs', human.tf.version.tfjs, '| babylon', B.Engine.Version, '|', human.env.webgl.version?.toLowerCase());
  await init();
  const t = await scene.init(dom.outputMesh);
  await overlay.init(dom.outputOverlay, human.faceTriangulation);
  await vrm.init(t.scene);
  dom.status.innerText = 'ready...';
  worker.onmessage = receiveMessage; // listen to messages from worker thread
  worker.postMessage({ config }); // send initial message to worker thread so it can initialize
  drawResults();
}

window.onload = main;
