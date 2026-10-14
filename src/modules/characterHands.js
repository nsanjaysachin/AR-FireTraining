import * as THREE from 'three';

export class CharacterHands {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.name = 'FirstPersonCharacterArms';
    this.camera.add(this.group);

    // Animation state
    this.isSqueezing = false;
    this.isWalking = false;
    this.walkCycle = 0;
    this.idleCycle = 0;
    this.recoilOffset = 0;
    this.pinPullAnimProgress = 0;
    this.isPullingPin = false;

    // Materials
    this.createMaterials();
    this.buildArms();

    // Default hidden until extinguisher is held
    this.group.visible = false;
  }

  createMaterials() {
    // Firefighter Turnout Jacket: High-visibility dark bunker fabric
    this.sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x1E293B, // Dark navy bunker gear
      roughness: 0.85,
      metalness: 0.1
    });

    // Reflective safety striping (yellow-lime DayGlo)
    this.stripeMat = new THREE.MeshStandardMaterial({
      color: 0xEAB308, // High-vis safety yellow
      emissive: 0xCA8A04,
      emissiveIntensity: 0.25,
      roughness: 0.3
    });

    // Heat-resistant leather gloves
    this.gloveMat = new THREE.MeshStandardMaterial({
      color: 0x0F172A, // Reinforced charcoal leather
      roughness: 0.7,
      metalness: 0.15
    });

    // Glove knuckle reinforcements
    this.knuckleMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.3
    });
  }

  buildArms() {
    // -------------------------------------------------------------
    // 1. RIGHT ARM (Holds carrying handle and squeeze lever)
    // -------------------------------------------------------------
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.22, -0.26, -0.42);

    // Sleeve / Forearm
    const rForearmGeo = new THREE.CylinderGeometry(0.046, 0.052, 0.26, 16);
    rForearmGeo.rotateX(Math.PI / 2.6);
    const rForearm = new THREE.Mesh(rForearmGeo, this.sleeveMat);
    rForearm.position.set(0.05, -0.06, 0.12);
    rForearm.castShadow = true;
    this.rightArm.add(rForearm);

    // Reflective trim on right sleeve
    const rTrimGeo = new THREE.CylinderGeometry(0.053, 0.053, 0.035, 16);
    rTrimGeo.rotateX(Math.PI / 2.6);
    const rTrim = new THREE.Mesh(rTrimGeo, this.stripeMat);
    rTrim.position.set(0.05, -0.04, 0.08);
    this.rightArm.add(rTrim);

    // Right Glove Cuff
    const rCuffGeo = new THREE.CylinderGeometry(0.045, 0.048, 0.06, 16);
    rCuffGeo.rotateX(Math.PI / 2.4);
    const rCuff = new THREE.Mesh(rCuffGeo, this.gloveMat);
    rCuff.position.set(0.02, -0.02, 0.02);
    this.rightArm.add(rCuff);

    // Right Hand Palm
    const rPalmGeo = new THREE.BoxGeometry(0.065, 0.042, 0.075);
    this.rPalm = new THREE.Mesh(rPalmGeo, this.gloveMat);
    this.rPalm.position.set(-0.01, 0.01, -0.04);
    this.rPalm.rotation.set(-0.15, 0.2, -0.1);
    this.rightArm.add(this.rPalm);

    // Fingers wrapping around handle
    this.rFingers = new THREE.Group();
    this.rFingers.position.set(-0.02, 0.02, -0.06);
    for (let i = 0; i < 4; i++) {
      const fingerGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.045, 8);
      fingerGeo.rotateZ(Math.PI / 2.2);
      const finger = new THREE.Mesh(fingerGeo, this.knuckleMat);
      finger.position.set(-0.015, -i * 0.011, -i * 0.004);
      this.rFingers.add(finger);
    }
    this.rightArm.add(this.rFingers);

    // Thumb gripping side of handle
    const rThumbGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.04, 8);
    rThumbGeo.rotateY(Math.PI / 3);
    const rThumb = new THREE.Mesh(rThumbGeo, this.gloveMat);
    rThumb.position.set(0.025, 0.015, -0.035);
    this.rightArm.add(rThumb);

    this.group.add(this.rightArm);

    // -------------------------------------------------------------
    // 2. LEFT ARM (Guides nozzle toward fire base)
    // -------------------------------------------------------------
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.08, -0.28, -0.44);

    // Left Sleeve / Forearm
    const lForearmGeo = new THREE.CylinderGeometry(0.045, 0.052, 0.28, 16);
    lForearmGeo.rotateX(Math.PI / 3.0);
    lForearmGeo.rotateZ(-Math.PI / 7);
    const lForearm = new THREE.Mesh(lForearmGeo, this.sleeveMat);
    lForearm.position.set(-0.08, -0.06, 0.14);
    lForearm.castShadow = true;
    this.leftArm.add(lForearm);

    // Reflective trim on left sleeve
    const lTrimGeo = new THREE.CylinderGeometry(0.053, 0.053, 0.035, 16);
    lTrimGeo.rotateX(Math.PI / 3.0);
    lTrimGeo.rotateZ(-Math.PI / 7);
    const lTrim = new THREE.Mesh(lTrimGeo, this.stripeMat);
    lTrim.position.set(-0.065, -0.04, 0.09);
    this.leftArm.add(lTrim);

    // Left Glove Palm gripping nozzle body
    const lPalmGeo = new THREE.BoxGeometry(0.06, 0.04, 0.07);
    this.lPalm = new THREE.Mesh(lPalmGeo, this.gloveMat);
    this.lPalm.position.set(0.02, 0.02, -0.04);
    this.lPalm.rotation.set(0.2, -0.3, 0.1);
    this.leftArm.add(this.lPalm);

    // Left Fingers wrapping around nozzle horn
    this.lFingers = new THREE.Group();
    this.lFingers.position.set(0.03, 0.03, -0.06);
    for (let i = 0; i < 4; i++) {
      const fingerGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.042, 8);
      fingerGeo.rotateZ(-Math.PI / 2.3);
      const finger = new THREE.Mesh(fingerGeo, this.knuckleMat);
      finger.position.set(0.012, -i * 0.010, -i * 0.003);
      this.lFingers.add(finger);
    }
    this.leftArm.add(this.lFingers);

    this.group.add(this.leftArm);
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  setWalking(isWalking) {
    this.isWalking = isWalking;
  }

  setSqueezing(isSqueezing) {
    this.isSqueezing = isSqueezing;
  }

  triggerPinPullAnimation() {
    this.isPullingPin = true;
    this.pinPullAnimProgress = 0;
  }

  update(delta, extinguisher) {
    if (!this.group.visible) return;

    this.idleCycle += delta * 1.8;

    // 1. Idle Breathing Sway (subtle organic motion)
    const breathY = Math.sin(this.idleCycle) * 0.0035;
    const breathX = Math.cos(this.idleCycle * 0.5) * 0.002;

    // 2. Walking Bobbing Motion
    let walkBobY = 0;
    let walkBobX = 0;
    if (this.isWalking) {
      this.walkCycle += delta * 8.5;
      walkBobY = Math.abs(Math.sin(this.walkCycle)) * 0.012;
      walkBobX = Math.cos(this.walkCycle * 0.5) * 0.008;
    } else {
      this.walkCycle = 0;
    }

    // 3. Spray Recoil Vibration
    if (this.isSqueezing) {
      this.recoilOffset = (Math.random() - 0.5) * 0.004;
      // Squeeze hand gesture: fingers curl tightly
      this.rFingers.rotation.x = 0.25;
      this.rPalm.position.y = 0.002;
    } else {
      this.recoilOffset = 0;
      this.rFingers.rotation.x = 0.0;
      this.rPalm.position.y = 0.01;
    }

    // 4. Pin Pull Quick Gesture Animation
    let pinPullX = 0;
    let pinPullZ = 0;
    if (this.isPullingPin) {
      this.pinPullAnimProgress += delta * 3.5;
      if (this.pinPullAnimProgress < 1.0) {
        // Quick tug to the left side
        const t = Math.sin(this.pinPullAnimProgress * Math.PI);
        pinPullX = -t * 0.08;
        pinPullZ = -t * 0.05;
      } else {
        this.isPullingPin = false;
        this.pinPullAnimProgress = 0;
      }
    }

    // Apply combined transforms to Right Arm
    this.rightArm.position.set(
      0.20 + breathX + walkBobX + (this.isSqueezing ? this.recoilOffset : 0),
      -0.24 + breathY - walkBobY + (this.isSqueezing ? -0.004 : 0),
      -0.42 + (this.isSqueezing ? 0.01 : 0)
    );

    // Apply combined transforms to Left Arm
    this.leftArm.position.set(
      -0.06 + breathX * 0.5 - walkBobX + pinPullX,
      -0.26 + breathY * 0.8 - walkBobY,
      -0.44 + (this.isSqueezing ? (this.recoilOffset * 0.5) : 0) + pinPullZ
    );
  }
}
