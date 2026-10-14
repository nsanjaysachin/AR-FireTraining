import * as THREE from 'three';
import { soundFx } from './audio.js';

export class FireSimulation {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'FireSimulation';

    this.health = 100.0; // 0 to 100%
    this.isExtinguished = false;
    this.smolderTimer = 0;

    // Anchor position
    this.anchorPosition = new THREE.Vector3(0, -0.3, -2.4); // ~2.4m in front of starting camera
    this.group.position.copy(this.anchorPosition);

    // Target Base Region for Firefighting (0.4m radius at base)
    this.baseCenter = new THREE.Vector3();
    this.baseRadius = 0.38;

    // Approach Zone radius (recommended standoff distance: 1.8m to 2.8m)
    this.safeMinDistance = 1.6;
    this.safeMaxDistance = 3.2;

    this.particles = [];
    this.smokeParticles = [];

    this.buildBaseTray();
    this.buildFlames();
    this.buildSmoke();
    this.buildSparks();
    this.buildSafeZoneMarker();
    this.buildLight();
  }

  buildBaseTray() {
    // Charred steel wastebasket / burn tray
    const trayGeo = new THREE.CylinderGeometry(0.24, 0.20, 0.16, 24, 1, false);
    const trayMat = new THREE.MeshStandardMaterial({
      color: 0x1E293B,
      roughness: 0.9,
      metalness: 0.2
    });
    this.trayMesh = new THREE.Mesh(trayGeo, trayMat);
    this.trayMesh.position.y = 0.08;
    this.trayMesh.castShadow = true;
    this.trayMesh.receiveShadow = true;
    this.group.add(this.trayMesh);

    // Glowing charcoal / ember bed inside tray
    const emberGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16);
    this.emberMat = new THREE.MeshStandardMaterial({
      color: 0xFF3D00,
      emissive: 0xFF5722,
      emissiveIntensity: 1.8,
      roughness: 0.9
    });
    this.emberMesh = new THREE.Mesh(emberGeo, this.emberMat);
    this.emberMesh.position.y = 0.15;
    this.group.add(this.emberMesh);

    // Target Base indicator ring (subtle visual indicator of the fuel base)
    const targetRingGeo = new THREE.RingGeometry(0.24, 0.28, 32);
    targetRingGeo.rotateX(-Math.PI / 2);
    this.targetRingMat = new THREE.MeshBasicMaterial({
      color: 0xFF5252,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5
    });
    this.targetRing = new THREE.Mesh(targetRingGeo, this.targetRingMat);
    this.targetRing.position.y = 0.01;
    this.group.add(this.targetRing);
  }

  buildFlames() {
    // Multi-particle flame billboard system
    this.flameCount = 90;
    const flameGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.flameCount * 3);
    const colors = new Float32Array(this.flameCount * 3);
    const sizes = new Float32Array(this.flameCount);

    this.flameData = [];

    for (let i = 0; i < this.flameCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 0.16;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = 0.15 + Math.random() * 0.45;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color: white-hot to yellow to deep flame orange
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.4 + Math.random() * 0.5;
      colors[i * 3 + 2] = 0.05;

      sizes[i] = 0.22 + Math.random() * 0.18;

      this.flameData.push({
        baseX: x,
        baseZ: z,
        y: y,
        speedY: 0.6 + Math.random() * 0.8,
        swaySpeed: 2.0 + Math.random() * 3.0,
        swayOffset: Math.random() * Math.PI * 2,
        life: Math.random()
      });
    }

    flameGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    flameGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    flameGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Create flame particle texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 200, 50, 0.9)');
    grad.addColorStop(0.7, 'rgba(255, 80, 0, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);

    this.flameMat = new THREE.PointsMaterial({
      size: 0.32,
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    this.flameParticles = new THREE.Points(flameGeo, this.flameMat);
    this.group.add(this.flameParticles);
  }

  buildSmoke() {
    this.smokeCount = 45;
    const smokeGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.smokeCount * 3);
    const colors = new Float32Array(this.smokeCount * 3);

    this.smokeData = [];

    for (let i = 0; i < this.smokeCount; i++) {
      const x = (Math.random() - 0.5) * 0.25;
      const z = (Math.random() - 0.5) * 0.25;
      const y = 0.5 + Math.random() * 1.0;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      colors[i * 3] = 0.2;
      colors[i * 3 + 1] = 0.2;
      colors[i * 3 + 2] = 0.2;

      this.smokeData.push({
        baseX: x,
        baseZ: z,
        y: y,
        speedY: 0.35 + Math.random() * 0.4,
        driftX: (Math.random() - 0.5) * 0.15,
        driftZ: (Math.random() - 0.5) * 0.15,
        life: Math.random()
      });
    }

    smokeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    smokeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Smoke texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(80, 80, 80, 0.45)');
    grad.addColorStop(0.6, 'rgba(50, 50, 50, 0.2)');
    grad.addColorStop(1, 'rgba(20, 20, 20, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);

    this.smokeMat = new THREE.PointsMaterial({
      size: 0.5,
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
      vertexColors: true
    });

    this.smokeMesh = new THREE.Points(smokeGeo, this.smokeMat);
    this.group.add(this.smokeMesh);
  }

  buildSparks() {
    this.sparkCount = 30;
    const sparkGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.sparkCount * 3);
    const colors = new Float32Array(this.sparkCount * 3);

    this.sparkData = [];

    for (let i = 0; i < this.sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 0.16;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = 0.15 + Math.random() * 0.25;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.85;
      colors[i * 3 + 2] = 0.15;

      this.sparkData.push({
        baseX: x,
        baseZ: z,
        y: y,
        speedY: 0.8 + Math.random() * 1.1,
        driftX: (Math.random() - 0.5) * 0.35,
        driftZ: (Math.random() - 0.5) * 0.35,
        life: Math.random()
      });
    }

    sparkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.sparkMat = new THREE.PointsMaterial({
      size: 0.07,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    this.sparkMesh = new THREE.Points(sparkGeo, this.sparkMat);
    this.group.add(this.sparkMesh);
  }

  buildSafeZoneMarker() {
    // Standoff approach boundary ring on the floor (2m safe distance from fire)
    const ringGeo = new THREE.RingGeometry(2.0, 2.06, 64);
    ringGeo.rotateX(-Math.PI / 2);
    this.safeZoneMat = new THREE.MeshBasicMaterial({
      color: 0x38BDF8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45
    });
    this.safeZoneMesh = new THREE.Mesh(ringGeo, this.safeZoneMat);
    this.safeZoneMesh.position.y = 0.005;
    this.group.add(this.safeZoneMesh);
  }

  buildLight() {
    // Dynamic flickering fire light
    this.fireLight = new THREE.PointLight(0xFF6D00, 3.2, 5.0, 1.8);
    this.fireLight.position.set(0, 0.45, 0);
    this.group.add(this.fireLight);
  }

  getBaseWorldPosition() {
    this.group.localToWorld(this.baseCenter.set(0, 0.15, 0));
    return this.baseCenter;
  }

  // Calculate distance from user/camera to fire
  getDistanceToCamera(cameraWorldPos) {
    const basePos = this.getBaseWorldPosition();
    return basePos.distanceTo(cameraWorldPos);
  }

  // Apply suppression damage when hit by extinguishing spray
  applySuppression(amount, delta) {
    if (this.isExtinguished) return;

    this.health = Math.max(0, this.health - amount * delta);
    this.smolderTimer = 0; // reset reignition countdown

    soundFx.updateFireVolume(this.health / 100);

    if (this.health <= 0) {
      this.extinguish();
    }
  }

  extinguish() {
    this.health = 0;
    this.isExtinguished = true;
    soundFx.stopFireSound();
    soundFx.playExtinguished();

    // Turn embers black
    if (this.emberMat) {
      this.emberMat.color.setHex(0x18181B);
      this.emberMat.emissive.setHex(0x000000);
      this.emberMat.emissiveIntensity = 0;
    }

    // Hide flames and sparks
    if (this.flameParticles) {
      this.flameParticles.visible = false;
    }
    if (this.sparkMesh) {
      this.sparkMesh.visible = false;
    }

    // Turn smoke into faint white steam puff
    if (this.smokeMat) {
      this.smokeMat.opacity = 0.15;
    }
    const colors = this.smokeMesh.geometry.attributes.color.array;
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = 0.8;
      colors[i + 1] = 0.85;
      colors[i + 2] = 0.9;
    }
    this.smokeMesh.geometry.attributes.color.needsUpdate = true;

    if (this.fireLight) {
      this.fireLight.intensity = 0;
    }

    if (this.targetRingMat) {
      this.targetRingMat.color.setHex(0x00E676);
      this.targetRingMat.opacity = 0.8;
    }
  }

  update(delta = 0.016, time = 0) {
    if (this.isExtinguished) {
      // Disperse remaining steam
      if (this.smokeMesh && this.smokeMat.opacity > 0) {
        this.smokeMat.opacity = Math.max(0, this.smokeMat.opacity - delta * 0.05);
      }
      return;
    }

    const healthRatio = this.health / 100.0;

    // Slow reignition if fire was left smoldering (<90% but >0%)
    if (this.health < 90 && this.health > 0) {
      this.smolderTimer += delta;
      if (this.smolderTimer > 2.5) {
        // Slowly creep back up by 2% per sec
        this.health = Math.min(90, this.health + delta * 2.2);
        soundFx.updateFireVolume(this.health / 100);
      }
    }

    // Dynamic light flicker scaled by health
    if (this.fireLight) {
      const flicker = Math.sin(time * 18.0) * 0.3 + Math.cos(time * 29.0) * 0.2;
      this.fireLight.intensity = Math.max(0.1, (2.8 + flicker) * healthRatio);
    }

    // Flame scale and particles update
    const flamePositions = this.flameParticles.geometry.attributes.position.array;
    const flameColors = this.flameParticles.geometry.attributes.color.array;

    for (let i = 0; i < this.flameCount; i++) {
      const d = this.flameData[i];
      d.life += delta * d.speedY * (0.8 + 0.4 * healthRatio);
      if (d.life > 1.0) {
        d.life = 0;
      }

      const sway = Math.sin(time * d.swaySpeed + d.swayOffset) * 0.04 * healthRatio;
      flamePositions[i * 3] = (d.baseX + sway) * healthRatio;
      flamePositions[i * 3 + 1] = (0.12 + d.life * 0.55 * healthRatio);
      flamePositions[i * 3 + 2] = (d.baseZ + sway * 0.5) * healthRatio;

      // Color fades as particle rises and health decreases
      const hotness = (1.0 - d.life) * healthRatio;
      flameColors[i * 3] = 1.0;
      flameColors[i * 3 + 1] = 0.2 + hotness * 0.7;
      flameColors[i * 3 + 2] = hotness * 0.2;
    }
    this.flameParticles.geometry.attributes.position.needsUpdate = true;
    this.flameParticles.geometry.attributes.color.needsUpdate = true;
    this.flameMat.size = 0.32 * Math.max(0.3, healthRatio);

    // Smoke particles update
    const smokePositions = this.smokeMesh.geometry.attributes.position.array;
    for (let i = 0; i < this.smokeCount; i++) {
      const s = this.smokeData[i];
      s.life += delta * s.speedY;
      if (s.life > 1.0) {
        s.life = 0;
      }
      smokePositions[i * 3] = s.baseX + s.driftX * s.life;
      smokePositions[i * 3 + 1] = 0.35 + s.life * 1.2;
      smokePositions[i * 3 + 2] = s.baseZ + s.driftZ * s.life;
    }
    // Spark particles update
    if (this.sparkMesh) {
      const sparkPositions = this.sparkMesh.geometry.attributes.position.array;
      for (let i = 0; i < this.sparkCount; i++) {
        const sp = this.sparkData[i];
        sp.life += delta * sp.speedY * (0.8 + 0.5 * healthRatio);
        if (sp.life > 1.0) {
          sp.life = 0;
        }
        sparkPositions[i * 3] = sp.baseX + sp.driftX * sp.life * healthRatio;
        sparkPositions[i * 3 + 1] = 0.15 + sp.life * 0.9 * healthRatio;
        sparkPositions[i * 3 + 2] = sp.baseZ + sp.driftZ * sp.life * healthRatio;
      }
      this.sparkMesh.geometry.attributes.position.needsUpdate = true;
      this.sparkMat.opacity = Math.max(0, healthRatio);
    }

    // Safe zone pulse animation
    if (this.safeZoneMat) {
      this.safeZoneMat.opacity = 0.35 + Math.sin(time * 3.0) * 0.15;
    }
  }

  updateTargetLock(isLocked) {
    if (this.targetRingMat && !this.isExtinguished) {
      if (isLocked) {
        this.targetRingMat.color.setHex(0x00E676);
        this.targetRingMat.opacity = 0.88;
      } else {
        this.targetRingMat.color.setHex(0xFF5252);
        this.targetRingMat.opacity = 0.5;
      }
    }
  }

  reset() {
    this.health = 100.0;
    this.isExtinguished = false;
    this.smolderTimer = 0;

    if (this.emberMat) {
      this.emberMat.color.setHex(0xFF3D00);
      this.emberMat.emissive.setHex(0xFF5722);
      this.emberMat.emissiveIntensity = 1.8;
    }

    if (this.flameParticles) {
      this.flameParticles.visible = true;
      this.flameMat.size = 0.32;
    }

    if (this.sparkMesh) {
      this.sparkMesh.visible = true;
      this.sparkMat.opacity = 1.0;
    }

    if (this.smokeMat) {
      this.smokeMat.opacity = 0.45;
    }

    const colors = this.smokeMesh.geometry.attributes.color.array;
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = 0.2;
      colors[i + 1] = 0.2;
      colors[i + 2] = 0.2;
    }
    this.smokeMesh.geometry.attributes.color.needsUpdate = true;

    if (this.targetRingMat) {
      this.targetRingMat.color.setHex(0xFF5252);
      this.targetRingMat.opacity = 0.5;
    }

    this.group.position.copy(this.anchorPosition);
  }
}
