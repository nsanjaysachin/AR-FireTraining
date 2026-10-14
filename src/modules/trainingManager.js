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

    // Minimalist guidance directives
    this.stagePrompts = {
      [TRAINING_STAGE.INTRO]: {
        badge: 'ROOM SCAN',
        instruction: 'Point camera at floor & tap "ANALYSE ROOM"'
      },
      [TRAINING_STAGE.SETUP]: {
        badge: 'ANALYSING',
        instruction: 'Analysing room surfaces... Move phone slowly'
      },
      [TRAINING_STAGE.PLACEMENT]: {
        badge: 'READY',
        instruction: 'Room mapped! Tap "START TRAINING" to begin'
      },
      [TRAINING_STAGE.INSTRUCTION]: {
        badge: 'PICKUP',
        instruction: 'Reach hand or tap extinguisher to pick up'
      },
      [TRAINING_STAGE.PICKUP]: {
        badge: 'GRAB',
        instruction: 'Reach hand or tap extinguisher to pick up'
      },
      [TRAINING_STAGE.PIN_PULL]: {
        badge: 'P — PIN',
        instruction: 'Pull yellow safety pin (tap or pinch)'
      },
      [TRAINING_STAGE.APPROACH_AIM]: {
        badge: 'A — AIM',
        instruction: 'Aim nozzle crosshair at base of fire'
      },
      [TRAINING_STAGE.SUPPRESSION]: {
        badge: 'S — SPRAY',
        instruction: 'Hold screen to spray • Sweep side-to-side'
      },
      [TRAINING_STAGE.COMPLETION]: {
        badge: 'EXTINGUISHED',
        instruction: 'Fire extinguished successfully'
      }
    };
  }

  // 1. Initial room floor scanning phase (No fire or extinguisher yet)
  startRoomScanning() {
    this.extinguisher.group.visible = false;
    this.fire.group.visible = false;
    if (this.arTracker && this.arTracker.reticleGroup) {
      this.arTracker.reticleGroup.visible = true;
      if (this.arTracker.setReticleState) {
        this.arTracker.setReticleState('scanning');
      }
    }
    this.isActive = false;
    this.setStage(TRAINING_STAGE.INTRO);
  }

  // 2. Deploy fire emergency scenario after room and hand are analyzed
  deployFireScenario() {
    soundFx.init();
    soundFx.resume();
    soundFx.playCalibrationSuccess();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    // Position extinguisher and fire right in front of user in their scanned room
    if (this.arTracker) {
      this.arTracker.repositionAnchor(this.extinguisher, this.fire);
      if (this.arTracker.reticleGroup) {
        this.arTracker.reticleGroup.visible = false;
      }
    }

    this.extinguisher.group.visible = true;
    this.fire.group.visible = true;
    this.isActive = true;
    this.elapsedSessionTime = 0;
    this.evaluator.startSession();
    soundFx.startFireSound();
    this.setStage(TRAINING_STAGE.INSTRUCTION);
  }

  startTraining() {
    this.deployFireScenario();
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
    this.extinguisher.group.visible = true;
    this.fire.group.visible = true;
    if (this.arTracker && this.arTracker.reticleGroup) {
      this.arTracker.reticleGroup.visible = false;
    }
    this.evaluator.startSession();
    this.elapsedSessionTime = 0;
    this.isActive = true;
    soundFx.startFireSound();
    this.setStage(TRAINING_STAGE.INSTRUCTION);
  }
}
