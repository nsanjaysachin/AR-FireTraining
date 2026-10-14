// Automated Node.js runner to verify all 10 Acceptance Tests
import * as THREE from 'three';

// Mock minimal DOM for Node environment
global.window = {
  innerWidth: 1920,
  innerHeight: 1080,
  devicePixelRatio: 1,
  DeviceOrientationEvent: {},
  addEventListener: () => {},
  removeEventListener: () => {},
  AudioContext: class {
    constructor() { this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; }
    createOscillator() { return { type: '', frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {}, start: () => {}, stop: () => {} }; }
    createGain() { return { gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, setTargetAtTime: () => {} }, connect: () => {} }; }
    createBuffer() { return { getChannelData: () => new Float32Array(44100) }; }
    createBufferSource() { return { buffer: null, loop: false, connect: () => {}, start: () => {}, stop: () => {}, disconnect: () => {} }; }
    createBiquadFilter() { return { type: '', frequency: { setValueAtTime: () => {} }, Q: { setValueAtTime: () => {} }, connect: () => {} }; }
    resume() {}
  }
};
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        width: 1024,
        height: 1024,
        getContext: () => ({
          fillRect: () => {},
          strokeRect: () => {},
          fillText: () => {},
          beginPath: () => {},
          arc: () => {},
          fill: () => {},
          stroke: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          createRadialGradient: () => ({ addColorStop: () => {} })
        })
      };
    }
    if (tag === 'video') {
      return {
        setAttribute: () => {},
        style: {},
        muted: true
      };
    }
    return {
      style: {},
      appendChild: () => {},
      addEventListener: () => {}
    };
  },
  head: { appendChild: () => {} }
};
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      mediaDevices: { getUserMedia: async () => ({}) },
      xr: { isSessionSupported: async () => false }
    },
    writable: true,
    configurable: true
  });
} catch (_) {
  globalThis.navigator.mediaDevices = { getUserMedia: async () => ({}) };
  globalThis.navigator.xr = { isSessionSupported: async () => false };
}

import { FireExtinguisher } from './src/modules/extinguisher.js';
import { FireSimulation } from './src/modules/fire.js';
import { ExtinguisherSpraySystem } from './src/modules/spray.js';
import { HandTrackingManager } from './src/modules/handTracking.js';
import { ARTrackingManager } from './src/modules/arTracking.js';
import { PerformanceEvaluator } from './src/modules/evaluation.js';
import { TrainingManager } from './src/modules/trainingManager.js';
import { AcceptanceTestSuite } from './src/modules/testSuite.js';

async function runAcceptanceVerification() {
  console.log('================================================================');
  console.log('   SAFESPHERE ACCEPTANCE TEST SUITE — AUTOMATED VERIFICATION    ');
  console.log('================================================================');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16/9, 0.1, 100);
  camera.position.set(0, 0.4, 0);

  const container = document.createElement('div');
  const renderer = {
    domElement: document.createElement('canvas'),
    setSize: () => {},
    render: () => {},
    setAnimationLoop: () => {}
  };

  const extinguisher = new FireExtinguisher();
  const fire = new FireSimulation();
  const spray = new ExtinguisherSpraySystem(scene);
  const arTracker = new ARTrackingManager(container, renderer, camera, scene);
  const handTracker = new HandTrackingManager(document.createElement('video'), camera, scene);
  const evaluator = new PerformanceEvaluator();

  const tm = new TrainingManager(extinguisher, fire, spray, handTracker, arTracker, evaluator, {
    onStageChange: () => {},
    onTick: () => {},
    onComplete: () => {}
  });

  const testSuite = new AcceptanceTestSuite(tm, extinguisher, fire, spray, handTracker, arTracker, evaluator);

  const results = await testSuite.runAllTests();

  let allPassed = true;
  results.forEach(r => {
    const icon = r.status === 'pass' ? '✅' : '❌';
    console.log(`\n${icon} TEST ${r.testId}: ${r.name}`);
    console.log(`   Result: ${r.status.toUpperCase()}`);
    console.log(`   Details: ${r.details}`);
    if (r.status !== 'pass') allPassed = false;
  });

  console.log('\n================================================================');
  console.log(`   FINAL SUMMARY: ${allPassed ? 'ALL 10 TESTS PASSED' : 'TEST FAILURES DETECTED'}`);
  console.log('================================================================');
}

runAcceptanceVerification().catch(console.error);
