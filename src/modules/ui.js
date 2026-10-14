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

      <!-- Live Minimal AR HUD -->
      <div id="hud-overlay">
        <!-- Minimal Top Status Bar -->
        <header class="top-bar hud-panel hud-interactive">
          <div class="brand-section">
            <span class="status-indicator-dot"></span>
            <span class="brand-title">SAFESPHERE AR</span>
          </div>

          <div class="status-badges">
            <span id="ar-status-text" class="badge badge-active">CAMERA AR</span>
            <span id="timer-display" class="session-timer">00:00</span>
            <button id="btn-audio-toggle" class="btn btn-icon-only" title="Toggle Sound">
              <span id="audio-icon">🔊</span>
            </button>
            <button id="btn-open-tests" class="btn btn-icon-only btn-secondary" title="Diagnostic Tests">
              <span>🧪</span>
            </button>
          </div>
        </header>

        <!-- Mid Row: Compact PASS Status & Fire Health -->
        <div class="hud-mid-row" id="scenario-metrics" style="display: none;">
          <!-- Compact PASS Pill Group -->
          <div class="pass-mini-group hud-panel">
            <div id="pass-step-p" class="pass-mini-pill" title="Pull Pin">P</div>
            <div id="pass-step-a" class="pass-mini-pill" title="Aim Base">A</div>
            <div id="pass-step-s" class="pass-mini-pill" title="Squeeze">S</div>
            <div id="pass-step-s2" class="pass-mini-pill" title="Sweep">S</div>
          </div>

          <!-- Minimal Fire Health Meter -->
          <div class="hazard-mini-panel hud-panel">
            <div class="hazard-mini-header">
              <span>FIRE</span>
              <span id="fire-health-val">100%</span>
              <span id="distance-val" class="dist-tag">2.4m</span>
            </div>
            <div class="fire-bar-container">
              <div id="fire-bar-fill" class="fire-bar-fill" style="width: 100%;"></div>
            </div>
          </div>
        </div>

        <!-- Center Aim Crosshair -->
        <div id="center-reticle">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="3 3"/>
            <circle cx="18" cy="18" r="2" fill="#38BDF8"/>
            <line x1="18" y1="0" x2="18" y2="6" stroke="#38BDF8" stroke-width="1.5"/>
            <line x1="18" y1="30" x2="18" y2="36" stroke="#38BDF8" stroke-width="1.5"/>
            <line x1="0" y1="18" x2="6" y2="18" stroke="#38BDF8" stroke-width="1.5"/>
            <line x1="30" y1="18" x2="36" y2="18" stroke="#38BDF8" stroke-width="1.5"/>
          </svg>
        </div>

        <!-- Bottom Minimal Live Guidance Banner -->
        <div class="hud-bottom-section">
          <div class="guidance-pill hud-panel hud-interactive">
            <span id="stage-badge" class="guidance-tag">SCANNING</span>
            <span id="guidance-instruction" class="guidance-text">Move phone to scan room floor</span>
            <span id="spray-active-tag" class="spray-active-tag">🔴 DISCHARGING</span>
          </div>
          <div id="feedback-banner" class="feedback-banner"></div>
        </div>
      </div>

      <!-- Minimal Performance Results Card -->
      <div id="results-modal" class="modal-overlay">
        <div class="modal-card hud-panel" style="max-width: 400px; text-align: center;">
          <div class="score-badge-circle">
            <div id="final-score-val" class="score-num">95</div>
            <div class="score-label">Score / 100</div>
          </div>

          <div id="res-grade-val" class="grade-label">Grade: A+ (Exemplary)</div>
          <h2 style="font-size: 1.15rem; margin-bottom: 6px;">Fire Extinguished!</h2>
          <p id="res-total-time" style="font-size: 0.85rem; color: #8B949E; margin-bottom: 16px;">
            Completed in 14.2s
          </p>

          <button id="btn-retry" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 12px;">
            🔄 Practice Again
          </button>
        </div>
      </div>

      <!-- Diagnostic Acceptance Test Suite Modal -->
      <div id="test-modal" class="modal-overlay">
        <div class="modal-card hud-panel" style="max-width: 600px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h2 style="font-size: 1.1rem;">10-Point Technical Acceptance Suite</h2>
            <button id="btn-run-tests" class="btn btn-primary">▶ Run Diagnostics</button>
          </div>
          <div id="test-report-list" class="test-report-list">
            <div style="text-align: center; padding: 24px; color: #8B949E; font-size: 0.82rem;">
              Click "Run Diagnostics" to execute automated technical tests 1 to 10.
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
            <button id="btn-close-tests" class="btn btn-secondary">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Audio mute button
    const btnAudio = document.getElementById('btn-audio-toggle');
    if (btnAudio) {
      const toggleAudio = (e) => {
        if (e) e.stopPropagation();
        const isMuted = soundFx.toggleMute();
        const icon = document.getElementById('audio-icon');
        if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
      };
      btnAudio.addEventListener('click', toggleAudio);
      btnAudio.addEventListener('touchend', toggleAudio);
    }

    // Diagnostic tests
    const btnOpenTests = document.getElementById('btn-open-tests');
    if (btnOpenTests) {
      btnOpenTests.addEventListener('click', () => {
        document.getElementById('test-modal').classList.add('active');
      });
    }

    const btnCloseTests = document.getElementById('btn-close-tests');
    if (btnCloseTests) {
      btnCloseTests.addEventListener('click', () => {
        document.getElementById('test-modal').classList.remove('active');
      });
    }

    const btnRunTests = document.getElementById('btn-run-tests');
    if (btnRunTests) {
      btnRunTests.addEventListener('click', () => {
        if (this.callbacks.onRunTests) this.callbacks.onRunTests();
      });
    }

    // Results modal buttons
    const btnRetry = document.getElementById('btn-retry');
    if (btnRetry) {
      btnRetry.addEventListener('click', () => {
        document.getElementById('results-modal').classList.remove('active');
        if (this.callbacks.onRetry) this.callbacks.onRetry();
      });
    }
  }

  updateStage(stage, prompt) {
    const stageBadge = document.getElementById('stage-badge');
    const guidanceInstruction = document.getElementById('guidance-instruction');
    const metricsRow = document.getElementById('scenario-metrics');

    if (stageBadge) stageBadge.textContent = prompt.badge;
    if (guidanceInstruction) guidanceInstruction.textContent = prompt.instruction;

    // Show fire metrics only once fire is deployed
    if (metricsRow) {
      const isFireActive = stage !== 'INTRO' && stage !== 'SETUP' && stage !== 'PLACEMENT';
      metricsRow.style.display = isFireActive ? 'flex' : 'none';
    }
  }

  updateTick(data) {
    // Timer
    const mins = Math.floor(data.elapsed / 60);
    const secs = Math.floor(data.elapsed % 60);
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
      timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // Fire Health
    const healthPercent = Math.round(data.fireHealth);
    const healthVal = document.getElementById('fire-health-val');
    const healthFill = document.getElementById('fire-bar-fill');
    if (healthVal) healthVal.textContent = `${healthPercent}%`;
    if (healthFill) healthFill.style.width = `${healthPercent}%`;

    // Distance
    const distEl = document.getElementById('distance-val');
    if (distEl) {
      distEl.textContent = `${data.distToFire.toFixed(1)}m`;
    }

    // Spray tag active
    const sprayTag = document.getElementById('spray-active-tag');
    if (sprayTag) {
      sprayTag.style.display = data.isSqueezing ? 'inline-block' : 'none';
    }

    // PASS status updates
    this.updatePassStep('p', data.passState.P, data.isPinPulled);
    this.updatePassStep('a', data.passState.A, data.stage === 'APPROACH_AIM' || data.stage === 'SUPPRESSION');
    this.updatePassStep('s', data.passState.S, data.isSqueezing);
    this.updatePassStep('s2', data.passState.S2, data.passState.S2);
  }

  updatePassStep(letter, isDone, isActive) {
    const el = document.getElementById(`pass-step-${letter}`);
    if (!el) return;
    if (isDone) {
      el.className = 'pass-mini-pill pass-mini-done';
    } else if (isActive) {
      el.className = 'pass-mini-pill pass-mini-active';
    } else {
      el.className = 'pass-mini-pill';
    }
  }

  showFeedback(text) {
    const banner = document.getElementById('feedback-banner');
    if (!banner) return;
    if (!text) {
      banner.style.display = 'none';
      banner.textContent = '';
    } else {
      banner.style.display = 'inline-block';
      banner.textContent = text;
    }
  }

  showResults(report) {
    const finalScore = document.getElementById('final-score-val');
    const resGrade = document.getElementById('res-grade-val');
    const resTotal = document.getElementById('res-total-time');

    if (finalScore) finalScore.textContent = report.totalScore;
    if (resGrade) resGrade.textContent = `Grade: ${report.grade || 'A+ (Exemplary)'}`;
    if (resTotal) resTotal.textContent = `Extinguished in ${report.completionTime}s (PASS Accuracy: ${report.accuracy}%)`;

    const modal = document.getElementById('results-modal');
    if (modal) modal.classList.add('active');
  }

  renderTestResults(results) {
    const container = document.getElementById('test-report-list');
    if (!container) return;
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
    const text = document.getElementById('ar-status-text');
    if (text) {
      text.textContent = label;
      text.className = isWarning ? 'badge badge-warning' : 'badge badge-active';
    }
  }

  setSimulatorToggleLabel(isSimulator) {}
  setHandScanProgress(progress, statusText) {}
  hideStartModal() {}
}
