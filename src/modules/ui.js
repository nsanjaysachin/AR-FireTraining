import { soundFx } from './audio.js';
import { TRACKING_MODE } from './handTracking.js';

export class SafeSphereUI {
  constructor(appContainer) {
    this.app = appContainer;
    this.callbacks = {};
    this.buildDOM();
    this.bindEvents();
  }

  setCallbacks(cbs) {
    this.callbacks = cbs;
  }

  buildDOM() {
    this.app.innerHTML = `
      <div id="canvas-container"></div>

      <div id="hud-overlay">
        <!-- Top Status Bar -->
        <header class="top-bar glass-panel hud-interactive">
          <div class="brand-section">
            <div class="brand-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div>
              <div class="brand-title">SAFESPHERE AR</div>
              <div class="brand-subtitle">COLLEGE PROJECT DEMO • SOLVETHON</div>
            </div>
          </div>

          <div class="status-badges">
            <div id="ar-status-badge" class="badge badge-active" title="AR World Anchor Status">
              <span class="badge-dot"></span>
              <span id="ar-status-text">CAMERA AR</span>
            </div>

            <div id="hand-status-badge" class="badge" title="Computer Vision Hand Tracking">
              <span class="badge-dot"></span>
              <span id="hand-status-text">HAND SEARCHING</span>
            </div>

            <div id="timer-display" class="session-timer">00:00</div>

            <button id="btn-voice-toggle" class="btn btn-icon-only" title="Toggle AI Voice Guidance">
              <span id="voice-icon">🗣️</span>
            </button>

            <button id="btn-audio-toggle" class="btn btn-icon-only" title="Toggle Sound FX">
              <span id="audio-icon">🔊</span>
            </button>
          </div>
        </header>

        <!-- Mid Row: PASS Checklist & Hazard Gauges -->
        <div class="hud-mid-row">
          <!-- Left: PASS Protocol Card -->
          <div class="pass-card glass-panel hud-interactive">
            <div class="card-title">
              <span>PASS PROTOCOL</span>
              <span style="font-size: 0.65rem; color: #94A3B8;">NFPA-10</span>
            </div>

            <div id="pass-step-p" class="pass-step-item">
              <div class="pass-letter">P</div>
              <div class="pass-text">
                <div class="pass-text-title">Pull Safety Pin</div>
              </div>
            </div>

            <div id="pass-step-a" class="pass-step-item">
              <div class="pass-letter">A</div>
              <div class="pass-text">
                <div class="pass-text-title">Aim at Fire Base</div>
              </div>
            </div>

            <div id="pass-step-s" class="pass-step-item">
              <div class="pass-letter">S</div>
              <div class="pass-text">
                <div class="pass-text-title">Squeeze Lever</div>
              </div>
            </div>

            <div id="pass-step-s2" class="pass-step-item">
              <div class="pass-letter">S</div>
              <div class="pass-text">
                <div class="pass-text-title">Sweep Side-to-Side</div>
              </div>
            </div>
          </div>

          <!-- Right: Hazard Suppression & Standoff Gauge -->
          <div class="hazard-card glass-panel hud-interactive">
            <div class="card-title">
              <span>HAZARD SUPPRESSION</span>
              <span id="fire-health-val" style="color: #EF4444; font-weight: 700;">100%</span>
            </div>

            <div class="fire-bar-container">
              <div id="fire-bar-fill" class="fire-bar-fill" style="width: 100%;"></div>
            </div>

            <div class="distance-meter">
              <span style="color: #94A3B8;">STANDOFF:</span>
              <span id="distance-val" class="distance-val">2.4 m</span>
            </div>
          </div>
        </div>

        <!-- Center Crosshair / Aim Guide -->
        <div id="center-reticle" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; opacity: 0.45;">
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="4 4"/>
            <circle cx="22" cy="22" r="2.5" fill="#38BDF8"/>
            <line x1="22" y1="0" x2="22" y2="8" stroke="#38BDF8" stroke-width="1.5"/>
            <line x1="22" y1="36" x2="22" y2="44" stroke="#38BDF8" stroke-width="1.5"/>
            <line x1="0" y1="22" x2="8" y2="22" stroke="#38BDF8" stroke-width="1.5"/>
            <line x1="36" y1="22" x2="44" y2="22" stroke="#38BDF8" stroke-width="1.5"/>
          </svg>
        </div>

        <!-- Bottom Guidance Ribbon & Controls -->
        <div class="hud-bottom-section">
          <div class="guidance-ribbon glass-panel hud-interactive">
            <div id="stage-badge" class="guidance-stage-tag">STANDBY</div>
            <div id="guidance-title" class="guidance-title">SafeSphere AR Fire Emergency Simulation</div>
            <div id="guidance-instruction" class="guidance-instruction">
              Welcome to SafeSphere. Calibrate your environment and extend your hand toward the extinguisher to begin.
            </div>
            <div id="feedback-banner" class="feedback-banner"></div>
          </div>

          <!-- Quick Action Bar -->
          <div class="action-bar glass-panel hud-interactive">
            <button id="btn-start" class="btn btn-primary" title="Start standard training session">
              ▶ Start Training
            </button>
            <button id="btn-guide-demo" class="btn btn-success" title="Run automated presentation walkthrough for faculty/guide">
              🎓 Guide Demo
            </button>
            <button id="btn-pull-pin" class="btn" title="Disengage safety pin (PASS: P)">
              ⚡ Pull Pin (P)
            </button>
            <button id="btn-squeeze" class="btn" title="Press and hold to discharge extinguishing powder (PASS: S)">
              🌊 Squeeze Lever (S)
            </button>
            <button id="btn-reposition" class="btn" title="Reposition AR Anchor in front of current view">
              📍 Reposition Anchor
            </button>
            <button id="btn-toggle-mode" class="btn" title="Toggle between Camera CV and Simulator Fallback">
              🔄 Switch Mode
            </button>
            <button id="btn-test-suite" class="btn btn-icon-only" title="Run 10-Test Diagnostic Acceptance Suite">
              🧪 Diagnostic Tests
            </button>
          </div>
        </div>
      </div>

      <!-- Welcome Onboarding Modal -->
      <div id="welcome-modal" class="modal-overlay active">
        <div class="modal-card glass-panel" style="max-width: 620px;">
          <div style="text-align: center; margin-bottom: 18px;">
            <div class="brand-logo" style="width: 44px; height: 44px; margin: 0 auto 10px;">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <h1 style="font-size: 1.45rem; font-weight: 800; letter-spacing: 0.5px;">SAFESPHERE AR</h1>
            <p style="font-size: 0.82rem; color: #38BDF8; font-family: var(--font-mono); font-weight: 600;">
              REAL-WORLD AR FIRE EXTINGUISHER EMERGENCY SIMULATION
            </p>
            <p style="font-size: 0.78rem; color: #94A3B8; margin-top: 4px;">
              College Project Demonstration • Solvethon Edition
            </p>
          </div>

          <div style="background: rgba(15, 23, 42, 0.7); border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.82rem; line-height: 1.55;">
            <div style="color: #FFFFFF; font-weight: 700; margin-bottom: 6px;">Key Engineering Features:</div>
            <ul style="list-style-type: '✓ '; padding-left: 14px; color: #E2E8F0;">
              <li><strong>Persistent 6DoF Spatial Anchoring</strong>: Stable world pose preserves position when camera orbits or translates.</li>
              <li><strong>Computer Vision Hand Tracking</strong>: Real-time 21 3D landmarks via MediaPipe with physical reach & hysteresis grab.</li>
              <li><strong>NFPA-10 PASS Protocol</strong>: Pull pin, Aim at base, Squeeze lever, Sweep side-to-side.</li>
              <li><strong>Continuous Volumetric Fire & Suppression</strong>: Multi-layer procedural flames, embers, smoke, and powder physics.</li>
              <li><strong>10-Point Technical Acceptance Test Suite</strong>: Fully verified automated diagnostics.</li>
            </ul>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button id="btn-launch-camera" class="btn btn-primary" style="padding: 12px; justify-content: center; font-size: 0.9rem;">
              📷 Launch Live Camera AR Mode
            </button>
            <div style="display: flex; gap: 10px;">
              <button id="btn-launch-sim" class="btn" style="flex: 1; padding: 10px; justify-content: center;">
                🎮 3D VR Simulation Bay
              </button>
              <button id="btn-launch-guide-demo" class="btn btn-success" style="flex: 1; padding: 10px; justify-content: center;">
                🎓 Guide Demo Walkthrough
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Performance Results Modal -->
      <div id="results-modal" class="modal-overlay">
        <div class="modal-card glass-panel" style="max-width: 580px;">
          <div class="score-badge-circle">
            <div id="final-score-val" class="score-num">95</div>
            <div class="score-label">Score / 100</div>
          </div>

          <div id="res-grade-val" style="font-size: 1.05rem; font-weight: 700; color: #38BDF8; text-align: center; margin-bottom: 4px; font-family: var(--font-mono);">
            Grade: A+ (Exemplary)
          </div>

          <h2 style="text-align: center; font-size: 1.25rem; margin-bottom: 2px;">Emergency Response Assessment</h2>
          <p style="text-align: center; font-size: 0.78rem; color: #94A3B8; margin-bottom: 14px;">
            Institutional PASS Training Report • SafeSphere Engine
          </p>

          <table class="results-table">
            <tbody>
              <tr><td>Total Completion Time</td><td id="res-total-time">14.2 s</td></tr>
              <tr><td>Extinguisher Pickup Reaction</td><td id="res-pickup-time">3.1 s</td></tr>
              <tr><td>Pin Disengagement Time</td><td id="res-pin-time">4.2 s</td></tr>
              <tr><td>Time to Valid Base Aim</td><td id="res-aim-time">6.5 s</td></tr>
              <tr><td>Aim Accuracy (% on Fuel Base)</td><td id="res-accuracy">84%</td></tr>
              <tr><td>Side-to-Side Sweep Cadence</td><td id="res-sweep">Active (10/10)</td></tr>
              <tr><td>Aim Corrections Count</td><td id="res-corrections">2</td></tr>
              <tr><td>Hazard Neutralized</td><td id="res-extinguished" style="color: #00E676;">SUCCESS</td></tr>
            </tbody>
          </table>

          <div style="font-size: 0.82rem; font-weight: 700; color: #38BDF8; margin-top: 10px;">
            Actionable Training Feedback:
          </div>
          <ul id="res-tips-list" class="tips-list"></ul>

          <div class="disclaimer-box">
            <strong>Academic Educational Disclaimer:</strong> SafeSphere is a university prototype designed for emergency training simulation. It demonstrates proper PASS mechanics but does not substitute for certified NFPA-compliant firefighting qualifications.
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px;">
            <button id="btn-retry" class="btn btn-primary" style="flex: 1; justify-content: center;">
              🔄 Practice Again
            </button>
            <button id="btn-print-report" class="btn btn-success" style="flex: 1; justify-content: center;">
              🖨️ Export PDF / Print
            </button>
            <button id="btn-close-results" class="btn" style="flex: 1; justify-content: center;">
              Close Summary
            </button>
          </div>
        </div>
      </div>

      <!-- Diagnostic Acceptance Test Suite Modal -->
      <div id="test-modal" class="modal-overlay">
        <div class="modal-card glass-panel" style="max-width: 660px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <h2 style="font-size: 1.25rem;">10-Point Technical Acceptance Suite</h2>
              <div style="font-size: 0.75rem; color: #38BDF8; font-family: var(--font-mono);">
                Specification Verification & Diagnostic Audit
              </div>
            </div>
            <button id="btn-run-tests" class="btn btn-primary">
              ▶ Run Diagnostics
            </button>
          </div>

          <div id="test-report-list" class="test-report-list">
            <div style="text-align: center; padding: 30px; color: #94A3B8; font-size: 0.85rem;">
              Click "Run Diagnostics" to execute tests 1 through 10: Anchor Stability, Grab Range, Natural Movement, Aiming, Suppression Curve, Release, Completion, Failure Recovery, Repeatability, and Real Device validation.
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;">
            <button id="btn-close-tests" class="btn">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Welcome Modal buttons
    document.getElementById('btn-launch-camera').addEventListener('click', () => {
      document.getElementById('welcome-modal').classList.remove('active');
      if (this.callbacks.onStart) this.callbacks.onStart();
    });

    document.getElementById('btn-launch-sim').addEventListener('click', () => {
      document.getElementById('welcome-modal').classList.remove('active');
      if (this.callbacks.onToggleMode) this.callbacks.onToggleMode();
      if (this.callbacks.onStart) this.callbacks.onStart();
    });

    document.getElementById('btn-launch-guide-demo').addEventListener('click', () => {
      document.getElementById('welcome-modal').classList.remove('active');
      if (this.callbacks.onGuideDemo) this.callbacks.onGuideDemo();
    });

    // Start button
    document.getElementById('btn-start').addEventListener('click', () => {
      if (this.callbacks.onStart) this.callbacks.onStart();
    });

    // Guide Demo button in action bar
    document.getElementById('btn-guide-demo').addEventListener('click', () => {
      if (this.callbacks.onGuideDemo) this.callbacks.onGuideDemo();
    });

    // Pull pin button
    document.getElementById('btn-pull-pin').addEventListener('click', () => {
      if (this.callbacks.onPullPin) this.callbacks.onPullPin();
    });

    // Squeeze lever button
    const btnSqueeze = document.getElementById('btn-squeeze');
    let isSqueezing = false;

    const startSqueeze = (e) => {
      e.preventDefault();
      if (!isSqueezing) {
        isSqueezing = true;
        btnSqueeze.classList.add('btn-danger');
        if (this.callbacks.onSqueeze) this.callbacks.onSqueeze(true);
      }
    };

    const stopSqueeze = (e) => {
      e.preventDefault();
      if (isSqueezing) {
        isSqueezing = false;
        btnSqueeze.classList.remove('btn-danger');
        if (this.callbacks.onSqueeze) this.callbacks.onSqueeze(false);
      }
    };

    btnSqueeze.addEventListener('mousedown', startSqueeze);
    window.addEventListener('mouseup', stopSqueeze);
    btnSqueeze.addEventListener('touchstart', startSqueeze, { passive: false });
    window.addEventListener('touchend', stopSqueeze);

    // Reposition anchor button
    document.getElementById('btn-reposition').addEventListener('click', () => {
      if (this.callbacks.onReposition) this.callbacks.onReposition();
    });

    // Mode toggle button (Camera CV vs Simulator Fallback)
    document.getElementById('btn-toggle-mode').addEventListener('click', () => {
      if (this.callbacks.onToggleMode) this.callbacks.onToggleMode();
    });

    // Audio mute button
    document.getElementById('btn-audio-toggle').addEventListener('click', () => {
      const isMuted = soundFx.toggleMute();
      document.getElementById('audio-icon').textContent = isMuted ? '🔇' : '🔊';
    });

    // Voice guidance toggle button
    document.getElementById('btn-voice-toggle').addEventListener('click', () => {
      const isVoiceOn = soundFx.toggleVoice();
      document.getElementById('voice-icon').textContent = isVoiceOn ? '🗣️' : '🤫';
    });

    // Test Suite button
    document.getElementById('btn-test-suite').addEventListener('click', () => {
      document.getElementById('test-modal').classList.add('active');
    });

    document.getElementById('btn-close-tests').addEventListener('click', () => {
      document.getElementById('test-modal').classList.remove('active');
    });

    document.getElementById('btn-run-tests').addEventListener('click', () => {
      if (this.callbacks.onRunTests) this.callbacks.onRunTests();
    });

    // Results modal buttons
    document.getElementById('btn-retry').addEventListener('click', () => {
      document.getElementById('results-modal').classList.remove('active');
      if (this.callbacks.onRetry) this.callbacks.onRetry();
    });

    document.getElementById('btn-close-results').addEventListener('click', () => {
      document.getElementById('results-modal').classList.remove('active');
    });

    // Print / PDF Export
    document.getElementById('btn-print-report').addEventListener('click', () => {
      window.print();
    });
  }

  updateStage(stage, prompt) {
    document.getElementById('stage-badge').textContent = prompt.badge;
    document.getElementById('guidance-title').textContent = prompt.title;
    document.getElementById('guidance-instruction').textContent = prompt.instruction;
  }

  updateTick(data) {
    // Format timer
    const mins = Math.floor(data.elapsed / 60);
    const secs = Math.floor(data.elapsed % 60);
    document.getElementById('timer-display').textContent =
      `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // Fire Health
    const healthPercent = Math.round(data.fireHealth);
    document.getElementById('fire-health-val').textContent = `${healthPercent}%`;
    document.getElementById('fire-bar-fill').style.width = `${healthPercent}%`;

    // Distance
    const distEl = document.getElementById('distance-val');
    distEl.textContent = `${data.distToFire.toFixed(1)} m`;
    if (data.distToFire < 1.6) {
      distEl.className = 'distance-val distance-danger';
    } else {
      distEl.className = 'distance-val';
    }

    // PASS status updates
    this.updatePassStep('p', data.passState.P, data.isPinPulled);
    this.updatePassStep('a', data.passState.A, data.stage === 'APPROACH_AIM' || data.stage === 'SUPPRESSION');
    this.updatePassStep('s', data.passState.S, data.isSqueezing);
    this.updatePassStep('s2', data.passState.S2, data.passState.S2);

    // Hand status pill
    const handStatusPill = document.getElementById('hand-status-badge');
    const handStatusText = document.getElementById('hand-status-text');

    if (data.handState.mode === TRACKING_MODE.SIMULATOR_FALLBACK) {
      handStatusPill.className = 'badge badge-warning';
      handStatusText.textContent = 'SIMULATOR POINTER';
    } else if (data.handState.isHandDetected) {
      handStatusPill.className = 'badge badge-active';
      handStatusText.textContent = data.handState.isGrabbing
        ? 'HAND: GRABBING'
        : (data.handState.inRange ? 'HAND: IN REACH' : 'HAND DETECTED');
    } else {
      handStatusPill.className = 'badge';
      handStatusText.textContent = 'HAND SEARCHING';
    }
  }

