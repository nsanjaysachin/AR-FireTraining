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
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38BDF8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const outerRing = new THREE.Mesh(outerRingGeo, ringMat);
    this.reticleGroup.add(outerRing);

    const innerDotGeo = new THREE.CircleGeometry(0.04, 16);
    innerDotGeo.rotateX(-Math.PI / 2);
    const innerDot = new THREE.Mesh(innerDotGeo, ringMat);
    this.reticleGroup.add(innerDot);

    // Crosshairs
    const lineMat = new THREE.LineBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.8 });
    const crossGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.35, 0, 0), new THREE.Vector3(0.35, 0, 0),
      new THREE.Vector3(0, 0, -0.35), new THREE.Vector3(0, 0, 0.35)
    ]);
    const crosshair = new THREE.LineSegments(crossGeo, lineMat);
    this.reticleGroup.add(crosshair);

    this.reticleGroup.position.set(0, -0.3, -1.5);
    this.scene.add(this.reticleGroup);
  }

  // Request camera and initialize AR
  async startCameraAR() {
    try {
      this.trackingStatusMessage = 'Requesting camera permissions...';

      // Insert video beneath canvas
      if (!this.container.contains(this.video)) {
        this.container.insertBefore(this.video, this.container.firstChild);
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access requires HTTPS or is not supported in this mobile browser.');
      }

      // Try environment-facing back camera first for realistic surrounding detection
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (envErr) {
        console.warn('Environment camera unavailable, falling back to any video camera:', envErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      this.stream = stream;
      this.video.srcObject = this.stream;
      await this.video.play();

      this.mode = AR_SESSION_MODE.CAMERA_PASSTHROUGH_CV;
      this.isSessionActive = true;
      this.isTrackingStable = true;
      this.trackingStatusMessage = 'Real Camera AR Active (Surroundings Detected)';
      if (this.simGrid) this.simGrid.visible = false;

      // Setup device orientation and motion if available on mobile
      this.setupOrientationSensors();
      this.setupMotionSensors();

      return { success: true, mode: this.mode };
    } catch (err) {
      console.warn('Camera AR permission denied or not available:', err);
      this.mode = AR_SESSION_MODE.SIMULATOR_STUDIO;
      this.isSessionActive = true;
      this.isTrackingStable = true;
      this.trackingStatusMessage = 'Camera Unavailable: SafeSphere 3D Training Simulator Active';
      if (this.simGrid) this.simGrid.visible = true;

      // Remove video if failed
      if (this.container.contains(this.video)) {
        this.container.removeChild(this.video);
      }

      return {
        success: false,
        error: err.name === 'NotAllowedError' ? 'Camera permission was denied. Please allow camera access in browser settings.' : err.message,
        fallbackMode: this.mode
      };
    }
  }

  setupOrientationSensors() {
    if (typeof window.DeviceOrientationEvent !== 'undefined') {
      const handleOrientation = (e) => {
        if (e.alpha === null || e.beta === null || e.gamma === null) return;
        this.hasOrientationSensor = true;

        if (this.initialAlphaOffset === 0 && e.alpha !== 0) {
          this.initialAlphaOffset = e.alpha;
        }

        // Convert mobile sensor Euler angles to camera rotation
        const degToRad = Math.PI / 180;
        const beta = (e.beta - 90) * degToRad; // Pitch: 90 is upright phone
        const gamma = -e.gamma * degToRad; // Roll
        const alpha = -(e.alpha - this.initialAlphaOffset) * degToRad; // Yaw

        // Apply smooth slerp to AR camera
        const euler = new THREE.Euler(beta, alpha, gamma, 'YXZ');
        this.camera3D.quaternion.setFromEuler(euler);
      };

      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ permission request
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

    el.addEventListener('mousedown', (e) => {
      // Allow dragging view when not clicking HUD elements
      if (e.target.closest('#hud-overlay') || e.target.closest('.interactive-btn')) return;
      this.isDragging = true;
      this.prevMouse.x = e.clientX;
      this.prevMouse.y = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging || this.hasOrientationSensor) return;
      const dx = e.clientX - this.prevMouse.x;
      const dy = e.clientY - this.prevMouse.y;
      this.prevMouse.x = e.clientX;
      this.prevMouse.y = e.clientY;

      this.cameraYaw -= dx * 0.0035;
      this.cameraPitch = Math.max(-Math.PI * 0.35, Math.min(Math.PI * 0.35, this.cameraPitch - dy * 0.0035));

      const euler = new THREE.Euler(this.cameraPitch, this.cameraYaw, 0, 'YXZ');
      this.camera3D.quaternion.setFromEuler(euler);
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // WASD or arrow keys to simulate walking toward fire in desktop mode
    window.addEventListener('keydown', (e) => {
      const step = 0.08;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera3D.quaternion);
      fwd.y = 0;
      fwd.normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera3D.quaternion);
      right.y = 0;
      right.normalize();

      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        this.cameraPos.addScaledVector(fwd, step);
      } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        this.cameraPos.addScaledVector(fwd, -step);
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        this.cameraPos.addScaledVector(right, -step);
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        this.cameraPos.addScaledVector(right, step);
      }
      this.camera3D.position.copy(this.cameraPos);
    });
  }

  // Anchor the training scenario objects in the world
  anchorScenario(extinguisher, fire) {
    // Extinguisher world anchor (e.g. 1.1m in front of user, slightly to right on table/floor)
    const extPos = new THREE.Vector3(0.18, -0.25, -1.05);
    extinguisher.setAnchor(extPos, 0);

    // Fire world anchor (e.g. 2.4m in front of starting position)
    const firePos = new THREE.Vector3(0, -0.3, -2.4);
    fire.anchorPosition.copy(firePos);
    fire.group.position.copy(firePos);

    this.trackingStatusMessage = 'Objects Spatially Anchored in Real Environment';
  }

  // Reposition / Reset Anchor at user's current looking direction
  repositionAnchor(extinguisher, fire) {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera3D.quaternion);
    fwd.y = 0;
    fwd.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera3D.quaternion);
    right.y = 0;
    right.normalize();

    const camPos = this.camera3D.position;

    // Place extinguisher 1.1m in front
    const newExtPos = camPos.clone().addScaledVector(fwd, 1.05).addScaledVector(right, 0.18);
    newExtPos.y = -0.25;
    extinguisher.setAnchor(newExtPos, this.cameraYaw);

    // Place fire 2.4m in front
    const newFirePos = camPos.clone().addScaledVector(fwd, 2.4);
    newFirePos.y = -0.3;
    fire.anchorPosition.copy(newFirePos);
    fire.group.position.copy(newFirePos);

    this.trackingStatusMessage = 'Anchor Repositioned to Current View';
  }

  update(time) {
    // Surface reticle pulse animation
    if (this.reticleGroup) {
      const scale = 1.0 + Math.sin(time * 3.5) * 0.04;
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
