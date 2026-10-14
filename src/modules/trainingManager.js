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
    this.touchSqueezeActive = false;

    // Guidance text mappings
    this.stagePrompts = {
      [TRAINING_STAGE.INTRO]: {
        title: 'SafeSphere Live AR Fire Training',
        instruction: 'Tap "START AR FIRE TRAINING" to begin live spatial tracking.',
        badge: 'READY'
      },
      [TRAINING_STAGE.SETUP]: {
        title: 'Calibrating Camera AR',
        instruction: 'Point device at floor/table. Camera tracking active.',
        badge: 'TRACKING'
      },
      [TRAINING_STAGE.PLACEMENT]: {
        title: 'Extinguisher Anchored in Room',
        instruction: 'Extinguisher and fire scenario anchored in physical space.',
        badge: 'ANCHORED'
      },
      [TRAINING_STAGE.INSTRUCTION]: {
        title: 'Step 1: Reach for Extinguisher',
        instruction: 'Reach your hand toward the extinguisher handle to pick it up.',
        badge: 'REACH HANDLE'
      },
      [TRAINING_STAGE.PICKUP]: {
        title: 'Grasp the Handle',
        instruction: 'Close your hand (or tap extinguisher) to pick it up.',
        badge: 'GRAB HANDLE'
      },
      [TRAINING_STAGE.PIN_PULL]: {
        title: 'PASS Step 1: Pull Safety Pin (P)',
        instruction: 'Pinch the yellow pin in camera or tap it on screen to unlock.',
        badge: 'P — PULL PIN'
      },
      [TRAINING_STAGE.APPROACH_AIM]: {
        title: 'PASS Step 2: Aim at Base (A)',
        instruction: 'Point phone / nozzle directly at the FUEL BASE of the fire.',
        badge: 'A — AIM BASE'
      },
      [TRAINING_STAGE.SUPPRESSION]: {
        title: 'PASS Step 3 & 4: Squeeze & Sweep (S)',
        instruction: 'Hold phone screen (or clench fist) to spray. SWEEP side to side!',
        badge: 'S — SQUEEZE & SWEEP'
      },
      [TRAINING_STAGE.COMPLETION]: {
        title: 'Fire Neutralized — Complete!',
        instruction: 'Fire extinguished successfully. Performance report generated.',
        badge: 'EVALUATION'
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

        // Live physical pinch gesture on safety pin
        if (handState.isNearPin && handState.isGrabbing) {
          this.triggerPinPull();
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

        // If aiming toward fire base (dot > 0.82 = within ~34 deg)
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

        // Live physical squeeze: hand gesture or mobile touch
        const shouldSqueeze = handState.isSqueezingGesture || this.touchSqueezeActive;
        if (this.extinguisher.isPinPulled) {
          this.extinguisher.setSqueezing(shouldSqueeze);
        }

        if (this.fire.isExtinguished) {
          this.isActive = false;
          this.extinguisher.setSqueezing(false);
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

  // Trigger pickup from touch or hand grab
  triggerPickup(pos = null, quat = null) {
    const p = pos || this.arTracker.camera3D.position;
    const q = quat || this.arTracker.camera3D.quaternion;
    const success = this.extinguisher.grab(p, q);
    if (success) {
      this.evaluator.recordPickup();
      this.setStage(this.extinguisher.isPinPulled ? TRAINING_STAGE.APPROACH_AIM : TRAINING_STAGE.PIN_PULL);
    }
    return success;
  }

  // Trigger manual pin pull from gesture or direct touch
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

  // Mobile screen touch-hold squeeze
  setTouchSqueeze(active) {
    this.touchSqueezeActive = active;
    if (this.currentStage === TRAINING_STAGE.SUPPRESSION && this.extinguisher.isPinPulled) {
      this.extinguisher.setSqueezing(active);
    }
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
}