  updatePassStep(letter, isDone, isActive) {
    const el = document.getElementById(`pass-step-${letter}`);
    if (!el) return;
    if (isDone) {
      el.className = 'pass-step-item pass-step-done';
    } else if (isActive) {
      el.className = 'pass-step-item pass-step-active';
    } else {
      el.className = 'pass-step-item';
    }
  }

  showFeedback(text) {
    const banner = document.getElementById('feedback-banner');
    if (!text) {
      banner.className = 'feedback-banner';
      banner.textContent = '';
    } else {
      banner.className = 'feedback-banner show';
      banner.textContent = text;
    }
  }

  showResults(report) {
    document.getElementById('final-score-val').textContent = report.totalScore;
    document.getElementById('res-grade-val').textContent = `Grade: ${report.grade || 'A+ (Exemplary)'}`;
    document.getElementById('res-total-time').textContent = `${report.completionTime} s`;
    document.getElementById('res-pickup-time').textContent = `${report.pickupTime} s`;
    document.getElementById('res-pin-time').textContent = `${report.pinPullTime} s`;
    document.getElementById('res-aim-time').textContent = `${report.aimTime} s`;
    document.getElementById('res-accuracy').textContent = `${report.accuracy}%`;
    document.getElementById('res-sweep').textContent = report.passCompleted.S2 ? 'PASS (10/10)' : `${report.sweepScore} s`;
    document.getElementById('res-corrections').textContent = report.aimCorrectionsCount;

    const tipsContainer = document.getElementById('res-tips-list');
    tipsContainer.innerHTML = '';
    report.tips.forEach(tip => {
      const li = document.createElement('li');
      li.textContent = tip;
      tipsContainer.appendChild(li);
    });

    document.getElementById('results-modal').classList.add('active');
  }

  renderTestResults(results) {
    const container = document.getElementById('test-report-list');
    container.innerHTML = '';

    results.forEach(res => {
      const item = document.createElement('div');
      item.className = 'test-item';
      item.innerHTML = `
        <div class="test-item-header">
          <span>TEST ${res.testId}: ${res.name}</span>
          <span class="${res.status === 'pass' ? 'test-badge-pass' : 'test-badge-fail'}">
            ${res.status.toUpperCase()}
          </span>
        </div>
        <div class="test-desc">${res.details}</div>
      `;
      container.appendChild(item);
    });
  }

  setTrackingModeLabel(label, isWarning = false) {
    const badge = document.getElementById('ar-status-badge');
    const text = document.getElementById('ar-status-text');
    text.textContent = label;
    badge.className = isWarning ? 'badge badge-warning' : 'badge badge-active';
  }

  setSimulatorToggleLabel(isSimulator) {
    const btn = document.getElementById('btn-toggle-mode');
    btn.textContent = isSimulator ? '📷 Switch to Camera AR' : '🔄 Switch to Simulator';
  }
}
