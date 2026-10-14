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

    // Mobile touch & interaction state
    this.hapticInterval = null;
    this.touchStartY = 0;
    this.lastTouchY = 0;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

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

    // 5. Contact shadow ground plane
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
      await this.handTracker.initMediaPipe();
    } else {
      this.ui.setTrackingModeLabel('3D SIMULATOR', true);
      this.handTracker.setMode(TRACKING_MODE.SIMULATOR_FALLBACK);
    }
  }

  setupInteractions() {
    this.ui.setCallbacks({
      onStart: () => {
        this.trainingManager.startTraining();
      },
      onRetry: () => {
        this.trainingManager.restart();
        this.ui.showFeedback('Training scenario restarted.');
      },
      onRunTests: async () => {
        const reportList = document.querySelector('#test-report-list');
        if (reportList) {
          reportList.innerHTML = '<div style="text-align: center; padding: 20px; color: #38BDF8;">Running automated acceptance diagnostic tests 1 to 10...</div>';
        }
        const results = await this.testSuite.runAllTests();
        this.ui.renderTestResults(results);
      }
    });

    // 1. MOBILE TOUCH INTERACTIONS (100% Mobile Phone Physical Control — No Buttons!)
    const handleTouchStart = (e) => {
      // Don't intercept UI overlay modals or top buttons
      if (e.target.closest('.modal-card') || e.target.closest('.top-bar') || e.target.closest('button')) {
        return;
      }

      if (e.touches && e.touches.length > 0) {
        this.touchStartY = e.touches[0].clientY;
        this.lastTouchY = e.touches[0].clientY;
      }

      const stage = this.trainingManager.currentStage;

      // STAGE 1: Grab Extinguisher
      if (stage === TRAINING_STAGE.INSTRUCTION || stage === TRAINING_STAGE.PICKUP) {
        const success = this.trainingManager.triggerPickup(this.camera.position, this.camera.quaternion);
        if (success) {
          if (navigator.vibrate) navigator.vibrate(40);
          this.ui.showFeedback('✅ Extinguisher grabbed! Pull safety pin (P).');
        }
      }
      // STAGE 2: Pull Safety Pin (P)
      else if (stage === TRAINING_STAGE.PIN_PULL) {
        const success = this.trainingManager.triggerPinPull();
        if (success) {
          if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
          this.ui.showFeedback('✅ Safety pin pulled! Lever unlocked. Aim at base.');
        }
      }
      // STAGE 3 & 4: Squeeze Lever (S) — Hold screen to spray!
      else if (stage === TRAINING_STAGE.SUPPRESSION || stage === TRAINING_STAGE.APPROACH_AIM) {
        if (this.extinguisher.isPinPulled) {
          this.trainingManager.setTouchSqueeze(true);
          if (navigator.vibrate) navigator.vibrate(25);

          // Rhythmic vibration loop while spraying
          if (!this.hapticInterval) {
            this.hapticInterval = setInterval(() => {
              if (this.extinguisher.isSqueezing && navigator.vibrate) {
                navigator.vibrate(20);
              }
            }, 80);
          }
        } else {
          this.ui.showFeedback('⚠️ Pull the safety pin (P) before squeezing!');
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }
      }
    };

    const handleTouchEnd = (e) => {
      // Stop squeezing immediately when finger lifted from screen
      this.trainingManager.setTouchSqueeze(false);
      if (this.hapticInterval) {
        clearInterval(this.hapticInterval);
        this.hapticInterval = null;
      }
    };

    const handleTouchMove = (e) => {
      if (e.target.closest('.modal-card') || e.target.closest('.top-bar')) return;
      if (!e.touches || e.touches.length === 0) return;

      const currentY = e.touches[0].clientY;
      const dy = currentY - this.lastTouchY;
      this.lastTouchY = currentY;

      // Swipe up: step forward toward fire; swipe down: step back
      if (dy < -4) {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        fwd.y = 0;
        fwd.normalize();
        if (this.camera.position.z > -1.9) {
          this.camera.position.addScaledVector(fwd, 0.05);
        }
      } else if (dy > 4) {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        fwd.y = 0;
        fwd.normalize();
        if (this.camera.position.z < 0.8) {
          this.camera.position.addScaledVector(fwd, -0.05);
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    // 2. MOUSE / DESKTOP TESTING FALLBACK
    window.addEventListener('mousedown', (e) => {
      if (e.target.closest('.modal-card') || e.target.closest('.top-bar') || e.target.closest('button')) {
        return;
      }

      const stage = this.trainingManager.currentStage;
      if (stage === TRAINING_STAGE.INSTRUCTION || stage === TRAINING_STAGE.PICKUP) {
        this.trainingManager.triggerPickup(this.camera.position, this.camera.quaternion);
      } else if (stage === TRAINING_STAGE.PIN_PULL) {
        this.trainingManager.triggerPinPull();
      } else if (stage === TRAINING_STAGE.SUPPRESSION || stage === TRAINING_STAGE.APPROACH_AIM) {
        this.trainingManager.setTouchSqueeze(true);
      }
    });

    window.addEventListener('mouseup', () => {
      this.trainingManager.setTouchSqueeze(false);
    });

    // 3. KEYBOARD SHORTCUTS FOR ACCESSIBILITY / SIMULATOR
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        if (this.extinguisher.state === EXTINGUISHER_STATE.HELD) {
          this.trainingManager.setTouchSqueeze(true);
        }
      } else if (e.key === 'p' || e.key === 'P') {
        this.trainingManager.triggerPinPull();
      } else if (e.key === 't' || e.key === 'T') {
        const modal = document.getElementById('test-modal');
        if (modal) modal.classList.toggle('active');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.trainingManager.setTouchSqueeze(false);
      }
    });
  }

  startLoop() {
    this.renderer.setAnimationLoop(() => this.renderFrame());
  }

  renderFrame() {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Process MediaPipe hand tracking frame at ~30 FPS
    this.mediaPipeThrottle += delta;
    if (this.mediaPipeThrottle >= 0.033) {
      this.handTracker.processFrame();
      this.mediaPipeThrottle = 0;
    }

    // 2. Update held extinguisher pose in HELD state
    if (this.extinguisher.state === EXTINGUISHER_STATE.HELD) {
      if (this.handTracker.isHandDetected) {
        // Physical hand in camera view
        this.extinguisher.updateHeldPose(
          this.handTracker.handWorldPos,
          this.handTracker.handWorldQuat,
          delta
        );
      } else {
        // First-person mobile camera rig: extinguisher moves naturally with the phone
        const fpPos = new THREE.Vector3(0.12, -0.19, -0.42).applyMatrix4(this.camera.matrixWorld);
        const fpQuat = this.camera.quaternion.clone();
        this.extinguisher.group.position.lerp(fpPos, Math.min(1, delta * 18));
        this.extinguisher.group.quaternion.slerp(fpQuat, Math.min(1, delta * 18));
      }
    }

    // 3. Update Fire simulation physics & flame particles
    this.fire.update(delta, elapsedTime);

    // 4. Update Spray system & calculate suppression intersection
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
