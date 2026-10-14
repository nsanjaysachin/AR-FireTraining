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
        <header class="top-bar hud-panel hud-interactive">
          <div class="brand-section">
            <div class="brand-logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div>
              <div class="brand-title">SAFESPHERE AR</div>
              <div class="brand-subtitle">FIRE EMERGENCY RESPONSE TRAINING</div>
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

            <button id="btn-audio-toggle" class="btn btn-icon-only" title="Toggle Sound">
              <span id="audio-icon">🔊</span>
            </button>
          </div>
        </header>

        <!-- Mid Row: PASS Checklist & Hazard Gauges -->
        <div class="hud-mid-row">
          <!-- Left: PASS Protocol Card -->
          <div class="pass-card hud-panel hud-interactive">
            <div class="card-title">
              <span>PASS PROTOCOL</span>
              <span class="card-subtitle">NFPA-10</span>
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
          <div class="hazard-card hud-panel hud-interactive">
            <div class="card-title">
              <span>FIRE SUPPRESSION</span>
              <span id="fire-health-val" class="health-percent">100%</span>
            </div>

            <div class="fire-bar-container">
              <div id="fire-bar-fill" class="fire-bar-fill" style="width: 100%;"></div>
            </div>

            <div class="distance-meter">
              <span class="distance-label">STANDOFF DISTANCE:</span>
              <span id="distance-val" class="distance-val">2.4 m</span>
            </div>
          </div>
        </div>

        <!-- Center Crosshair / Aim Guide -->
        <div id="center-reticle">
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" fill="none" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="4 4"/>
            <circle cx="20" cy="20" r="2" fill="#E2E8F0"/>
            <line x1="20" y1="0" x2="20" y2="7" stroke="#94A3B8" stroke-width="1.5"/>
            <line x1="20" y1="33" x2="20" y2="40" stroke="#94A3B8" stroke-width="1.5"/>
            <line x1="0" y1="20" x2="7" y2="20" stroke="#94A3B8" stroke-width="1.5"/>
            <line x1="33" y1="20" x2="40" y2="20" stroke="#94A3B8" stroke-width="1.5"/>
          </svg>
        </div>

        <!-- Bottom Guidance Ribbon & Controls -->
        <div class="hud-bottom-section">
          <div class="guidance-ribbon hud-panel hud-interactive">
            <div id="stage-badge" class="guidance-stage-tag">STANDBY</div>
            <div id="guidance-title" class="guidance-title">SafeSphere AR Fire Emergency Simulation</div>
            <div id="guidance-instruction" class="guidance-instruction">
              Click "Start AR Fire Training" to initialize the simulation and anchor the extinguisher in your room.
            </div>
            <div id="feedback-banner" class="feedback-banner"></div>
          </div>

          <!-- Direct Action Bar with prominent Start Button -->
          <div class="action-bar hud-panel hud-interactive">
            <button id="btn-start" class="btn btn-start-training" title="Start AR Fire Training Session">
              ▶ START AR FIRE TRAINING
            </button>
            <button id="btn-pull-pin" class="btn" title="Disengage safety pin (PASS: P)">
              ⚡ PULL PIN (P)
            </button>
            <button id="btn-squeeze" class="btn" title="Press and hold to discharge extinguishing powder (PASS: S)">
              🌊 SQUEEZE LEVER (S)
            </button>
            <button id="btn-reposition" class="btn" title="Reposition AR Anchor in front of current view">
              📍 REPOSITION ANCHOR
            </button>
            <button id="btn-toggle-mode" class="btn" title="Toggle between Camera CV and 3D Simulator">
              🔄 SWITCH MODE
            </button>
            <button id="btn-test-suite" class="btn btn-secondary" title="Run 10-Test Diagnostic Acceptance Suite">
              🧪 DIAGNOSTIC TESTS
            </button>
          </div>
        </div>
      </div>

      <!-- Performance Results Modal -->
      <div id="results-modal" class="modal-overlay">
        <div class="modal-card hud-panel" style="max-width: 560px;">
          <div class="score-badge-circle">
            <div id="final-score-val" class="score-num">95</div>
            <div class="score-label">Score / 100</div>
          </div>

          <div id="res-grade-val" class="grade-label">Grade: A+ (Exemplary)</div>

          <h2 style="text-align: center; font-size: 1.25rem; margin-bottom: 2px;">Training Session Complete</h2>
          <p style="text-align: center; font-size: 0.8rem; color: #8B949E; margin-bottom: 14px;">
            SafeSphere PASS Emergency Evaluation Report
          </p>

          <table class="results-table">
            <tbody>
              <tr><td>Total Completion Time</td><td id="res-total-time">14.2 s</td></tr>
              <tr><td>Extinguisher Pickup Reaction</td><td id="res-pickup-time">3.1 s</td></tr>
              <tr><td>Pin Disengagement Time</td><td id="res-pin-time">4.2 s</td></tr>
              <tr><td>Time to Valid Base Aim</td><td id="res-aim-time">6.5 s</td></tr>
              <tr><td>Aim Accuracy (% on Fuel Base)</td><td id="res-accuracy">84%</td></tr>
              <tr><td>Side-to-Side Sweep Cadence</td><td id="res-sweep">PASS (10/10)</td></tr>
              <tr><td>Aim Corrections Count</td><td id="res-corrections">2</td></tr>
              <tr><td>Hazard Neutralized</td><td id="res-extinguished" style="color: #2EA043;">SUCCESS</td></tr>
            </tbody>
          </table>

          <div style="font-size: 0.82rem; font-weight: 700; color: #E6EDF3; margin-top: 10px;">
            Actionable Training Feedback:
          </div>
          <ul id="res-tips-list" class="tips-list"></ul>

          <div class="disclaimer-box">
            <strong>Educational Notice:</strong> SafeSphere is an educational simulation demonstrating PASS mechanics. Follow official local building emergency procedures in a real fire incident.
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px;">
            <button id="btn-retry" class="btn btn-primary" style="flex: 1; justify-content: center;">
              🔄 Practice Again
            </button>
            <button id="btn-print-report" class="btn btn-secondary" style="flex: 1; justify-content: center;">
              🖨️ Export PDF / Print
            </button>
            <button id="btn-close-results" class="btn btn-secondary" style="flex: 1; justify-content: center;">
              Close Summary
            </button>
          </div>
        </div>
      </div>

      <!-- Diagnostic Acceptance Test Suite Modal -->
      <div id="test-modal" class="modal-overlay">
        <div class="modal-card hud-panel" style="max-width: 660px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <h2 style="font-size: 1.2rem;">10-Point Technical Acceptance Suite</h2>
              <div style="font-size: 0.75rem; color: #8B949E; font-family: var(--font-mono);">
                Specification Verification & Diagnostic Audit
              </div>
            </div>
            <button id="btn-run-tests" class="btn btn-primary">
              ▶ Run Diagnostics
            </button>
          </div>

          <div id="test-report-list" class="test-report-list">
            <div style="text-align: center; padding: 30px; color: #8B949E; font-size: 0.85rem;">
              Click "Run Diagnostics" to execute tests 1 through 10: Anchor Stability, Grab Range, Natural Movement, Aiming, Suppression Curve, Release, Completion, Failure Recovery, Repeatability, and Real Device validation.
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;">
            <button id="btn-close-tests" class="btn btn-secondary">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Start AR Fire Training button
    const btnStart = document.getElementById('btn-start');
    btnStart.addEventListener('click', () => {
      btnStart.textContent = '🔄 RESTART SESSION';
      if (this.callbacks.onStart) this.callbacks.onStart();
    });

    // Pull pin button
    document.getElementById('btn-pull-pin').addEventListener('click', () => {
      if (this.callbacks.onPullPin) this.callbacks.onPullPin();
    });

    // Squeeze lever button (hold to spray, release to stop)
    const btnSqueeze = document.getElementById('btn-squeeze');
    let isSqueezing = false;

    const startSqueeze = (e) => {
      e.preventDefault();
      if (!isSqueezing) {
        isSqueezing = true;
        btnSqueeze.classList.add('btn-active-squeeze');
        if (this.callbacks.onSqueeze) this.callbacks.onSqueeze(true);
      }
    };

    const stopSqueeze = (e) => {
      e.preventDefault();
      if (isSqueezing) {
        isSqueezing = false;
        btnSqueeze.classList.remove('btn-active-squeeze');
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
    btn.textContent = isSimulator ? '📷 CAMERA AR' : '🔄 3D SIMULATOR';
  }
}
