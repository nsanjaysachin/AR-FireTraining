// SafeSphere Performance Evaluation Engine
// Objective scoring, metrics recording, and actionable feedback

export class PerformanceEvaluator {
  constructor() {
    this.sessionStartTime = 0;
    this.pickupTime = 0;
    this.pinPullTime = 0;
    this.firstValidAimTime = 0;
    this.completionTime = 0;

    // PASS status
    this.passCompleted = {
      P: false, // Pull pin
      A: false, // Aim at base
      S: false, // Squeeze
      S2: false // Sweep
    };

    // Tracking durations and counts
    this.totalSprayDuration = 0;
    this.sprayOnTargetDuration = 0;
    this.aimCorrectionsCount = 0;
    this.wasOffTargetLastFrame = false;
    this.sweepTimeAccumulated = 0;
    this.distanceViolations = 0;
    this.fireExtinguished = false;

    this.stepsCompleted = [];
    this.history = [];
  }

  startSession() {
    this.sessionStartTime = performance.now();
    this.pickupTime = 0;
    this.pinPullTime = 0;
    this.firstValidAimTime = 0;
    this.completionTime = 0;

    this.passCompleted = { P: false, A: false, S: false, S2: false };
    this.totalSprayDuration = 0;
    this.sprayOnTargetDuration = 0;
    this.aimCorrectionsCount = 0;
    this.wasOffTargetLastFrame = false;
    this.sweepTimeAccumulated = 0;
    this.distanceViolations = 0;
    this.fireExtinguished = false;
    this.stepsCompleted = [];
  }

  recordPickup() {
    if (this.pickupTime === 0) {
      this.pickupTime = (performance.now() - this.sessionStartTime) / 1000;
      this.stepsCompleted.push('PICKUP');
    }
  }

  recordPinPull() {
    if (!this.passCompleted.P) {
      this.passCompleted.P = true;
      this.pinPullTime = (performance.now() - this.sessionStartTime) / 1000;
      this.stepsCompleted.push('PULL_PIN');
    }
  }

  recordAim(isAimingAtBase) {
    if (isAimingAtBase && !this.passCompleted.A) {
      this.passCompleted.A = true;
      this.firstValidAimTime = (performance.now() - this.sessionStartTime) / 1000;
      this.stepsCompleted.push('AIM_BASE');
    }
  }

  recordSprayFrame(delta, sprayResult) {
    if (!sprayResult.isSpraying) return;

    this.totalSprayDuration += delta;
    this.passCompleted.S = true;

    if (sprayResult.isOnTarget) {
      this.sprayOnTargetDuration += delta;
      this.recordAim(true);

      if (this.wasOffTargetLastFrame) {
        this.aimCorrectionsCount++;
        this.wasOffTargetLastFrame = false;
      }
    } else {
      this.wasOffTargetLastFrame = true;
    }

    if (sprayResult.isSweeping) {
      this.sweepTimeAccumulated += delta;
      if (this.sweepTimeAccumulated > 1.2) {
        this.passCompleted.S2 = true;
      }
    }

    // Distance violations
    if (sprayResult.distanceToFire < 1.4) {
      this.distanceViolations++;
    }
  }

  recordCompletion(fireExtinguished) {
    this.completionTime = (performance.now() - this.sessionStartTime) / 1000;
    this.fireExtinguished = fireExtinguished;

    const report = this.generateReport();
    this.history.push(report);
    return report;
  }

  generateReport() {
    const accuracy = this.totalSprayDuration > 0
      ? Math.round((this.sprayOnTargetDuration / this.totalSprayDuration) * 100)
      : 0;

    // SCORING FORMULA (Transparent 0 - 100 points)
    // 1. Extinguished: 35 points
    const extinguishPoints = this.fireExtinguished ? 35 : Math.max(0, 35 - 35 * (1));

    // 2. PASS Sequence: 25 points total (6.25 each)
    let passPoints = 0;
    if (this.passCompleted.P) passPoints += 6.25;
    if (this.passCompleted.A) passPoints += 6.25;
    if (this.passCompleted.S) passPoints += 6.25;
    if (this.passCompleted.S2) passPoints += 6.25;

    // 3. Aim Accuracy: 20 points
    const accuracyPoints = Math.round((accuracy / 100) * 20);

    // 4. Sweeping Technique: 10 points
    const sweepPoints = this.passCompleted.S2 ? 10 : Math.min(10, Math.round(this.sweepTimeAccumulated * 5));

    // 5. Standoff Distance Adherence: 10 points
    const distancePoints = Math.max(0, 10 - Math.min(10, this.distanceViolations));

    // Deductions: Aim corrections / erratic spray
    const deduction = Math.min(15, this.aimCorrectionsCount * 2);

    let totalScore = Math.max(0, Math.min(100, Math.round(
      extinguishPoints + passPoints + accuracyPoints + sweepPoints + distancePoints - deduction
    )));

    let grade = 'F';
    if (totalScore >= 92) grade = 'A+ (Exemplary)';
    else if (totalScore >= 85) grade = 'A (Proficient)';
    else if (totalScore >= 75) grade = 'B (Competent)';
    else if (totalScore >= 60) grade = 'C (Developing)';
    else grade = 'Retraining Required';

    // Generate actionable improvement tips based on recorded performance
    const tips = [];
    if (!this.passCompleted.P) {
      tips.push('Crucial: Always pull the safety pin before attempting to squeeze the discharge lever.');
    }
    if (accuracy < 60) {
      tips.push('Spray Accuracy: Aim directly at the fuel base where embers glow, not into rising smoke.');
    }
    if (!this.passCompleted.S2) {
      tips.push('Sweeping Motion: Practice smooth side-to-side sweeping across the entire flame perimeter.');
    }
    if (this.distanceViolations > 5) {
      tips.push('Safety Distance: Maintain at least 1.8m – 2.5m standoff to avoid toxic heat exposure.');
    }
    if (this.pickupTime > 12) {
      tips.push('Response Time: In a real emergency, locate and reach the extinguisher swiftly.');
    }
    if (tips.length === 0) {
      tips.push('Outstanding execution! You maintained proper distance, aim, and sweeping cadence.');
    }

    return {
      date: new Date().toLocaleTimeString(),
      completionTime: Math.round(this.completionTime * 10) / 10,
      pickupTime: Math.round(this.pickupTime * 10) / 10,
      pinPullTime: Math.round(this.pinPullTime * 10) / 10,
      aimTime: Math.round(this.firstValidAimTime * 10) / 10,
      passCompleted: { ...this.passCompleted },
      totalSprayDuration: Math.round(this.totalSprayDuration * 10) / 10,
      sprayOnTargetDuration: Math.round(this.sprayOnTargetDuration * 10) / 10,
      accuracy: accuracy,
      sweepScore: Math.round(this.sweepTimeAccumulated * 10) / 10,
      aimCorrectionsCount: this.aimCorrectionsCount,
      fireExtinguished: this.fireExtinguished,
      totalScore: totalScore,
      grade: grade,
      breakdown: {
        extinguish: extinguishPoints,
        pass: passPoints,
        accuracy: accuracyPoints,
        sweep: sweepPoints,
        distance: distancePoints,
        deduction: deduction
      },
      tips: tips,
      disclaimer: 'SafeSphere is an educational academic demonstration. This evaluation measures simulated technique adherence only and does not certify real-world firefighting qualification.'
    };
  }
}
