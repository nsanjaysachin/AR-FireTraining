import * as THREE from 'three';

export class ExtinguisherSpraySystem {
  constructor(scene) {
    this.scene = scene;
    this.maxParticles = 180;
    this.particles = [];

    // Particle geometries
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxParticles * 3);
    const alphas = new Float32Array(this.maxParticles);
    const sizes = new Float32Array(this.maxParticles);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Powder cloud texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.4, 'rgba(240, 248, 255, 0.7)');
    grad.addColorStop(0.8, 'rgba(220, 235, 245, 0.25)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);

    this.material = new THREE.PointsMaterial({
      size: 0.35,
      map: texture,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      opacity: 0.85
    });

    this.points = new THREE.Points(geo, this.material);
    this.scene.add(this.points);

    // Dynamic sweep tracking
    this.lastAimVector = new THREE.Vector3();
    this.horizontalSweepVelocity = 0;

    // Suppression stats for session evaluation
    this.isOnTarget = false;
    this.isAimingAtBase = false;
    this.lastFeedback = '';
  }

  // Emit burst of dry chemical powder particles from nozzle along forward vector
  emit(origin, direction, count = 6) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift(); // Remove oldest
      }

      // Add cone divergence (~10-14 degrees)
      const spreadX = (Math.random() - 0.5) * 0.22;
      const spreadY = (Math.random() - 0.5) * 0.18;
      const spreadZ = (Math.random() - 0.5) * 0.22;
      const velocity = direction.clone()
        .add(new THREE.Vector3(spreadX, spreadY, spreadZ))
        .normalize()
        .multiplyScalar(6.5 + Math.random() * 2.5); // 6.5 - 9 m/s high initial speed

      this.particles.push({
        position: origin.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02
        )),
        velocity: velocity,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.25, // ~0.5s travel time
        size: 0.12 + Math.random() * 0.08
      });
    }
  }

  // Update particles and compute suppression intersection with fire
  update(delta, extinguisher, fire, camera) {
    const isSpraying = extinguisher.isSqueezing && extinguisher.isPinPulled;
    const sprayTransform = extinguisher.getSprayTransform();

    if (isSpraying) {
      this.emit(sprayTransform.origin, sprayTransform.direction, 8);
    }

    // Update existing particles
    const positions = this.points.geometry.attributes.position.array;
    const alphas = this.points.geometry.attributes.alpha.array;
    const sizes = this.points.geometry.attributes.size.array;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Air resistance and gravity
      p.velocity.multiplyScalar(Math.pow(0.35, delta)); // Drag
      p.velocity.y -= 1.8 * delta; // Mild gravity drop
      p.position.addScaledVector(p.velocity, delta);

      // Expansion of powder cloud
      p.size += delta * 0.6;
    }

    // Update GPU buffers
    for (let i = 0; i < this.maxParticles; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        positions[i * 3] = p.position.x;
        positions[i * 3 + 1] = p.position.y;
        positions[i * 3 + 2] = p.position.z;

        const progress = p.life / p.maxLife;
        alphas[i] = (1.0 - progress) * 0.8;
        sizes[i] = p.size;
      } else {
        alphas[i] = 0;
        sizes[i] = 0;
      }
    }

    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.alpha.needsUpdate = true;
    this.points.geometry.attributes.size.needsUpdate = true;

    // If not spraying, clear hit status
    if (!isSpraying || fire.isExtinguished) {
      this.isOnTarget = false;
      this.isAimingAtBase = false;
      this.lastFeedback = '';
      return {
        isSpraying: false,
        isOnTarget: false,
        isAimingAtBase: false,
        sweepVelocity: 0,
        feedback: ''
      };
    }

    // SUPPRESSION CALCULATION
    const nozzlePos = sprayTransform.origin;
    const nozzleDir = sprayTransform.direction;
    const fireBasePos = fire.getBaseWorldPosition();

    // Standoff distance from nozzle to fire base
    const distanceToFire = nozzlePos.distanceTo(fireBasePos);

    // Ray to fire base vector
    const toFireVec = fireBasePos.clone().sub(nozzlePos);
    const toFireDist = toFireVec.length();
    const toFireDir = toFireVec.clone().normalize();

    // Dot product to check angle alignment
    const dot = nozzleDir.dot(toFireDir); // 1.0 is direct center aim
    const angleDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

    // Check vertical aiming: project ray to fire plane to check hit height
    // Ray equation: P = nozzlePos + t * nozzleDir
    // Fire base is at y = fireBasePos.y
    const t = (fireBasePos.z - nozzlePos.z) / (nozzleDir.z !== 0 ? nozzleDir.z : -0.0001);
    const estimatedHitY = nozzlePos.y + nozzleDir.y * t;
    const relativeHitHeight = estimatedHitY - fireBasePos.y;

    // Check if aiming at base (< 0.45m height above fuel bed)
    const hitBase = relativeHitHeight >= -0.2 && relativeHitHeight <= 0.48;

    // Cone angle threshold at given distance (~20 degree cone)
    const inAimCone = angleDeg < 18.0;

    this.isOnTarget = inAimCone && hitBase;
    this.isAimingAtBase = hitBase;

    // Detect horizontal sweeping movement
    const currentAngle = Math.atan2(nozzleDir.x, nozzleDir.z);
    const lastAngle = Math.atan2(this.lastAimVector.x, this.lastAimVector.z);
    let angleDelta = currentAngle - lastAngle;
    // Normalize angle delta
    if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
    this.horizontalSweepVelocity = Math.abs(angleDelta) / Math.max(delta, 0.001);
    this.lastAimVector.copy(nozzleDir);

    const isSweeping = this.horizontalSweepVelocity > 0.35 && this.horizontalSweepVelocity < 3.5;

    // Distance appropriateness
    let distanceFactor = 1.0;
    if (distanceToFire < fire.safeMinDistance) {
      this.lastFeedback = '⚠️ TOO CLOSE! Step back to safe distance (1.8m - 2.5m).';
      distanceFactor = 0.5; // Penalty for hazardous proximity
    } else if (distanceToFire > 3.8) {
      this.lastFeedback = '⚠️ OUT OF RANGE! Approach to within 3m for effective suppression.';
      distanceFactor = 0.15;
    } else if (!inAimCone) {
      this.lastFeedback = '❌ Off target! Point nozzle directly at the fire.';
    } else if (!hitBase) {
      this.lastFeedback = '⚠️ Aim lower! Target the FUEL BASE, not upper smoke/flames.';
    } else if (!isSweeping) {
      this.lastFeedback = '⚡ Great aim! Now SWEEP nozzle side-to-side across the base.';
    } else {
      this.lastFeedback = '🔥 EXCELLENT TECHNIQUE! Squeeze & Sweep suppressing flames rapidly!';
    }

    // Compute effective suppression rate
    if (this.isOnTarget) {
      // Base suppression: 22% health per second
      let suppressionRate = 22.0 * distanceFactor;

      // Sweeping bonus: 1.4x faster suppression
      if (isSweeping) {
        suppressionRate *= 1.45;
      }

      fire.applySuppression(suppressionRate, delta);
    }

    return {
      isSpraying: true,
      isOnTarget: this.isOnTarget,
      isAimingAtBase: this.isAimingAtBase,
      isSweeping: isSweeping,
      sweepVelocity: this.horizontalSweepVelocity,
      distanceToFire: distanceToFire,
      feedback: this.lastFeedback
    };
  }

  reset() {
    this.particles = [];
    this.isOnTarget = false;
    this.isAimingAtBase = false;
    this.lastFeedback = '';
    const alphas = this.points.geometry.attributes.alpha.array;
    for (let i = 0; i < alphas.length; i++) {
      alphas[i] = 0;
    }
    this.points.geometry.attributes.alpha.needsUpdate = true;
  }
}
