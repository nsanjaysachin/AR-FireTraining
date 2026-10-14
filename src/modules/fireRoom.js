import * as THREE from 'three';

// Procedural texture helpers for realistic architectural materials
function createTileTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Dark industrial concrete floor with grout grid lines
  ctx.fillStyle = '#181E24';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#0E1318';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 252);

  // Subtle floor surface noise
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const shade = Math.floor(Math.random() * 25);
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.15)`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 10);
  tex.needsUpdate = true;
  return tex;
}

function createHazardStripesTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#F59E0B'; // Safety amber/yellow
  ctx.fillRect(0, 0, 128, 32);

  ctx.fillStyle = '#111827'; // Dark charcoal
  ctx.beginPath();
  for (let i = -32; i < 160; i += 32) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 16, 0);
    ctx.lineTo(i + 32, 32);
    ctx.lineTo(i + 16, 32);
    ctx.closePath();
  }
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  tex.needsUpdate = true;
  return tex;
}

function createExitSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#064E3B'; // Deep emergency green
  ctx.fillRect(0, 0, 128, 64);
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 60);

  ctx.fillStyle = '#ECFDF5';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT ➔', 64, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createPosterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Red and white safety chart
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 256, 320);

  ctx.fillStyle = '#DC2626';
  ctx.fillRect(0, 0, 256, 60);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FIRE SAFETY', 128, 38);

  ctx.fillStyle = '#1F2937';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('P - PULL PIN', 24, 100);
  ctx.fillText('A - AIM AT BASE', 24, 140);
  ctx.fillText('S - SQUEEZE LEVER', 24, 180);
  ctx.fillText('S - SWEEP NOZZLE', 24, 220);

  ctx.fillStyle = '#DC2626';
  ctx.fillRect(16, 255, 224, 45);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CLASS B / C RATED', 128, 283);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export class FireRoomEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'FireAccidentRoom';
    this.scene.add(this.group);

    this.flickerLights = [];
    this.beaconAngle = 0;

    this.buildRoomShell();
    this.buildAccidentStation();
    this.buildWallEquipment();
    this.buildCeilingLighting();
    this.buildEmergencyBeacon();
    this.buildEquipmentStand();
  }

  buildRoomShell() {
    // 1. Concrete Tiled Industrial Floor
    const floorGeo = new THREE.PlaneGeometry(10, 12);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: createTileTexture(),
      roughness: 0.45,
      metalness: 0.2
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.position.set(0, -0.30, -0.5);
    this.floorMesh.receiveShadow = true;
    this.group.add(this.floorMesh);

    // Hazard warning border line on floor
    const hazardGeo = new THREE.PlaneGeometry(6, 0.24);
    hazardGeo.rotateX(-Math.PI / 2);
    const hazardMat = new THREE.MeshBasicMaterial({
      map: createHazardStripesTexture(),
      side: THREE.DoubleSide
    });
    const hazardMesh = new THREE.Mesh(hazardGeo, hazardMat);
    hazardMesh.position.set(0, -0.298, -1.2);
    this.group.add(hazardMesh);

    // 2. Heavy burn scorch soot mark on the floor around the accident
    const scorchGeo = new THREE.CircleGeometry(1.4, 32);
    scorchGeo.rotateX(-Math.PI / 2);
    const scorchMat = new THREE.MeshBasicMaterial({
      color: 0x07080A,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide
    });
    const scorchMesh = new THREE.Mesh(scorchGeo, scorchMat);
    scorchMesh.position.set(0, -0.297, -2.0);
    this.group.add(scorchMesh);

    // 3. Walls (Back, Left, Right, Ceiling)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2A323D,
      roughness: 0.85,
      metalness: 0.15
    });

    // Back Wall (behind fire)
    const backWallGeo = new THREE.PlaneGeometry(10, 3.8);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, 1.6, -4.5);
    this.group.add(backWall);

    // Left Wall
    const leftWallGeo = new THREE.PlaneGeometry(12, 3.8);
    leftWallGeo.rotateY(Math.PI / 2);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(-4.5, 1.6, 0);
    this.group.add(leftWall);

    // Right Wall
    const rightWallGeo = new THREE.PlaneGeometry(12, 3.8);
    rightWallGeo.rotateY(-Math.PI / 2);
    const rightWall = new THREE.Mesh(rightWallGeo, wallMat);
    rightWall.position.set(4.5, 1.6, 0);
    this.group.add(rightWall);

    // Ceiling with recessed industrial panels
    const ceilingGeo = new THREE.PlaneGeometry(10, 12);
    ceilingGeo.rotateX(Math.PI / 2);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x151B22,
      roughness: 0.9
    });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.position.set(0, 3.4, -0.5);
    this.group.add(ceiling);
  }

  // Industrial workbench where the electrical / solvent fire accident occurred
  buildAccidentStation() {
    this.stationGroup = new THREE.Group();
    this.stationGroup.position.set(0, -0.30, -2.0);

    // Steel workbench frame
    const benchTopGeo = new THREE.BoxGeometry(1.6, 0.08, 0.9);
    const benchMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.7,
      metalness: 0.4
    });
    const benchTop = new THREE.Mesh(benchTopGeo, benchMat);
    benchTop.position.set(0, 0.04, 0);
    benchTop.castShadow = true;
    this.stationGroup.add(benchTop);

    // Charred server power unit on the side of the table with dangling cables
    const powerUnitGeo = new THREE.BoxGeometry(0.35, 0.28, 0.4);
    const powerMat = new THREE.MeshStandardMaterial({
      color: 0x0F172A,
      roughness: 0.95
    });
    const powerUnit = new THREE.Mesh(powerUnitGeo, powerMat);
    powerUnit.position.set(-0.55, 0.22, 0.05);
    this.stationGroup.add(powerUnit);

    // Glowing short-circuit indicator spark light
    this.sparkLight = new THREE.PointLight(0x60A5FA, 0.8, 1.5);
    this.sparkLight.position.set(-0.55, 0.25, 0.25);
    this.stationGroup.add(this.sparkLight);

    // Overturned industrial chemical / solvent container where fire ignited
    const barrelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.35, 16);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0xDC2626,
      roughness: 0.6,
      metalness: 0.3
    });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.z = Math.PI / 2.2;
    barrel.position.set(0.48, 0.10, 0.1);
    this.stationGroup.add(barrel);

    this.group.add(this.stationGroup);
  }

  // Emergency exit door, fire alarm pull box, and PASS poster on walls
  buildWallEquipment() {
    // 1. Emergency Exit Door (on left wall)
    const doorGeo = new THREE.BoxGeometry(0.1, 2.2, 1.1);
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x1E293B,
      metalness: 0.5,
      roughness: 0.5
    });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(-4.44, 0.8, -1.8);
    this.group.add(door);

    // Push bar handle on door
    const pushBarGeo = new THREE.BoxGeometry(0.14, 0.06, 0.8);
    const pushBarMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.8 });
    const pushBar = new THREE.Mesh(pushBarGeo, pushBarMat);
    pushBar.position.set(-4.38, 0.8, -1.8);
    this.group.add(pushBar);

    // Glowing Illuminated EXIT Sign above door
    const exitGeo = new THREE.PlaneGeometry(0.65, 0.32);
    exitGeo.rotateY(Math.PI / 2);
    const exitMat = new THREE.MeshBasicMaterial({
      map: createExitSignTexture(),
      side: THREE.DoubleSide
    });
    const exitSign = new THREE.Mesh(exitGeo, exitMat);
    exitSign.position.set(-4.42, 2.15, -1.8);
    this.group.add(exitSign);

    // Subtle green exit glow light
    const exitGlow = new THREE.PointLight(0x10B981, 0.9, 3.5);
    exitGlow.position.set(-4.2, 2.15, -1.8);
    this.group.add(exitGlow);

    // 2. PASS Fire Safety Instructional Poster on Back Wall
    const posterGeo = new THREE.PlaneGeometry(0.85, 1.05);
    const posterMat = new THREE.MeshBasicMaterial({
      map: createPosterTexture(),
      side: THREE.DoubleSide
    });
    const poster = new THREE.Mesh(posterGeo, posterMat);
    poster.position.set(-1.8, 1.5, -4.48);
    this.group.add(poster);

    // 3. Red Fire Alarm Station on Back Wall
    const alarmGeo = new THREE.BoxGeometry(0.25, 0.32, 0.1);
    const alarmMat = new THREE.MeshStandardMaterial({
      color: 0xDC2626,
      roughness: 0.4,
      metalness: 0.3
    });
    const alarmBox = new THREE.Mesh(alarmGeo, alarmMat);
    alarmBox.position.set(1.8, 1.35, -4.45);
    this.group.add(alarmBox);
  }

  // Overhead fluorescent fixtures with emergency short-circuit flicker
  buildCeilingLighting() {
    const fixtureGeo = new THREE.BoxGeometry(1.6, 0.08, 0.35);
    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xF8FAFC });

    const positions = [
      { x: 0, z: -2.0 },
      { x: 0, z: 0.5 },
      { x: 0, z: 3.0 }
    ];

    positions.forEach((p, idx) => {
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.set(p.x, 3.32, p.z);
      this.group.add(fixture);

      const bulbGeo = new THREE.PlaneGeometry(1.4, 0.25);
      bulbGeo.rotateX(Math.PI / 2);
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(p.x, 3.27, p.z);
      this.group.add(bulb);

      const light = new THREE.PointLight(0xE2E8F0, idx === 0 ? 0.6 : 0.9, 7.0);
      light.position.set(p.x, 3.1, p.z);
      this.group.add(light);

      if (idx === 0) {
        // Light closest to the fire accident flickers
        this.flickerLights.push(light);
      }
    });
  }

  // Red rotating emergency strobe beacon on back wall
  buildEmergencyBeacon() {
    const beaconBaseGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.12, 16);
    const beaconBaseMat = new THREE.MeshStandardMaterial({ color: 0x1E293B });
    const beaconBase = new THREE.Mesh(beaconBaseGeo, beaconBaseMat);
    beaconBase.position.set(0, 2.7, -4.42);
    beaconBase.rotation.x = Math.PI / 2;
    this.group.add(beaconBase);

    // Glowing red dome
    const domeGeo = new THREE.SphereGeometry(0.10, 16, 12);
    this.beaconDomeMat = new THREE.MeshBasicMaterial({ color: 0xEF4444 });
    const dome = new THREE.Mesh(domeGeo, this.beaconDomeMat);
    dome.position.set(0, 2.7, -4.32);
    this.group.add(dome);

    // Rotating strobe spotlight
    this.beaconLight = new THREE.SpotLight(0xEF4444, 4.0, 10.0, Math.PI / 4, 0.5);
    this.beaconLight.position.set(0, 2.7, -4.32);
    this.beaconTarget = new THREE.Object3D();
    this.beaconTarget.position.set(0, 0, -2.0);
    this.group.add(this.beaconTarget);
    this.beaconLight.target = this.beaconTarget;
    this.group.add(this.beaconLight);
  }

  // Stand/table where extinguisher sits right in front of user
  buildEquipmentStand() {
    // Pedestal stand for the extinguisher
    const standTopGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.08, 24);
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x1E293B,
      roughness: 0.6,
      metalness: 0.4
    });
    this.standMesh = new THREE.Mesh(standTopGeo, standMat);
    this.standMesh.position.set(0.18, -0.26, -1.05);
    this.standMesh.receiveShadow = true;
    this.group.add(this.standMesh);

    // Warning marker ring around extinguisher
    const markerGeo = new THREE.RingGeometry(0.22, 0.28, 32);
    markerGeo.rotateX(-Math.PI / 2);
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0xF59E0B,
      side: THREE.DoubleSide
    });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(0.18, -0.218, -1.05);
    this.group.add(marker);
  }

  update(delta, time) {
    // 1. Emergency strobe beacon rotation and pulse
    this.beaconAngle += delta * 4.5;
    if (this.beaconTarget) {
      this.beaconTarget.position.x = Math.sin(this.beaconAngle) * 4.0;
      this.beaconTarget.position.y = 0.5 + Math.cos(this.beaconAngle * 2.0) * 0.5;
    }
    if (this.beaconLight) {
      this.beaconLight.intensity = 2.5 + Math.sin(time * 10.0) * 2.0;
    }

    // 2. Fluorescent light electrical flicker (simulating fire damage to wiring)
    this.flickerLights.forEach(light => {
      if (Math.random() < 0.05) {
        light.intensity = 0.1 + Math.random() * 0.4;
      } else {
        light.intensity = 0.65;
      }
    });

    // 3. Sparks short-circuit flicker
    if (this.sparkLight) {
      this.sparkLight.intensity = Math.random() < 0.15 ? (0.6 + Math.random() * 1.2) : 0.0;
    }
  }

  setVisible(visible) {
    this.group.visible = visible;
  }
}
