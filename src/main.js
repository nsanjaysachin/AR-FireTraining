import './style.css';
import * as THREE from 'three';

import { soundFx } from './modules/audio.js';
import { FireExtinguisher, EXTINGUISHER_STATE } from './modules/extinguisher.js';
import { FireSimulation } from './modules/fire.js';
import { ExtinguisherSpraySystem } from './modules/spray.js';
import { HandTrackingManager, TRACKING_MODE } from './modules/handTracking.js';
import { ARTrackingManager, AR_SESSION_MODE } from './modules/arTracking.js';
import { PerformanceEvaluator } from './modules/evaluation.js';
import { TrainingManager, TRAINING_STAGE } from './modules/trainingManager.js';
import { SafeSphereUI } from './modules/ui.js';
import { AcceptanceTestSuite } from './modules/testSuite.js';

class SafeSphereApp {
  constructor() {
    this.container = document.querySelector('#app');
    this.ui = new SafeSphereUI(this.container);

    this.clock = new THREE.Clock();
    this.lastFrameTime = 0;
    this.mediaPipeThrottle = 0;

    this.init3D();
    this.initSystems();
    this.setupInteractions();
    this.startLoop();
  }

  init3D() {
    const canvasContainer = document.querySelector('#canvas-container');

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.05,
      50
    );
    this.camera.position.set(0, 0.35, 0.5);

    // 3. Renderer with transparent background for AR pass-through
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    canvasContainer.appendChild(this.renderer.domElement);

