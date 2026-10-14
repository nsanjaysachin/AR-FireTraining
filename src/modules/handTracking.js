import * as THREE from 'three';

export const TRACKING_MODE = {
  MEDIAPIPE_VISION: 'MEDIAPIPE_VISION',
  SIMULATOR_FALLBACK: 'SIMULATOR_FALLBACK'
};

const BONE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17]
];

export class HandTrackingManager {
  constructor(videoElement, camera3D, scene) {
    this.video = videoElement;
    this.camera3D = camera3D;
    this.scene = scene;

    this.mode = TRACKING_MODE.MEDIAPIPE_VISION;
    this.isHandDetected = false;
    this.isGrabbing = false;
    this.pinchDistance = 1.0;

    // 3D Hand world position and orientation
    this.handWorldPos = new THREE.Vector3(0, 0, -1);
    this.handWorldQuat = new THREE.Quaternion();
    this.wristPos = new THREE.Vector3();
    this.indexTipPos = new THREE.Vector3();
    this.thumbTipPos = new THREE.Vector3();

    // Hysteresis thresholds for robust grab detection
    this.grabThreshold = 0.065; // ~6.5cm normalized pinch distance
    this.releaseThreshold = 0.098; // ~9.8cm release distance

    // Visual hand skeleton in 3D
    this.handVisualGroup = new THREE.Group();
    this.handVisualGroup.name = 'HandVisual';
    this.scene.add(this.handVisualGroup);
    this.buildHandVisuals();

    // MediaPipe instance
    this.hands = null;
    this.cameraUtils = null;
    this.isMediaPipeReady = false;
    this.mediaPipeError = null;

    // Simulator virtual hand state
    this.simHandPos = new THREE.Vector3(0, -0.2, -0.85);
    this.simIsGrabbing = false;
    this.simIsSqueezing = false;
  }

