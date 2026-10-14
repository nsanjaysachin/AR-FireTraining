import * as THREE from 'three';

export const AR_SESSION_MODE = {
  WEBXR_IMMERSIVE_AR: 'WEBXR_IMMERSIVE_AR',
  CAMERA_PASSTHROUGH_CV: 'CAMERA_PASSTHROUGH_CV',
  SIMULATOR_STUDIO: 'SIMULATOR_STUDIO'
};

export class ARTrackingManager {
  constructor(canvasContainer, renderer, camera3D, scene) {
    this.container = canvasContainer;
    this.renderer = renderer;
    this.camera3D = camera3D;
    this.scene = scene;

    this.mode = AR_SESSION_MODE.CAMERA_PASSTHROUGH_CV;
    this.isSessionActive = false;
    this.isTrackingStable = true;
    this.trackingStatusMessage = 'Initializing AR Environment...';

    // Video stream for real camera pass-through
    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('autoplay', '');
    this.video.muted = true;
    this.video.style.position = 'absolute';
    this.video.style.top = '0';
    this.video.style.left = '0';
    this.video.style.width = '100%';
    this.video.style.height = '100%';
    this.video.style.objectFit = 'cover';
    this.video.style.zIndex = '0';
    this.video.style.pointerEvents = 'none';
    this.stream = null;

    // Device orientation sensor variables for mobile 6DoF AR simulation
    this.deviceOrientation = { alpha: 0, beta: 0, gamma: 0 };
    this.hasOrientationSensor = false;
    this.initialAlphaOffset = 0;

    // Placement reticle on detected floor surface
    this.buildSurfaceReticle();

    // World Anchor root group
    this.worldAnchor = new THREE.Group();
    this.worldAnchor.name = 'SafeSphere_WorldAnchor';
    this.scene.add(this.worldAnchor);

    // Desktop camera orbit/pan controls for desktop simulator
    this.isDragging = false;
    this.prevMouse = { x: 0, y: 0 };
    this.cameraYaw = 0;
    this.cameraPitch = 0;
    this.cameraPos = new THREE.Vector3(0, 0.4, 0);

    this.setupDesktopControls();

    // Virtual training bay floor grid for Simulator mode
    this.simGrid = new THREE.GridHelper(12, 24, 0x38BDF8, 0x1E293B);
    this.simGrid.position.y = -0.30;
    this.simGrid.visible = false;
    this.scene.add(this.simGrid);
  }

