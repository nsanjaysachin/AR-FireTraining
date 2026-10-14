import * as THREE from 'three';
import { soundFx } from './audio.js';

export const EXTINGUISHER_STATE = {
  WORLD_ANCHORED: 'WORLD_ANCHORED',
  HELD: 'HELD'
};

export class FireExtinguisher {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'FireExtinguisher';

    this.state = EXTINGUISHER_STATE.WORLD_ANCHORED;
    this.isPinPulled = false;
    this.isSqueezing = false;
    this.inInteractionRange = false;

    // Interaction geometry references
    this.handleWorldPos = new THREE.Vector3();
    this.interactionRadius = 0.28; // ~28cm reach sphere around handle
    this.gripOffset = new THREE.Vector3(0, -0.22, 0.08); // Offset from hand palm to extinguisher center
    this.sprayOrigin = new THREE.Vector3();
    this.sprayDirection = new THREE.Vector3();

    this.anchorPosition = new THREE.Vector3(0, 0, -1.2);
    this.anchorRotation = new THREE.Euler(0, 0, 0);

    // Dynamic parts
    this.leverMesh = null;
    this.pinGroup = null;
    this.haloMesh = null;
    this.nozzleTip = null;
    this.aimGuideLine = null;

    this.buildModel();
  }

  // Generate realistic PASS instructions & safety label texture via Canvas
  createLabelTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // White background label with rounded corners
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 1024, 1024);

    // Border
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#D32F2F';
    ctx.strokeRect(20, 20, 984, 984);

    // Header banner
    ctx.fillStyle = '#D32F2F';
    ctx.fillRect(20, 20, 984, 160);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 64px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('INSTRUCTIONS', 512, 105);

    ctx.font = 'bold 36px "Outfit", sans-serif';
    ctx.fillText('DRY CHEMICAL FIRE EXTINGUISHER', 512, 155);

    // PASS Steps
    const steps = [
      { letter: 'P', title: 'PULL PIN', desc: 'Hold upright, pull ring pin', color: '#1E88E5' },
      { letter: 'A', title: 'AIM BASE', desc: 'Aim nozzle at base of fire', color: '#E53935' },
      { letter: 'S', title: 'SQUEEZE', desc: 'Squeeze lever fully', color: '#FB8C00' },
      { letter: 'S', title: 'SWEEP', desc: 'Sweep nozzle side to side', color: '#43A047' }
    ];

    steps.forEach((step, idx) => {
      const y = 240 + idx * 140;

      // Letter badge
      ctx.fillStyle = step.color;
      ctx.beginPath();
      ctx.arc(140, y + 40, 50, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 58px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(step.letter, 140, y + 60);

      // Text
      ctx.fillStyle = '#1A202C';
      ctx.font = 'bold 44px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(step.title, 220, y + 36);

      ctx.fillStyle = '#4A5568';
      ctx.font = '32px "Outfit", sans-serif';
      ctx.fillText(step.desc, 220, y + 78);

      // Separator
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(80, y + 115);
      ctx.lineTo(940, y + 115);
      ctx.stroke();
    });

    // Rating and warning footer
    ctx.fillStyle = '#D32F2F';
    ctx.font = 'bold 40px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CLASSIFICATION 2A : 10B : C', 512, 850);

    ctx.fillStyle = '#718096';
    ctx.font = '28px "Outfit", sans-serif';
    ctx.fillText('SafeSphere AR Interactive Training System', 512, 910);
    ctx.fillText('Educational Prototype — Solvethon Edition', 512, 950);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    return texture;
  }

  createGaugeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Outer face
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();

    // Red recharge zone (left)
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.arc(128, 128, 110, Math.PI * 0.9, Math.PI * 1.25);
    ctx.closePath();
    ctx.fill();

    // Green operating zone (middle top)
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.arc(128, 128, 110, Math.PI * 1.25, Math.PI * 1.75);
    ctx.closePath();
    ctx.fill();

    // Red overpressure zone (right)
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.arc(128, 128, 110, Math.PI * 1.75, Math.PI * 2.1);
    ctx.closePath();
    ctx.fill();

    // Center pivot
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(128, 128, 18, 0, Math.PI * 2);
    ctx.fill();

    // Needle in green zone
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(128, 40);
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
  }

  buildModel() {
    // 1. Main Cylinder Body
    const cylinderRadius = 0.075;
    const cylinderHeight = 0.36;
    const redPaintMaterial = new THREE.MeshStandardMaterial({
      color: 0xD32F2F,
      roughness: 0.28,
      metalness: 0.18
    });

    const cylinderGeo = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 32);
    const cylinder = new THREE.Mesh(cylinderGeo, redPaintMaterial);
    cylinder.position.y = cylinderHeight / 2;
    cylinder.castShadow = true;
    cylinder.receiveShadow = true;
    this.group.add(cylinder);

    // Top Dome
    const domeGeo = new THREE.SphereGeometry(cylinderRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const topDome = new THREE.Mesh(domeGeo, redPaintMaterial);
    topDome.position.y = cylinderHeight;
    this.group.add(topDome);

    // Bottom Base Ring
    const baseGeo = new THREE.CylinderGeometry(cylinderRadius * 1.04, cylinderRadius * 1.04, 0.03, 32);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1A202C, roughness: 0.8 });
    const baseRing = new THREE.Mesh(baseGeo, baseMat);
    baseRing.position.y = 0.015;
    this.group.add(baseRing);

    // Label wrap
    const labelGeo = new THREE.CylinderGeometry(cylinderRadius * 1.002, cylinderRadius * 1.002, 0.24, 32, 1, true, -Math.PI * 0.65, Math.PI * 1.3);
    const labelMat = new THREE.MeshStandardMaterial({
      map: this.createLabelTexture(),
      roughness: 0.4,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.y = cylinderHeight * 0.52;
    this.group.add(label);

    // 2. Brass Neck & Valve Body
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xDEB887,
      roughness: 0.35,
      metalness: 0.85
    });
    const neckGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.05, 24);
    const neck = new THREE.Mesh(neckGeo, brassMat);
    neck.position.y = cylinderHeight + cylinderRadius + 0.02;
    this.group.add(neck);

    // Valve Block
    const valveGeo = new THREE.BoxGeometry(0.048, 0.045, 0.052);
    const valveBlock = new THREE.Mesh(valveGeo, brassMat);
    valveBlock.position.y = cylinderHeight + cylinderRadius + 0.055;
    this.group.add(valveBlock);

    // 3. Pressure Gauge
    const gaugeBodyGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.015, 24);
    gaugeBodyGeo.rotateX(Math.PI / 2);
    const gaugeBody = new THREE.Mesh(gaugeBodyGeo, brassMat);
    gaugeBody.position.set(-0.034, cylinderHeight + cylinderRadius + 0.06, 0.02);
    this.group.add(gaugeBody);

    const gaugeFaceGeo = new THREE.CircleGeometry(0.016, 24);
    const gaugeFaceMat = new THREE.MeshBasicMaterial({ map: this.createGaugeTexture() });
    const gaugeFace = new THREE.Mesh(gaugeFaceGeo, gaugeFaceMat);
    gaugeFace.position.set(-0.034, cylinderHeight + cylinderRadius + 0.06, 0.028);
    this.group.add(gaugeFace);

    // 4. Fixed Carrying Handle (Black Metal)
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x1E293B,
      roughness: 0.6,
      metalness: 0.5
    });
    const handleGeo = new THREE.BoxGeometry(0.024, 0.014, 0.14);
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(0, cylinderHeight + cylinderRadius + 0.075, -0.04);
    this.group.add(handle);

    // Handle support bracket
    const handleBracketGeo = new THREE.BoxGeometry(0.024, 0.045, 0.014);
    const handleBracket = new THREE.Mesh(handleBracketGeo, handleMat);
    handleBracket.position.set(0, cylinderHeight + cylinderRadius + 0.05, -0.10);
    this.group.add(handleBracket);

    // 5. Squeeze Lever (Movable, pivots at front)
    this.leverPivot = new THREE.Group();
    this.leverPivot.position.set(0, cylinderHeight + cylinderRadius + 0.088, 0.02);
    const leverGeo = new THREE.BoxGeometry(0.022, 0.012, 0.15);
    this.leverMesh = new THREE.Mesh(leverGeo, handleMat);
    this.leverMesh.position.set(0, 0.015, -0.065);
    this.leverMesh.rotation.x = -0.08;
    this.leverPivot.add(this.leverMesh);
    this.group.add(this.leverPivot);

    // 6. Safety Pin & Tamper Seal Ring
    this.pinGroup = new THREE.Group();
    this.pinGroup.position.set(0.025, cylinderHeight + cylinderRadius + 0.085, -0.02);

    const pinShaftGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.05, 12);
    pinShaftGeo.rotateZ(Math.PI / 2);
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.95, roughness: 0.15 });
    const pinShaft = new THREE.Mesh(pinShaftGeo, steelMat);
    this.pinGroup.add(pinShaft);

    // Ring
    const ringGeo = new THREE.TorusGeometry(0.018, 0.003, 12, 24);
    const ring = new THREE.Mesh(ringGeo, steelMat);
    ring.position.x = 0.03;
    ring.rotation.y = Math.PI / 2;
    this.pinGroup.add(ring);

    // Yellow Plastic Tamper Ribbon / Pull-tab
    const sealGeo = new THREE.BoxGeometry(0.003, 0.04, 0.014);
    const yellowSealMat = new THREE.MeshStandardMaterial({ color: 0xFACC15, roughness: 0.5 });
    const seal = new THREE.Mesh(sealGeo, yellowSealMat);
    seal.position.set(0.03, -0.025, 0);
    this.pinGroup.add(seal);

    this.group.add(this.pinGroup);

    // 7. Reinforced Flexible Hose & Nozzle
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.025, cylinderHeight + cylinderRadius + 0.05, 0.01),
      new THREE.Vector3(0.09, cylinderHeight + 0.08, 0.03),
      new THREE.Vector3(0.08, cylinderHeight * 0.45, 0.07),
      new THREE.Vector3(0.02, cylinderHeight * 0.35, 0.15),
      new THREE.Vector3(0, cylinderHeight * 0.38, 0.22)
    ]);
    const hoseGeo = new THREE.TubeGeometry(hoseCurve, 32, 0.009, 12, false);
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.85 });
    const hose = new THREE.Mesh(hoseGeo, hoseMat);
    this.group.add(hose);

    // Nozzle Cone (Aiming tip)
    const nozzleGroup = new THREE.Group();
    nozzleGroup.position.copy(new THREE.Vector3(0, cylinderHeight * 0.38, 0.22));

    const nozzleGeo = new THREE.CylinderGeometry(0.014, 0.007, 0.065, 16);
    nozzleGeo.rotateX(Math.PI / 2);
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.5, metalness: 0.2 });
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzleGroup.add(nozzle);

    // Nozzle tip marker for spray particles
    this.nozzleTip = new THREE.Object3D();
    this.nozzleTip.position.set(0, 0, 0.04);
    nozzleGroup.add(this.nozzleTip);

    // Aim Laser / Collimator guide line (subtle training assist)
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0.04),
      new THREE.Vector3(0, 0, 3.8)
    ]);
    this.aimGuideMat = new THREE.LineDashedMaterial({
      color: 0x38BDF8,
      dashSize: 0.08,
      gapSize: 0.04,
      transparent: true,
      opacity: 0.75,
      linewidth: 2
    });
    this.aimGuideLine = new THREE.Line(lineGeo, this.aimGuideMat);
    this.aimGuideLine.computeLineDistances();
    this.aimGuideLine.visible = false;
    nozzleGroup.add(this.aimGuideLine);

    // Aim target lock indicator ring at 2.2m distance
    const lockRingGeo = new THREE.RingGeometry(0.08, 0.095, 24);
    this.lockRingMat = new THREE.MeshBasicMaterial({
      color: 0x38BDF8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    this.lockRing = new THREE.Mesh(lockRingGeo, this.lockRingMat);
    this.lockRing.position.set(0, 0, 2.2);
    nozzleGroup.add(this.lockRing);

    this.group.add(nozzleGroup);

    // 8. Interaction Halo / Hover Indicator around handle
    const haloGeo = new THREE.RingGeometry(0.18, 0.22, 32);
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x00E676,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0
    });
    this.haloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.haloMesh.position.y = cylinderHeight + cylinderRadius + 0.08;
    this.group.add(this.haloMesh);

    // Store handle world center reference point
    this.handleLocalPos = new THREE.Vector3(0, cylinderHeight + cylinderRadius + 0.08, -0.04);

    // Set initial anchor
    this.setAnchor(new THREE.Vector3(0, -0.25, -1.0), 0);
  }

  setAnchor(position, rotationY = 0) {
    this.anchorPosition.copy(position);
    this.anchorRotation.set(0, rotationY, 0);

    if (this.state === EXTINGUISHER_STATE.WORLD_ANCHORED) {
      this.group.position.copy(this.anchorPosition);
      this.group.rotation.copy(this.anchorRotation);
    }
  }

  getHandleWorldPosition() {
    this.group.localToWorld(this.handleWorldPos.copy(this.handleLocalPos));
    return this.handleWorldPos;
  }

  // Check if hand landmark/position is within the handle's interaction radius
  isHandInInteractionZone(handWorldPos) {
    const handlePos = this.getHandleWorldPosition();
    const distance = handlePos.distanceTo(handWorldPos);
    return distance <= this.interactionRadius;
  }

  // Update hover glow
  setInteractionHover(isHovering) {
    this.inInteractionRange = isHovering;
    if (this.haloMesh) {
      this.haloMesh.visible = (this.state === EXTINGUISHER_STATE.WORLD_ANCHORED);
      this.haloMesh.material.opacity = isHovering ? 0.65 : 0.15;
      this.haloMesh.material.color.setHex(isHovering ? 0x00E676 : 0x38BDF8);
    }
  }

  // Grab the extinguisher with tracked hand
  grab(handWorldPos, handWorldRot) {
    if (this.state === EXTINGUISHER_STATE.HELD) return true;

    // Must be within interaction range to grab
    if (!this.isHandInInteractionZone(handWorldPos)) {
      return false;
    }

    this.state = EXTINGUISHER_STATE.HELD;
    this.setInteractionHover(false);
    this.aimGuideLine.visible = true;
    return true;
  }

  // Release extinguisher at current location
  release() {
    if (this.state !== EXTINGUISHER_STATE.HELD) return;

    this.state = EXTINGUISHER_STATE.WORLD_ANCHORED;
    this.setSqueezing(false);
    this.aimGuideLine.visible = false;

    // The release point becomes the new stable world anchor
    this.anchorPosition.copy(this.group.position);
    this.anchorRotation.copy(this.group.rotation);
  }

  getPinWorldPosition() {
    if (!this.pinWorldPos) this.pinWorldPos = new THREE.Vector3();
    if (this.pinGroup) {
      this.pinGroup.getWorldPosition(this.pinWorldPos);
    }
    return this.pinWorldPos;
  }

  isHandNearPin(handPos) {
    if (this.isPinPulled) return false;
    const pinPos = this.getPinWorldPosition();
    return pinPos.distanceTo(handPos) < 0.18;
  }

  // PASS Step 1: Pull the Pin
  pullPin() {
    if (this.isPinPulled) return false;
    this.isPinPulled = true;
    soundFx.playPinPull();

    // Animate pin dropping/flying off
    if (this.pinGroup) {
      const startX = this.pinGroup.position.x;
      let frame = 0;
      const animatePin = () => {
        frame++;
        this.pinGroup.position.x += 0.008;
        this.pinGroup.position.y -= 0.004;
        this.pinGroup.rotation.z += 0.1;
        if (frame < 25) {
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(animatePin);
          } else {
            setTimeout(animatePin, 16);
          }
        } else {
          this.pinGroup.visible = false;
        }
      };
      animatePin();
    }
    return true;
  }

  // Squeeze handle (allowed only if pin is pulled)
  setSqueezing(squeeze) {
    if (squeeze === this.isSqueezing) return;

    if (squeeze) {
      if (!this.isPinPulled) {
        soundFx.playWarning();
        return false;
      }
      this.isSqueezing = true;
      soundFx.playLeverSqueeze();
      soundFx.startSpray();
      if (this.leverPivot) {
        this.leverPivot.rotation.x = 0.22; // Depress lever
      }
    } else {
      this.isSqueezing = false;
      soundFx.stopSpray();
      if (this.leverPivot) {
        this.leverPivot.rotation.x = 0.0; // Return lever
      }
    }
    return true;
  }

  // Update position following hand in HELD state
  updateHeldPose(handWorldPos, handWorldQuat, delta = 0.016) {
    if (this.state !== EXTINGUISHER_STATE.HELD) return;

    // Apply smooth lerping to prevent jitter from hand tracking
    const targetPos = handWorldPos.clone().add(this.gripOffset.clone().applyQuaternion(handWorldQuat));
    this.group.position.lerp(targetPos, Math.min(1, delta * 18));
    this.group.quaternion.slerp(handWorldQuat, Math.min(1, delta * 18));
  }

  // Get current nozzle spray launch vector in world coordinates
  getSprayTransform() {
    if (this.nozzleTip) {
      this.nozzleTip.getWorldPosition(this.sprayOrigin);
      this.nozzleTip.getWorldDirection(this.sprayDirection);
      // Ensure pointing outwards
      this.sprayDirection.normalize();
    }
    return {
      origin: this.sprayOrigin,
      direction: this.sprayDirection
    };
  }

  updateAimLock(isAimingAtBase) {
    if (this.state !== EXTINGUISHER_STATE.HELD) {
      if (this.aimGuideLine) this.aimGuideLine.visible = false;
      if (this.lockRing) this.lockRing.visible = false;
      return;
    }

    if (this.aimGuideLine) {
      this.aimGuideLine.visible = true;
      this.aimGuideMat.color.setHex(isAimingAtBase ? 0x00E676 : 0x38BDF8);
    }
    if (this.lockRing) {
      this.lockRing.visible = true;
      this.lockRingMat.color.setHex(isAimingAtBase ? 0x00E676 : 0x38BDF8);
      this.lockRingMat.opacity = isAimingAtBase ? 0.9 : 0.4;
      const s = isAimingAtBase ? 1.15 : 1.0;
      this.lockRing.scale.set(s, s, s);
    }
  }

  reset() {
    this.state = EXTINGUISHER_STATE.WORLD_ANCHORED;
    this.isPinPulled = false;
    this.setSqueezing(false);
    if (this.aimGuideLine) this.aimGuideLine.visible = false;
    if (this.lockRing) this.lockRing.visible = false;

    if (this.pinGroup) {
      this.pinGroup.position.set(0.025, 0.36 + 0.075 + 0.085, -0.02);
      this.pinGroup.rotation.set(0, 0, 0);
      this.pinGroup.visible = true;
    }

    if (this.leverPivot) {
      this.leverPivot.rotation.set(0, 0, 0);
    }

    this.group.position.copy(this.anchorPosition);
    this.group.rotation.copy(this.anchorRotation);
  }
}