    // 4. Lighting for realistic PBR rendering
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.95);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xFFFFFF, 1.4);
    sunLight.position.set(2, 5, 3);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 15;
    this.scene.add(sunLight);

    // 5. Contact shadow ground plane (ShadowMaterial: receives shadows, transparent otherwise)
    const groundGeo = new THREE.PlaneGeometry(15, 15);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.38 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.30;
    ground.receiveShadow = true;
    this.scene.add(ground);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  async initSystems() {
    // 1. Fire Extinguisher 3D Object
    this.extinguisher = new FireExtinguisher();
    this.scene.add(this.extinguisher.group);

    // 2. Fire Simulation Object
    this.fire = new FireSimulation();
    this.scene.add(this.fire.group);

    // 3. Spray System
    this.spray = new ExtinguisherSpraySystem(this.scene);

    // 4. AR Tracking Engine (Camera AR pass-through & spatial anchors)
    this.arTracker = new ARTrackingManager(
      document.querySelector('#canvas-container'),
      this.renderer,
      this.camera,
      this.scene
    );

    // Anchor initial scenario in world coordinates
    this.arTracker.anchorScenario(this.extinguisher, this.fire);

    // 5. Hand Tracking Engine (MediaPipe Hands with simulator fallback)
    this.handTracker = new HandTrackingManager(
      this.arTracker.video,
      this.camera,
      this.scene
    );

    // 6. Performance Evaluation
    this.evaluator = new PerformanceEvaluator();

    // 7. Training State Machine & PASS Logic
    this.trainingManager = new TrainingManager(
      this.extinguisher,
      this.fire,
      this.spray,
      this.handTracker,
      this.arTracker,
      this.evaluator,
      {
        onStageChange: (stage, prompt) => this.ui.updateStage(stage, prompt),
        onTick: (data) => this.ui.updateTick(data),
        onComplete: (report) => this.ui.showResults(report)
      }
    );

    // 8. Acceptance Test Suite (Tests 1 through 10)
    this.testSuite = new AcceptanceTestSuite(
      this.trainingManager,
      this.extinguisher,
      this.fire,
      this.spray,
      this.handTracker,
      this.arTracker,
      this.evaluator
    );

    // Request camera and start tracking
    const arResult = await this.arTracker.startCameraAR();
    if (arResult.success) {
      this.ui.setTrackingModeLabel('CAMERA AR');
      // Initialize MediaPipe with video feed
      await this.handTracker.initMediaPipe();
    } else {
      this.ui.setTrackingModeLabel('3D SIMULATOR', true);
      this.handTracker.setMode(TRACKING_MODE.SIMULATOR_FALLBACK);
      this.ui.setSimulatorToggleLabel(true);
      console.log('SafeSphere running in 3D simulator fallback mode.');
    }
  }

  setupInteractions() {
    this.ui.setCallbacks({
      onStart: () => {
        this.trainingManager.startTraining();
      },
      onPullPin: () => {
        const ok = this.trainingManager.triggerPinPull();
        if (ok) {
          this.ui.showFeedback('✅ Safety pin pulled! Lever unlocked.');
        } else {
          this.ui.showFeedback('Pin already disengaged.');
        }
      },
      onSqueeze: (squeeze) => {
        const ok = this.trainingManager.triggerSqueeze(squeeze);
        if (!ok && squeeze) {
          this.ui.showFeedback('⚠️ Cannot squeeze! Pull the safety pin (P) first.');
        }
      },
      onReposition: () => {
        this.arTracker.repositionAnchor(this.extinguisher, this.fire);
        this.ui.showFeedback('📍 Scenario anchor repositioned to your current viewpoint.');
      },
      onGuideDemo: () => {
        this.trainingManager.runGuideDemo();
        this.ui.showFeedback('🎓 Running automated presentation walkthrough for faculty/guide.');
      },
      onToggleMode: () => {
        if (this.handTracker.mode === TRACKING_MODE.MEDIAPIPE_VISION) {
          this.handTracker.setMode(TRACKING_MODE.SIMULATOR_FALLBACK);
          this.arTracker.setSimGridVisible(true);
          this.ui.setSimulatorToggleLabel(true);
          this.ui.setTrackingModeLabel('SIMULATOR MODE', true);
          this.ui.showFeedback('Switched to interactive pointer simulator mode.');
        } else {
          this.handTracker.setMode(TRACKING_MODE.MEDIAPIPE_VISION);
          this.arTracker.setSimGridVisible(false);
          this.ui.setSimulatorToggleLabel(false);
          this.ui.setTrackingModeLabel('CAMERA AR');
          this.ui.showFeedback('Switched to camera computer vision hand tracking.');
        }
      },
      onRetry: () => {
        this.trainingManager.restart();
        this.ui.showFeedback('Training scenario restarted.');
      },
      onRunTests: async () => {
        const reportList = document.querySelector('#test-report-list');
        reportList.innerHTML = '<div style="text-align: center; padding: 20px; color: #38BDF8;">Running automated acceptance diagnostic tests 1 to 10...</div>';
        const results = await this.testSuite.runAllTests();
        this.ui.renderTestResults(results);
      }
    });

    // Keyboard shortcuts for convenience
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        // Toggle or activate squeeze
        if (this.extinguisher.state === EXTINGUISHER_STATE.HELD) {
          this.trainingManager.triggerSqueeze(true);
        }
      } else if (e.key === 'p' || e.key === 'P') {
        this.trainingManager.triggerPinPull();
      } else if (e.key === 'r' || e.key === 'R') {
        this.arTracker.repositionAnchor(this.extinguisher, this.fire);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.trainingManager.triggerSqueeze(false);
      }
    });

    // Mouse / touch interaction for Simulator mode
    window.addEventListener('mousemove', (e) => {
      if (this.handTracker.mode === TRACKING_MODE.SIMULATOR_FALLBACK) {
        // Map mouse position to virtual 3D hand space
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = -(e.clientY / window.innerHeight) * 2 + 1;

        // Project ray into 3D scene at z = -0.9m
        const handPos = new THREE.Vector3(x * 0.8, y * 0.6 - 0.1, -0.9);
        handPos.applyMatrix4(this.camera.matrixWorld);

        this.handTracker.setSimulatorPose(
          handPos.x,
          handPos.y,
          handPos.z,
          this.handTracker.simIsGrabbing,
          this.handTracker.simIsSqueezing
        );
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.target.closest('#hud-overlay') || e.target.closest('.modal-card')) return;
      if (this.handTracker.mode === TRACKING_MODE.SIMULATOR_FALLBACK) {
        this.handTracker.simIsGrabbing = true;
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.handTracker.mode === TRACKING_MODE.SIMULATOR_FALLBACK) {
        this.handTracker.simIsGrabbing = false;
        if (this.extinguisher.state === EXTINGUISHER_STATE.HELD && !this.extinguisher.isSqueezing) {
          // Can release if not spraying
          // this.extinguisher.release();
        }
      }
    });
  }

  startLoop() {
    this.renderer.setAnimationLoop(() => this.renderFrame());
  }

  renderFrame() {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Process MediaPipe frame at ~30 FPS
    this.mediaPipeThrottle += delta;
    if (this.mediaPipeThrottle >= 0.033) {
      this.handTracker.processFrame();
      this.mediaPipeThrottle = 0;
    }

    // 2. Update held extinguisher pose if in HELD state
    if (this.extinguisher.state === EXTINGUISHER_STATE.HELD) {
      this.extinguisher.updateHeldPose(
        this.handTracker.handWorldPos,
        this.handTracker.handWorldQuat,
        delta
      );
    }

    // 3. Update Fire particles & smolder physics
    this.fire.update(delta, elapsedTime);

    // 4. Update Spray particles & compute suppression intersection
    const sprayResult = this.spray.update(
      delta,
      this.extinguisher,
      this.fire,
      this.camera
    );

    // Update aim lock visual feedback (laser line & target ring)
    this.extinguisher.updateAimLock(sprayResult.isAimingAtBase);
    this.fire.updateTargetLock(sprayResult.isAimingAtBase);

    // Record spray metrics for performance evaluation
    if (this.trainingManager.isActive) {
      this.evaluator.recordSprayFrame(delta, sprayResult);
      if (sprayResult.feedback) {
        this.ui.showFeedback(sprayResult.feedback);
      }
    }

    // 5. Update Training state machine
    this.trainingManager.update(delta);

    // 6. Update AR reticle pulse
    this.arTracker.update(elapsedTime);

    // 7. Render 3D scene
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.safeSphereApp = new SafeSphereApp();
});
