import * as THREE from 'three';
import { soundFx } from './audio.js';

// Procedural high-visibility flame texture with white core and fiery orange-gold body
function createFlameTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (!ctx) return new THREE.CanvasTexture(canvas);
  if (ctx.clearRect) ctx.clearRect(0, 0, 128, 256);

  // Outer fiery orange-red silhouette
  if (ctx.createRadialGradient) {
    const gradOuter = ctx.createRadialGradient(64, 175, 12, 64, 135, 75);
    gradOuter.addColorStop(0, 'rgba(255, 125, 0, 0.98)');
    gradOuter.addColorStop(0.45, 'rgba(255, 60, 0, 0.88)');
    gradOuter.addColorStop(0.8, 'rgba(220, 20, 0, 0.55)');
    gradOuter.addColorStop(1, 'rgba(120, 0, 0, 0)');
    ctx.fillStyle = gradOuter;
  }

  if (ctx.beginPath && ctx.bezierCurveTo) {
    ctx.beginPath();
    ctx.moveTo(64, 15);
    ctx.bezierCurveTo(115, 95, 122, 175, 92, 232);
    ctx.bezierCurveTo(72, 252, 56, 252, 36, 232);
    ctx.bezierCurveTo(6, 175, 13, 95, 64, 15);
    ctx.closePath();
    ctx.fill();

    // Core bright yellow-white combustion tongue
    if (ctx.createRadialGradient) {
      const gradCore = ctx.createRadialGradient(64, 185, 6, 64, 160, 48);
      gradCore.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      gradCore.addColorStop(0.3, 'rgba(255, 240, 140, 0.98)');
      gradCore.addColorStop(0.65, 'rgba(255, 150, 10, 0.75)');
      gradCore.addColorStop(1, 'rgba(255, 80, 0, 0)');
      ctx.fillStyle = gradCore;
    }

    ctx.beginPath();
    ctx.moveTo(64, 60);
    ctx.bezierCurveTo(98, 120, 100, 185, 80, 225);
    ctx.bezierCurveTo(70, 240, 58, 240, 48, 225);
    ctx.bezierCurveTo(28, 185, 30, 120, 64, 60);
    ctx.closePath();
    ctx.fill();
  } else if (ctx.fillRect) {
    ctx.fillRect(0, 0, 128, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// Procedural glowing spark texture
function createSparkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 28);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.3, 'rgba(255, 215, 64, 0.9)');
  grad.addColorStop(0.7, 'rgba(255, 80, 0, 0.4)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// Procedural soft smoke puff texture
function createSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(70, 70, 75, 0.55)');
  grad.addColorStop(0.5, 'rgba(50, 50, 55, 0.28)');
  grad.addColorStop(1, 'rgba(20, 20, 22, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export class FireSimulation {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'FireSimulation';

    this.health = 100.0; // 0 to 100%
    this.isExtinguished = false;
    this.smolderTimer = 0;

    // Anchor position in world space (~2.0m in front of user on the floor)
    this.anchorPosition = new THREE.Vector3(0, -0.30, -2.0);
    this.group.position.copy(this.anchorPosition);

    // Target Base Region for Firefighting (0.4m radius at base)
    this.baseCenter = new THREE.Vector3();
    this.baseRadius = 0.38;

    // Approach Zone radius (standoff distance: 1.6m to 3.0m)
    this.safeMinDistance = 1.6;
    this.safeMaxDistance = 3.0;

    // Texture references
    this.flameTexture = createFlameTexture();
    this.sparkTexture = createSparkTexture();
    this.smokeTexture = createSmokeTexture();

    this.flamePlanes = [];
    this.billboardFlames = [];

    this.buildBaseTray();
    this.buildVolumetricFlames();
    this.buildBillboardFlames();
    this.buildSmoke();
    this.buildSparks();
    this.buildSafeZoneMarker();
    this.buildLight();
  }

  // Set and lock spatial anchor on room floor
  setAnchor(pos) {
    this.anchorPosition.copy(pos);
    this.group.position.copy(pos);
  }

  buildBaseTray() {
    // 1. Charred industrial burn pan
    const trayGeo = new THREE.CylinderGeometry(0.28, 0.24, 0.16, 24);
    const trayMat = new THREE.MeshStandardMaterial({
      color: 0x1E293B,
      roughness: 0.85,
      metalness: 0.35
    });
    this.trayMesh = new THREE.Mesh(trayGeo, trayMat);
    this.trayMesh.position.y = 0.08;
    this.trayMesh.castShadow = true;
    this.trayMesh.receiveShadow = true;
    this.group.add(this.trayMesh);

    // 2. Burning charcoal logs inside tray
    const logGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.38, 8);
    const logMat = new THREE.MeshStandardMaterial({
      color: 0x221108,
      emissive: 0xCC3300,
      emissiveIntensity: 0.9,
      roughness: 0.95
    });
    this.logs = [];
    const logRotations = [
      { rz: 0.2, ry: 0.3, y: 0.13 },
      { rz: -0.22, ry: -0.6, y: 0.14 },
      { rz: 0.1, ry: 1.2, y: 0.15 }
    ];
    logRotations.forEach(cfg => {
      const log = new THREE.Mesh(logGeo, logMat);
      log.rotation.z = Math.PI / 2 + cfg.rz;
      log.rotation.y = cfg.ry;
      log.position.y = cfg.y;
      this.logs.push(log);
      this.group.add(log);
    });

    // 3. Glowing ember bed beneath logs
    const emberGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.04, 16);
    this.emberMat = new THREE.MeshStandardMaterial({
      color: 0xFF3D00,
      emissive: 0xFF5722,
      emissiveIntensity: 2.2,
      roughness: 0.9
    });
    this.emberMesh = new THREE.Mesh(emberGeo, this.emberMat);
    this.emberMesh.position.y = 0.12;
    this.group.add(this.emberMesh);

    // 4. Floor soot scorch ring
    const sootGeo = new THREE.RingGeometry(0.28, 0.44, 24);
    sootGeo.rotateX(-Math.PI / 2);
    const sootMat = new THREE.MeshBasicMaterial({
      color: 0x050505,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });
    const sootMesh = new THREE.Mesh(sootGeo, sootMat);
    sootMesh.position.y = 0.003;
    this.group.add(sootMesh);

    // 5. Target Base ring indicator for PASS training
    const targetRingGeo = new THREE.RingGeometry(0.27, 0.33, 32);
    targetRingGeo.rotateX(-Math.PI / 2);
    this.targetRingMat = new THREE.MeshBasicMaterial({
      color: 0xFF5252,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65
    });
    this.targetRing = new THREE.Mesh(targetRingGeo, this.targetRingMat);
    this.targetRing.position.y = 0.006;
    this.group.add(this.targetRing);
  }

  // Volumetric radial flame cluster (6 intersecting planes for 360-degree viewing)
  buildVolumetricFlames() {
    this.flameGroup = new THREE.Group();
    this.flameGroup.name = 'VolumetricFlames';

    const planeCount = 6;
    for (let i = 0; i < planeCount; i++) {
      const geo = new THREE.PlaneGeometry(0.72, 1.15, 1, 4);
      // Shift geometry pivot so bottom sits right on the ember bed
      geo.translate(0, 0.575, 0);

      const mat = new THREE.MeshBasicMaterial({
        map: this.flameTexture,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const mesh = new THREE.Mesh(geo, mat);
      const angle = (i * Math.PI) / planeCount;
      mesh.rotation.y = angle;
      mesh.position.y = 0.12;

      this.flamePlanes.push({
        mesh: mesh,
        baseAngle: angle,
        freq: 12.0 + i * 2.2,
        phase: i * 1.1
      });

      this.flameGroup.add(mesh);
    }

    // Glowing combustion heart sphere
    const coreGeo = new THREE.SphereGeometry(0.18, 16, 12);
    this.coreMat = new THREE.MeshBasicMaterial({
      color: 0xFFE082,
      transparent: true,
      opacity: 0.85
    });
    this.coreMesh = new THREE.Mesh(coreGeo, this.coreMat);
    this.coreMesh.position.y = 0.28;
    this.flameGroup.add(this.coreMesh);

    this.group.add(this.flameGroup);
  }

  // Billboarding dancing flame tongues licking upwards
  buildBillboardFlames() {
    this.billboardCount = 10;
    const bbGeo = new THREE.PlaneGeometry(0.38, 0.65);
    bbGeo.translate(0, 0.325, 0);

    for (let i = 0; i < this.billboardCount; i++) {
      const angle = (i / this.billboardCount) * Math.PI * 2;
      const radius = 0.06 + (i % 3) * 0.06;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const mat = new THREE.MeshBasicMaterial({
        map: this.flameTexture,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const mesh = new THREE.Mesh(bbGeo, mat);
      mesh.position.set(x, 0.12, z);

      this.billboardFlames.push({
        mesh: mesh,
        baseX: x,
        baseZ: z,
        baseY: 0.12,
        speed: 4.5 + Math.random() * 3.5,
        phase: Math.random() * Math.PI * 2,
        scaleY: 0.7 + Math.random() * 0.5
      });

      this.group.add(mesh);
    }
  }

  buildSmoke() {
    this.smokeCount = 35;
    const smokeGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.smokeCount * 3);
    const colors = new Float32Array(this.smokeCount * 3);

    this.smokeData = [];

    for (let i = 0; i < this.smokeCount; i++) {
      const x = (Math.random() - 0.5) * 0.28;
      const z = (Math.random() - 0.5) * 0.28;
      const y = 0.6 + Math.random() * 1.2;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      colors[i * 3] = 0.22;
      colors[i * 3 + 1] = 0.22;
      colors[i * 3 + 2] = 0.24;

      this.smokeData.push({
        baseX: x,
        baseZ: z,
        y: y,
        speedY: 0.38 + Math.random() * 0.35,
        driftX: (Math.random() - 0.5) * 0.18,
        driftZ: (Math.random() - 0.5) * 0.18,
        life: Math.random()
      });
    }

    smokeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    smokeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.smokeMat = new THREE.PointsMaterial({
      size: 0.55,
      map: this.smokeTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
      vertexColors: true
    });

    this.smokeMesh = new THREE.Points(smokeGeo, this.smokeMat);
    this.group.add(this.smokeMesh);
  }

  buildSparks() {
    this.sparkCount = 36;
    const sparkGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.sparkCount * 3);

    this.sparkData = [];

    for (let i = 0; i < this.sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 0.20;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = 0.18 + Math.random() * 0.35;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      this.sparkData.push({
        baseX: x,
        baseZ: z,
        speedY: 0.75 + Math.random() * 0.9,
        driftX: (Math.random() - 0.5) * 0.25,
        driftZ: (Math.random() - 0.5) * 0.25,
        life: Math.random()
      });
    }

    sparkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.sparkMat = new THREE.PointsMaterial({
      size: 0.16,
      map: this.sparkTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.95
    });

    this.sparkMesh = new THREE.Points(sparkGeo, this.sparkMat);
    this.group.add(this.sparkMesh);
  }

  buildSafeZoneMarker() {
    const ringGeo = new THREE.RingGeometry(1.7, 1.85, 36);
    ringGeo.rotateX(-Math.PI / 2);
    this.safeZoneMat = new THREE.MeshBasicMaterial({
      color: 0x38BDF8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4
    });
    this.safeZoneMesh = new THREE.Mesh(ringGeo, this.safeZoneMat);
    this.safeZoneMesh.position.y = 0.005;
    this.group.add(this.safeZoneMesh);
  }

  buildLight() {
    this.fireLight = new THREE.PointLight(0xFF6D00, 3.5, 5.0, 1.8);
    this.fireLight.position.set(0, 0.45, 0);
    this.group.add(this.fireLight);
  }

  getBaseWorldPosition() {
    this.group.localToWorld(this.baseCenter.set(0, 0.15, 0));
    return this.baseCenter;
  }

  getDistanceToCamera(cameraWorldPos) {
    const basePos = this.getBaseWorldPosition();
    return basePos.distanceTo(cameraWorldPos);
  }

  applySuppression(amount, delta) {
    if (this.isExtinguished) return;

    this.health = Math.max(0, this.health - amount * delta);
    this.smolderTimer = 0;

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

    // Hide volumetric and billboard flames
    if (this.flameGroup) {
      this.flameGroup.visible = false;
    }
    this.billboardFlames.forEach(b => {
      b.mesh.visible = false;
    });

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

  update(delta = 0.016, time = 0, camera = null) {
    if (this.isExtinguished) {
      if (this.smokeMesh && this.smokeMat && this.smokeMat.opacity > 0) {
        this.smokeMat.opacity = Math.max(0, this.smokeMat.opacity - delta * 0.05);
      }
      return;
    }

    const healthRatio = this.health / 100.0;

    // Slow reignition if left smoldering (<90% but >0%)
    if (this.health < 90 && this.health > 0) {
      this.smolderTimer += delta;
      if (this.smolderTimer > 2.5) {
        this.health = Math.min(90, this.health + delta * 2.2);
        soundFx.updateFireVolume(this.health / 100);
      }
    }

    // Dynamic light flicker scaled by health
    if (this.fireLight) {
      const flicker = Math.sin(time * 18.0) * 0.4 + Math.cos(time * 29.0) * 0.25;
      this.fireLight.intensity = Math.max(0.1, (3.2 + flicker) * healthRatio);
    }

    // 1. Animate Volumetric Intersecting Flame Planes
    if (this.flameGroup && this.flameGroup.visible) {
      this.flamePlanes.forEach((fp) => {
        const wave = Math.sin(time * fp.freq + fp.phase);
        const flicker = Math.cos(time * 22.0 + fp.phase);
        const scaleY = (1.0 + wave * 0.14 + flicker * 0.08) * Math.max(0.2, healthRatio);
        const scaleX = (1.0 + Math.sin(time * 8.0 + fp.phase) * 0.09) * Math.max(0.25, healthRatio);
        fp.mesh.scale.set(scaleX, scaleY, scaleX);
        fp.mesh.rotation.y = fp.baseAngle + Math.sin(time * 3.5 + fp.phase) * 0.04;
      });

      // Core heart pulse
      if (this.coreMesh) {
        const coreScale = (1.0 + Math.sin(time * 15.0) * 0.12) * Math.max(0.2, healthRatio);
        this.coreMesh.scale.set(coreScale, coreScale, coreScale);
      }
    }

    // 2. Animate Billboard Flame Tongues
    this.billboardFlames.forEach((b) => {
      const progress = (time * b.speed * 0.4 + b.phase) % 1.0;
      const sway = Math.sin(time * 8.0 + b.phase) * 0.03 * healthRatio;
      b.mesh.position.x = b.baseX + sway;
      b.mesh.position.y = b.baseY + progress * 0.25 * healthRatio;
      b.mesh.position.z = b.baseZ + sway * 0.5;

      const scaleY = b.scaleY * (1.0 - progress * 0.4) * Math.max(0.25, healthRatio);
      const scaleX = (0.7 + Math.sin(time * 12.0 + b.phase) * 0.18) * Math.max(0.3, healthRatio);
      b.mesh.scale.set(scaleX, scaleY, 1.0);

      // Face camera if camera provided
      if (camera) {
        b.mesh.quaternion.copy(camera.quaternion);
      }
    });

    // 3. Smoke particles update
    if (this.smokeMesh) {
      const smokePositions = this.smokeMesh.geometry.attributes.position.array;
      for (let i = 0; i < this.smokeCount; i++) {
        const s = this.smokeData[i];
        s.life += delta * s.speedY;
        if (s.life > 1.0) s.life = 0;
        smokePositions[i * 3] = s.baseX + s.driftX * s.life;
        smokePositions[i * 3 + 1] = 0.35 + s.life * 1.35;
        smokePositions[i * 3 + 2] = s.baseZ + s.driftZ * s.life;
      }
      this.smokeMesh.geometry.attributes.position.needsUpdate = true;
    }

    // 4. Spark particles update
    if (this.sparkMesh) {
      const sparkPositions = this.sparkMesh.geometry.attributes.position.array;
      for (let i = 0; i < this.sparkCount; i++) {
        const sp = this.sparkData[i];
        sp.life += delta * sp.speedY * (0.8 + 0.5 * healthRatio);
        if (sp.life > 1.0) sp.life = 0;
        sparkPositions[i * 3] = sp.baseX + sp.driftX * sp.life * healthRatio;
        sparkPositions[i * 3 + 1] = 0.18 + sp.life * 1.0 * healthRatio;
        sparkPositions[i * 3 + 2] = sp.baseZ + sp.driftZ * sp.life * healthRatio;
      }
      this.sparkMesh.geometry.attributes.position.needsUpdate = true;
      this.sparkMat.opacity = Math.max(0, healthRatio);
    }

    // 5. Safe zone pulse
    if (this.safeZoneMat) {
      this.safeZoneMat.opacity = 0.30 + Math.sin(time * 3.0) * 0.12;
    }
  }

  updateTargetLock(isLocked) {
    if (this.targetRingMat && !this.isExtinguished) {
      if (isLocked) {
        this.targetRingMat.color.setHex(0x00E676);
        this.targetRingMat.opacity = 0.88;
      } else {
        this.targetRingMat.color.setHex(0xFF5252);
        this.targetRingMat.opacity = 0.65;
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
      this.emberMat.emissiveIntensity = 2.2;
    }

    if (this.flameGroup) {
      this.flameGroup.visible = true;
    }

    this.billboardFlames.forEach(b => {
      b.mesh.visible = true;
    });

    if (this.sparkMesh) {
      this.sparkMesh.visible = true;
      this.sparkMat.opacity = 0.95;
    }

    if (this.smokeMat) {
      this.smokeMat.opacity = 0.5;
    }

    const colors = this.smokeMesh.geometry.attributes.color.array;
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = 0.22;
      colors[i + 1] = 0.22;
      colors[i + 2] = 0.24;
    }
    this.smokeMesh.geometry.attributes.color.needsUpdate = true;

    if (this.targetRingMat) {
      this.targetRingMat.color.setHex(0xFF5252);
      this.targetRingMat.opacity = 0.65;
    }

    this.group.position.copy(this.anchorPosition);
  }
}
