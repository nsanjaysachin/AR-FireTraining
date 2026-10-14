import { soundFx } from './audio.js';
import { EXTINGUISHER_STATE } from './extinguisher.js';

export const TRAINING_STAGE = {
  INTRO: 'INTRO',
  SETUP: 'SETUP',
  PLACEMENT: 'PLACEMENT',
  INSTRUCTION: 'INSTRUCTION',
  PICKUP: 'PICKUP',
  PIN_PULL: 'PIN_PULL',
  APPROACH_AIM: 'APPROACH_AIM',
  SUPPRESSION: 'SUPPRESSION',
  COMPLETION: 'COMPLETION'
};

export class TrainingManager {
  constructor(extinguisher, fire, spray, handTracker, arTracker, evaluator, uiCallbacks) {
    this.extinguisher = extinguisher;
    this.fire = fire;
    this.spray = spray;
    this.handTracker = handTracker;
    this.arTracker = arTracker;
    this.evaluator = evaluator;
    this.ui = uiCallbacks;

    this.currentStage = TRAINING_STAGE.INTRO;
    this.elapsedSessionTime = 0;
    this.isActive = false;

    // Guidance text mappings
    this.stagePrompts = {
      [TRAINING_STAGE.INTRO]: {
        title: 'SafeSphere AR Fire Emergency Simulation',
        instruction: 'Welcome to SafeSphere. Prepare to practice real-world fire extinguisher response using PASS protocols and tracked hand interaction.',
        badge: 'STANDBY'
      },
      [TRAINING_STAGE.SETUP]: {
        title: 'AR Sensor & Environment Calibration',
        instruction: 'Allow camera permissions. Bring your hand into the camera view to calibrate computer vision tracking.',
        badge: 'CALIBRATING'
      },
      [TRAINING_STAGE.PLACEMENT]: {
        title: 'Surface Placement & Spatial Anchor',
        instruction: 'Scan your floor or table. Tap "Confirm Placement" to anchor the extinguisher and fire scenario in your real space.',
        badge: 'ANCHORING'
      },
      [TRAINING_STAGE.INSTRUCTION]: {
        title: 'PASS Step 1: Reach for Extinguisher',
        instruction: 'Extend your hand toward the red extinguisher handle. The halo will glow green when you are within reach distance.',
        badge: 'APPROACH HANDLE'
      },
      [TRAINING_STAGE.PICKUP]: {
        title: 'Perform Grab Gesture',
        instruction: 'Pinch thumb and index finger together (or make a firm fist) to grasp the handle and lift the extinguisher.',
        badge: 'GRAB OBJECT'
      },
      [TRAINING_STAGE.PIN_PULL]: {
        title: 'PASS Step 1: Pull the Safety Pin (P)',
        instruction: 'Disengage the safety mechanism. Tap "Pull Pin" or pinch the yellow safety seal to unlock the squeeze lever.',
        badge: 'P — PULL PIN'
      },
      [TRAINING_STAGE.APPROACH_AIM]: {
        title: 'PASS Step 2: Aim at the Base (A)',
        instruction: 'Maintain a safe standoff distance (1.8m – 2.5m). Direct the nozzle toward the FUEL BED, not the smoke!',
        badge: 'A — AIM BASE'
      },
      [TRAINING_STAGE.SUPPRESSION]: {
        title: 'PASS Step 3 & 4: Squeeze & Sweep (S)',
        instruction: 'Squeeze the handle and sweep the nozzle smoothly from side to side across the base of the fire.',
        badge: 'S — SQUEEZE & SWEEP'
      },
      [TRAINING_STAGE.COMPLETION]: {
        title: 'Fire Extinguished — Session Complete',
        instruction: 'Hazard neutralized! Review your PASS technique accuracy, reaction times, and training score.',
        badge: 'EVALUATION READY'
      }
    };
  }

  startTraining() {
    this.isActive = true;
    this.elapsedSessionTime = 0;
    this.evaluator.startSession();
    soundFx.init();
    soundFx.startFireSound();
    this.setStage(TRAINING_STAGE.INSTRUCTION);
  }

  setStage(newStage) {
    this.currentStage = newStage;
    const prompt = this.stagePrompts[newStage];
    if (prompt && prompt.instruction) {
      soundFx.speak(prompt.instruction);
    }
    if (this.ui.onStageChange) {
      this.ui.onStageChange(newStage, prompt);
    }
  }