  buildSurfaceReticle() {
    // Holographic placement ring on detected surface
    this.reticleGroup = new THREE.Group();
    this.reticleGroup.name = 'SurfaceReticle';

    const outerRingGeo = new THREE.RingGeometry(0.25, 0.28, 32);
    outerRingGeo.rotateX(-Math.PI / 2);
    this.reticleRingMat = new THREE.MeshBasicMaterial({
      color: 0x38BDF8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const outerRing = new THREE.Mesh(outerRingGeo, this.reticleRingMat);
    this.reticleGroup.add(outerRing);

    const innerDotGeo = new THREE.CircleGeometry(0.04, 16);
    innerDotGeo.rotateX(-Math.PI / 2);
    const innerDot = new THREE.Mesh(innerDotGeo, this.reticleRingMat);
    this.reticleGroup.add(innerDot);

    // Crosshairs
    this.reticleLineMat = new THREE.LineBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.85 });
    const crossGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.35, 0, 0), new THREE.Vector3(0.35, 0, 0),
      new THREE.Vector3(0, 0, -0.35), new THREE.Vector3(0, 0, 0.35)
    ]);
    const crosshair = new THREE.LineSegments(crossGeo, this.reticleLineMat);
    this.reticleGroup.add(crosshair);

    // Dynamic scanning radar sweep wave
    const radarGeo = new THREE.RingGeometry(0.06, 0.08, 32);
    radarGeo.rotateX(-Math.PI / 2);
    this.radarMat = new THREE.MeshBasicMaterial({
      color: 0x38BDF8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    this.radarMesh = new THREE.Mesh(radarGeo, this.radarMat);
    this.reticleGroup.add(this.radarMesh);

    this.reticleGroup.position.set(0, -0.3, -1.5);
    this.scene.add(this.reticleGroup);
  }

  setReticleState(state = 'scanning') {
    if (!this.reticleRingMat || !this.reticleLineMat) return;
    if (state === 'locked') {
      this.reticleRingMat.color.setHex(0x10B981); // Emerald Green
      this.reticleLineMat.color.setHex(0x10B981);
      if (this.radarMat) this.radarMat.color.setHex(0x10B981);
    } else {
      this.reticleRingMat.color.setHex(0x38BDF8); // Tech Cyan
      this.reticleLineMat.color.setHex(0x38BDF8);
      if (this.radarMat) this.radarMat.color.setHex(0x38BDF8);
    }
  }

  // Initialize pure 3D VR room game session (no camera needed)
  async startCameraAR() {
    this.mode = AR_SESSION_MODE.SIMULATOR_STUDIO;
    this.isSessionActive = true;
    this.isTrackingStable = true;
    this.trackingStatusMessage = 'SafeSphere VR 3D Room Game Active';
    if (this.simGrid) this.simGrid.visible = false;

    // Ensure no video element is inserted
    if (this.container && this.container.contains(this.video)) {
      this.container.removeChild(this.video);
    }

    // Setup device orientation and motion if available on mobile
    this.setupOrientationSensors();
    this.setupMotionSensors();

    return { success: true, mode: this.mode };
  }

  setupOrientationSensors() {
    if (typeof window.DeviceOrientationEvent !== 'undefined') {
      const degToRad = Math.PI / 180;
      const zee = new THREE.Vector3(0, 0, 1);
      const euler = new THREE.Euler();
      const q0 = new THREE.Quaternion();
      const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // - PI/2 around the x-axis
      let baseAlpha = null;

      const handleOrientation = (e) => {
        if (e.alpha === null || e.beta === null || e.gamma === null) return;
        this.hasOrientationSensor = true;

        if (baseAlpha === null && e.alpha !== null) {
          baseAlpha = e.alpha;
        }

        const alpha = ((e.alpha || 0) - (baseAlpha || 0)) * degToRad;
        const beta = (e.beta || 0) * degToRad;
        const gamma = (e.gamma || 0) * degToRad;
        const orient = ((window.screen && window.screen.orientation && window.screen.orientation.angle) || window.orientation || 0) * degToRad;

        // DeviceOrientation standard transformation:
        euler.set(beta, alpha, -gamma, 'YXZ');
        this.camera3D.quaternion.setFromEuler(euler);
        this.camera3D.quaternion.multiply(q1); // orient out back camera
        this.camera3D.quaternion.multiply(q0.setFromAxisAngle(zee, -orient));
      };

      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(res => {
            if (res === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation);
            }
          })
          .catch(() => {});
      } else {
        window.addEventListener('deviceorientation', handleOrientation);
      }
    }
  }

  setupMotionSensors() {
    if (typeof window.DeviceMotionEvent !== 'undefined') {
      let lastStepTime = 0;
      let lastAccMag = 9.8;

      const handleMotion = (e) => {
        // Accelerometer physical step detection (walking toward fire)
        const acc = e.accelerationIncludingGravity || e.acceleration;
        if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
          const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
          const deltaAcc = Math.abs(mag - lastAccMag);
          lastAccMag = mag;

          const now = performance.now();
          // Step detection: acceleration surge > 2.0 m/s^2 and min 320ms between steps
          if (deltaAcc > 2.0 && (now - lastStepTime) > 320) {
            lastStepTime = now;
            // Move camera forward in direction of camera view
            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera3D.quaternion);
            fwd.y = 0;
            fwd.normalize();
            // Standoff clamp: user can step up to 1.7m from fire
            if (this.cameraPos.z > -1.8) {
              this.cameraPos.addScaledVector(fwd, 0.25);
              this.camera3D.position.copy(this.cameraPos);
            }
          }
        }
      };

      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
          .then(res => {
            if (res === 'granted') {
              window.addEventListener('devicemotion', handleMotion);
            }
          })
          .catch(() => {});
      } else {
        window.addEventListener('devicemotion', handleMotion);
      }
    }
  }

  setupDesktopControls() {
    const el = this.container;
    this.moveInput = { forward: false, backward: false, left: false, right: false };

    el.addEventListener('mousedown', (e) => {
      // Allow dragging view when not clicking HUD elements
      if (e.target.closest('#hud-overlay') || e.target.closest('.interactive-btn')) return;
      this.isDragging = true;
      this.prevMouse.x = e.clientX;
      this.prevMouse.y = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevMouse.x;
      const dy = e.clientY - this.prevMouse.y;
      this.prevMouse.x = e.clientX;
      this.prevMouse.y = e.clientY;

      this.cameraYaw -= dx * 0.0035;
      this.cameraPitch = Math.max(-Math.PI * 0.38, Math.min(Math.PI * 0.38, this.cameraPitch - dy * 0.0035));

      const euler = new THREE.Euler(this.cameraPitch, this.cameraYaw, 0, 'YXZ');
      this.camera3D.quaternion.setFromEuler(euler);
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // WASD or arrow keys keyboard state
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') this.moveInput.forward = true;
      else if (k === 's' || k === 'arrowdown') this.moveInput.backward = true;
      else if (k === 'a' || k === 'arrowleft') this.moveInput.left = true;
      else if (k === 'd' || k === 'arrowright') this.moveInput.right = true;
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') this.moveInput.forward = false;
      else if (k === 's' || k === 'arrowdown') this.moveInput.backward = false;
      else if (k === 'a' || k === 'arrowleft') this.moveInput.left = false;
      else if (k === 'd' || k === 'arrowright') this.moveInput.right = false;
    });
  }

  setMoveInput(dir, isPressed) {
    if (!this.moveInput) this.moveInput = { forward: false, backward: false, left: false, right: false };
    if (dir === 'w') this.moveInput.forward = isPressed;
    else if (dir === 's') this.moveInput.backward = isPressed;
    else if (dir === 'a') this.moveInput.left = isPressed;
    else if (dir === 'd') this.moveInput.right = isPressed;
  }

  // Anchor the training scenario objects in the world
  anchorScenario(extinguisher, fire) {
    const extPos = new THREE.Vector3(0.18, -0.25, -1.05);
    extinguisher.setAnchor(extPos, 0);

    const firePos = new THREE.Vector3(0, -0.30, -2.0);
    fire.setAnchor(firePos);

    this.trackingStatusMessage = 'Objects Spatially Anchored in Real Environment';
  }

  // Reposition / Reset Anchor at user's current looking direction
  repositionAnchor(extinguisher, fire) {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera3D.quaternion);
    fwd.y = 0;
    if (fwd.lengthSq() < 0.001) {
      fwd.set(0, 0, -1);
    } else {
      fwd.normalize();
    }

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera3D.quaternion);
    right.y = 0;
    if (right.lengthSq() < 0.001) {
      right.set(1, 0, 0);
    } else {
      right.normalize();
    }

    const camPos = this.camera3D.position;

    // Place extinguisher 1.05m in front, slightly to right on floor
    const newExtPos = camPos.clone().addScaledVector(fwd, 1.05).addScaledVector(right, 0.18);
    newExtPos.y = -0.25;
    extinguisher.setAnchor(newExtPos, this.cameraYaw);

    // Place fire 2.0m in front directly on the floor plane
    const newFirePos = camPos.clone().addScaledVector(fwd, 2.0);
    newFirePos.y = -0.30;
    fire.setAnchor(newFirePos);

    this.trackingStatusMessage = 'Anchor Locked to Room Floor';
  }

  update(time, delta = 0.016) {
    // Process continuous first-person walking movement
    if (this.moveInput) {
      const moveSpeed = 2.4 * delta;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera3D.quaternion);
      fwd.y = 0;
      if (fwd.lengthSq() > 0.001) fwd.normalize();
      else fwd.set(0, 0, -1);

      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera3D.quaternion);
      right.y = 0;
      if (right.lengthSq() > 0.001) right.normalize();
      else right.set(1, 0, 0);

      if (this.moveInput.forward) {
        this.cameraPos.addScaledVector(fwd, moveSpeed);
      }
      if (this.moveInput.backward) {
        this.cameraPos.addScaledVector(fwd, -moveSpeed);
      }
      if (this.moveInput.left) {
        this.cameraPos.addScaledVector(right, -moveSpeed);
      }
      if (this.moveInput.right) {
        this.cameraPos.addScaledVector(right, moveSpeed);
      }

      // Clamped within 3D room boundaries
      this.cameraPos.x = Math.max(-3.5, Math.min(3.5, this.cameraPos.x));
      this.cameraPos.z = Math.max(-3.6, Math.min(2.5, this.cameraPos.z));
      this.camera3D.position.copy(this.cameraPos);
    }

    // Surface reticle floor placement & radar sweep animation
    if (this.reticleGroup && this.reticleGroup.visible) {
      if (this.camera3D) {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera3D.quaternion);
        fwd.y = 0;
        if (fwd.lengthSq() > 0.001) fwd.normalize();
        else fwd.set(0, 0, -1);

        const targetPos = this.camera3D.position.clone().addScaledVector(fwd, 1.6);
        targetPos.y = -0.30;
        this.reticleGroup.position.lerp(targetPos, 0.12);
      }

      // Radar pulse wave expansion
      if (this.radarMesh && this.radarMat) {
        const radarProgress = (time * 1.6) % 1.0;
        const radarScale = 0.6 + radarProgress * 3.8;
        this.radarMesh.scale.set(radarScale, radarScale, radarScale);
        this.radarMat.opacity = (1.0 - radarProgress) * 0.75;
      }

      const scale = 1.0 + Math.sin(time * 3.5) * 0.05;
      this.reticleGroup.scale.set(scale, scale, scale);
    }
  }

  // Check WebXR AR capability
  static async checkWebXRSupport() {
    if (navigator.xr && navigator.xr.isSessionSupported) {
      try {
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        return supported;
      } catch (_) {
        return false;
      }
    }
    return false;
  }
}