  buildHandVisuals() {
    // 21 joint sphere meshes
    this.jointMeshes = [];
    const jointGeo = new THREE.SphereGeometry(0.012, 12, 12);
    const jointMat = new THREE.MeshBasicMaterial({
      color: 0x38BDF8,
      transparent: true,
      opacity: 0.85
    });

    for (let i = 0; i < 21; i++) {
      const mesh = new THREE.Mesh(jointGeo, jointMat.clone());
      mesh.visible = false;
      this.jointMeshes.push(mesh);
      this.handVisualGroup.add(mesh);
    }

    // Highlight thumb & index tip
    this.jointMeshes[4].material.color.setHex(0xFACC15); // Thumb tip
    this.jointMeshes[8].material.color.setHex(0xFACC15); // Index tip

    // Palm grab indicator reticle
    const reticleGeo = new THREE.RingGeometry(0.025, 0.035, 24);
    this.reticleMat = new THREE.MeshBasicMaterial({
      color: 0x38BDF8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    this.reticle = new THREE.Mesh(reticleGeo, this.reticleMat);
    this.reticle.visible = false;
    this.handVisualGroup.add(this.reticle);

    // Bone lines connecting joints
    this.boneGeo = new THREE.BufferGeometry();
    const bonePositions = new Float32Array(BONE_CONNECTIONS.length * 2 * 3);
    this.boneGeo.setAttribute('position', new THREE.BufferAttribute(bonePositions, 3));
    this.boneMat = new THREE.LineBasicMaterial({
      color: 0x38BDF8,
      transparent: true,
      opacity: 0.65,
      linewidth: 2
    });
    this.bonesMesh = new THREE.LineSegments(this.boneGeo, this.boneMat);
    this.bonesMesh.visible = false;
    this.handVisualGroup.add(this.bonesMesh);
  }

  // Initialize MediaPipe Hands
  async initMediaPipe() {
    try {
      // Check if global Hands or imported Hands is available
      let HandsConstructor = window.Hands;

      if (!HandsConstructor) {
        // Dynamically load hands script if not yet in window
        await this.loadScript('/mediapipe/hands/hands.js', 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
        HandsConstructor = window.Hands;
      }

      if (!HandsConstructor) {
        throw new Error('MediaPipe Hands library could not be loaded.');
      }

      this.hands = new HandsConstructor({
        locateFile: (file) => {
          // Prefer local assets copied to public/mediapipe/hands, fallback to CDN
          return `/mediapipe/hands/${file}`;
        }
      });

      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65
      });

      this.hands.onResults((results) => this.onHandResults(results));

      this.isMediaPipeReady = true;
      console.log('SafeSphere MediaPipe Hands initialized successfully.');
      return true;
    } catch (err) {
      console.warn('MediaPipe initialization warning (falling back to simulator if camera fails):', err);
      this.mediaPipeError = err.message;
      return false;
    }
  }

  loadScript(localUrl, cdnUrl) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = localUrl;
      s.onload = () => resolve();
      s.onerror = () => {
        // Try fallback CDN
        const s2 = document.createElement('script');
        s2.src = cdnUrl;
        s2.crossOrigin = 'anonymous';
        s2.onload = () => resolve();
        s2.onerror = () => resolve(); // continue gracefully
        document.head.appendChild(s2);
      };
      document.head.appendChild(s);
    });
  }

  // Process video frame through MediaPipe
  async processFrame() {
    if (this.mode === TRACKING_MODE.SIMULATOR_FALLBACK) return;
    if (this.isMediaPipeReady && this.hands && this.video && this.video.readyState >= 2) {
      try {
        await this.hands.send({ image: this.video });
      } catch (e) {
        // Drop frame safely
      }
    }
  }

  // Handle MediaPipe 21 Landmark Results
  onHandResults(results) {
    if (this.mode === TRACKING_MODE.SIMULATOR_FALLBACK) return;

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.isHandDetected = false;
      this.hideVisuals();
      return;
    }

    this.isHandDetected = true;
    const landmarks = results.multiHandLandmarks[0];

    // Project landmark coordinates into 3D world space relative to AR camera
    const camera = this.camera3D;
    const fov = camera.fov * (Math.PI / 180);
    const aspect = camera.aspect;

    // Use landmarks 0 (wrist), 4 (thumb tip), 8 (index tip), 9 (middle MCP/palm)
    for (let i = 0; i < 21; i++) {
      const lm = landmarks[i];
      // MediaPipe coords: x (0 left, 1 right), y (0 top, 1 bottom), z (depth)
      // Convert to normalized device coordinates (-1 to 1)
      // Note: Video is mirrored or camera facing user/environment
      const ndcX = (1.0 - lm.x) * 2 - 1; // Un-mirror for natural AR reach
      const ndcY = -(lm.y * 2 - 1);
      // Estimate depth from landmark scale / depth (approx 0.4m to 1.2m)
      const estimatedDist = 0.75 + (lm.z || 0) * 0.8;

      // Project onto frustum plane at estimatedDist
      const worldY = Math.tan(fov / 2) * estimatedDist * ndcY;
      const worldX = Math.tan(fov / 2) * estimatedDist * aspect * ndcX;
      const localPos = new THREE.Vector3(worldX, worldY, -estimatedDist);

      // Transform to world space
      const jointWorld = localPos.applyMatrix4(camera.matrixWorld);

      this.jointMeshes[i].position.copy(jointWorld);
      this.jointMeshes[i].visible = true;
    }

    // Palm center (landmark 9 - middle MCP)
    const palmMesh = this.jointMeshes[9];
    this.handWorldPos.copy(palmMesh.position);

    // Thumb tip (4) & Index tip (8)
    const thumbPos = this.jointMeshes[4].position;
    const indexPos = this.jointMeshes[8].position;
    this.thumbTipPos.copy(thumbPos);
    this.indexTipPos.copy(indexPos);

    // Compute 3D pinch distance
    this.pinchDistance = thumbPos.distanceTo(indexPos);

    // Compute finger curl for fist grasp & squeeze detection
    const d8 = this.jointMeshes[8].position.distanceTo(palmMesh.position);
    const d12 = this.jointMeshes[12].position.distanceTo(palmMesh.position);
    const d16 = this.jointMeshes[16].position.distanceTo(palmMesh.position);
    const d20 = this.jointMeshes[20].position.distanceTo(palmMesh.position);
    this.fingerCurl = (d8 + d12 + d16 + d20) / 4;

    const isPinching = this.pinchDistance < this.grabThreshold;
    const isFist = this.fingerCurl < 0.105;

    // Hysteresis grab state: triggered by pinch or fist
    if (!this.isGrabbing) {
      if (isPinching || isFist) {
        this.isGrabbing = true;
      }
    } else {
      if (this.pinchDistance > this.releaseThreshold && this.fingerCurl > 0.14) {
        this.isGrabbing = false;
      }
    }

    // Physical squeeze gesture: clenching fist tightly while holding
    this.isSqueezingGesture = this.isGrabbing && (this.fingerCurl < 0.088 || isPinching);

    // Hand orientation from wrist (0) to middle finger base (9)
    const wristPos = this.jointMeshes[0].position;
    const handForward = palmMesh.position.clone().sub(wristPos).normalize();
    const handUp = thumbPos.clone().sub(indexPos).cross(handForward).normalize();
    const rotMatrix = new THREE.Matrix4().lookAt(wristPos, palmMesh.position, handUp);
    this.handWorldQuat.setFromRotationMatrix(rotMatrix);

    // Update palm reticle
    this.reticle.position.copy(this.handWorldPos);
    this.reticle.quaternion.copy(camera.quaternion);
    this.reticle.visible = true;
    this.reticleMat.color.setHex(this.isGrabbing ? 0x00E676 : 0x38BDF8);

    // Update bone line vertices
    if (this.boneGeo && this.bonesMesh) {
      const bonePosArray = this.boneGeo.attributes.position.array;
      for (let b = 0; b < BONE_CONNECTIONS.length; b++) {
        const [startIdx, endIdx] = BONE_CONNECTIONS[b];
        const p1 = this.jointMeshes[startIdx].position;
        const p2 = this.jointMeshes[endIdx].position;
        bonePosArray[b * 6] = p1.x;
        bonePosArray[b * 6 + 1] = p1.y;
        bonePosArray[b * 6 + 2] = p1.z;
        bonePosArray[b * 6 + 3] = p2.x;
        bonePosArray[b * 6 + 4] = p2.y;
        bonePosArray[b * 6 + 5] = p2.z;
      }
      this.boneGeo.attributes.position.needsUpdate = true;
      this.bonesMesh.visible = true;
      this.boneMat.color.setHex(this.isGrabbing ? 0x00E676 : 0x38BDF8);
    }
  }

  hideVisuals() {
    this.jointMeshes.forEach(m => m.visible = false);
    if (this.reticle) this.reticle.visible = false;
    if (this.bonesMesh) this.bonesMesh.visible = false;
  }

  // Fallback simulator controls (Mouse / Touch / Headless test control)
  setSimulatorPose(x, y, z, isGrabbing, isSqueezing = false) {
    this.simHandPos.set(x, y, z);
    this.simIsGrabbing = isGrabbing;
    this.simIsSqueezing = isSqueezing;

    if (this.mode === TRACKING_MODE.SIMULATOR_FALLBACK) {
      this.isHandDetected = true;
      this.handWorldPos.copy(this.simHandPos);
      this.isGrabbing = this.simIsGrabbing;

      // Update reticle for simulator
      this.reticle.position.copy(this.simHandPos);
      this.reticle.quaternion.copy(this.camera3D.quaternion);
      this.reticle.visible = true;
      this.reticleMat.color.setHex(this.isGrabbing ? 0x00E676 : 0xFACC15);

      // Show simulator indicator palm sphere
      this.jointMeshes[9].position.copy(this.simHandPos);
      this.jointMeshes[9].visible = true;
      this.jointMeshes[9].material.color.setHex(this.isGrabbing ? 0x00E676 : 0xFACC15);
    }
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === TRACKING_MODE.SIMULATOR_FALLBACK) {
      this.hideVisuals();
    }
  }

  getInteractionState(extinguisher) {
    const inRange = extinguisher.isHandInInteractionZone(this.handWorldPos);
    const isNearPin = extinguisher.isHandNearPin ? (extinguisher.isHandNearPin(this.indexTipPos) || extinguisher.isHandNearPin(this.handWorldPos)) : false;
    return {
      mode: this.mode,
      isHandDetected: this.isHandDetected,
      inRange: inRange,
      isNearPin: isNearPin,
      isGrabbing: this.isGrabbing,
      isSqueezingGesture: !!this.isSqueezingGesture,
      pinchDistance: this.pinchDistance,
      fingerCurl: this.fingerCurl || 0.2,
      handPos: this.handWorldPos,
      handQuat: this.handWorldQuat
    };
  }
}