  update(delta) {
    if (!this.isActive) return;

    this.elapsedSessionTime += delta;

    const handState = this.handTracker.getInteractionState(this.extinguisher);
    const cameraPos = this.arTracker.camera3D.position;
    const distToFire = this.fire.getDistanceToCamera(cameraPos);

    // STATE MACHINE TRANSITIONS
    switch (this.currentStage) {
      case TRAINING_STAGE.INSTRUCTION:
      case TRAINING_STAGE.PICKUP: {
        // Visual hover check
        this.extinguisher.setInteractionHover(handState.inRange);

        if (handState.inRange) {
          if (this.currentStage !== TRAINING_STAGE.PICKUP) {
            this.setStage(TRAINING_STAGE.PICKUP);
          }

          // If grab gesture performed within range
          if (handState.isGrabbing) {
            const success = this.extinguisher.grab(handState.handPos, handState.handQuat);
            if (success) {
              this.evaluator.recordPickup();
              this.setStage(this.extinguisher.isPinPulled ? TRAINING_STAGE.APPROACH_AIM : TRAINING_STAGE.PIN_PULL);
            }
          }
        } else if (this.currentStage === TRAINING_STAGE.PICKUP) {
          this.setStage(TRAINING_STAGE.INSTRUCTION);
        }
        break;
      }

      case TRAINING_STAGE.PIN_PULL: {
        // Check if extinguisher is still held
        if (this.extinguisher.state !== EXTINGUISHER_STATE.HELD) {
          this.setStage(TRAINING_STAGE.INSTRUCTION);
          break;
        }

        // If pin has been pulled
        if (this.extinguisher.isPinPulled) {
          this.evaluator.recordPinPull();
          this.setStage(TRAINING_STAGE.APPROACH_AIM);
        }
        break;
      }

      case TRAINING_STAGE.APPROACH_AIM: {
        if (this.extinguisher.state !== EXTINGUISHER_STATE.HELD) {
          this.setStage(TRAINING_STAGE.INSTRUCTION);
          break;
        }

        const sprayTransform = this.extinguisher.getSprayTransform();
        const fireBasePos = this.fire.getBaseWorldPosition();
        const toFire = fireBasePos.clone().sub(sprayTransform.origin).normalize();
        const dot = sprayTransform.direction.dot(toFire);

        // If aiming toward fire base (dot > 0.85 = within ~30 deg)
        if (dot > 0.82) {
          this.evaluator.recordAim(true);
          this.setStage(TRAINING_STAGE.SUPPRESSION);
        }
        break;
      }

      case TRAINING_STAGE.SUPPRESSION: {
        if (this.extinguisher.state !== EXTINGUISHER_STATE.HELD) {
          this.setStage(TRAINING_STAGE.INSTRUCTION);
          break;
        }

        if (this.fire.isExtinguished) {
          this.isActive = false;
          const report = this.evaluator.recordCompletion(true);
          this.setStage(TRAINING_STAGE.COMPLETION);
          if (this.ui.onComplete) {
            this.ui.onComplete(report);
          }
        }
        break;
      }
    }

    // Pass data to UI
    if (this.ui.onTick) {
      this.ui.onTick({
        stage: this.currentStage,
        elapsed: this.elapsedSessionTime,
        fireHealth: this.fire.health,
        distToFire: distToFire,
        handState: handState,
        isPinPulled: this.extinguisher.isPinPulled,
        isSqueezing: this.extinguisher.isSqueezing,
        passState: this.evaluator.passCompleted
      });
    }
  }

  // Trigger manual pin pull from UI button or gesture
  triggerPinPull() {
    const success = this.extinguisher.pullPin();
    if (success) {
      this.evaluator.recordPinPull();
      if (this.currentStage === TRAINING_STAGE.PIN_PULL) {
        this.setStage(TRAINING_STAGE.APPROACH_AIM);
      }
    }
    return success;
  }

  // Squeeze toggle from UI or hand gesture
  triggerSqueeze(squeeze) {
    return this.extinguisher.setSqueezing(squeeze);
  }

  // Reset training scenario for retry
  restart() {
    this.extinguisher.reset();
    this.fire.reset();
    this.spray.reset();
    this.evaluator.startSession();
    this.elapsedSessionTime = 0;
    this.isActive = true;
    soundFx.startFireSound();
    this.setStage(TRAINING_STAGE.INSTRUCTION);
  }

  // Guide Presentation Demo: Smoothly automates the PASS response sequence
  async runGuideDemo() {
    this.restart();
    soundFx.speak('Initiating Guide Demonstration. Executing standard PASS response protocol.');

    await new Promise(r => setTimeout(r, 1200));

    // Step 1: Reach and Grab
    const handlePos = this.extinguisher.getHandleWorldPosition();
    this.extinguisher.grab(handlePos, this.arTracker.camera3D.quaternion);
    this.evaluator.recordPickup();
    this.setStage(TRAINING_STAGE.PIN_PULL);

    await new Promise(r => setTimeout(r, 1500));

    // Step 2: Pull Pin
    this.triggerPinPull();

    await new Promise(r => setTimeout(r, 1500));

    // Step 3: Aim at base
    const fireBase = this.fire.getBaseWorldPosition();
    this.extinguisher.group.position.set(fireBase.x, fireBase.y + 0.15, fireBase.z + 1.9);
    this.extinguisher.group.lookAt(fireBase);
    this.evaluator.recordAim(true);
    this.setStage(TRAINING_STAGE.SUPPRESSION);

    await new Promise(r => setTimeout(r, 1200));

    // Step 4: Squeeze and Sweep
    this.triggerSqueeze(true);
    let sweepAngle = 0;
    const sweepInterval = setInterval(() => {
      if (this.fire.isExtinguished) {
        clearInterval(sweepInterval);
        this.triggerSqueeze(false);
        return;
      }
      sweepAngle += 0.08;
      const offsetX = Math.sin(sweepAngle) * 0.22;
      this.extinguisher.group.position.x = fireBase.x + offsetX;
      this.extinguisher.group.lookAt(fireBase);
    }, 50);
  }
}
