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

      <!-- Live Mobile AR HUD (Zero action buttons during training) -->
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

            <button id="btn-open-tests" class="btn btn-icon-only btn-secondary" title="Technical Diagnostics (10 Acceptance Tests)">
              <span>🧪</span>
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

        <!-- Bottom Live Guidance Ribbon (Pure physical mobile interaction) -->
        <div class="hud-bottom-section">
          <div class="guidance-ribbon hud-panel hud-interactive">
            <div class="guidance-header-line">
              <div id="stage-badge" class="guidance-stage-tag">STANDBY</div>
              <div id="spray-active-tag" class="spray-active-tag">🔴 DISCHARGING POWDER</div>
            </div>
            <div id="guidance-title" class="guidance-title">SafeSphere AR Fire Emergency Simulation</div>
            <div id="guidance-instruction" class="guidance-instruction">
              Touch and hold screen to spray powder. Physically sweep phone side-to-side across the base of the fire!
            </div>

            <!-- Dynamic Sweep Gauge -->
            <div id="sweep-meter-container" class="sweep-meter-box">
              <span class="sweep-meter-title">HORIZONTAL SWEEP:</span>
              <div class="sweep-meter-bar">
                <div id="sweep-meter-fill" class="sweep-meter-fill"></div>
              </div>
            </div>

            <div id="feedback-banner" class="feedback-banner"></div>
          </div>
        </div>
      </div>

      <!-- Pre-Session Start Screen Modal -->
      <div id="start-modal" class="modal-overlay active">
        <div class="modal-card hud-panel start-card">
          <div class="brand-section" style="justify-content: center; margin-bottom: 8px;">
            <div class="brand-logo" style="width: 38px; height: 38px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
          </div>

          <h1 style="text-align: center; font-size: 1.35rem; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 2px;">
            SAFESPHERE AR
          </h1>
          <p style="text-align: center; font-size: 0.76rem; color: #8B949E; margin-bottom: 12px; font-family: var(--font-mono);">
            SURROUNDING SCANNER & BIOMETRIC HAND AR
          </p>

          <!-- Holographic Hand Biometric Scanner -->
          <div class="hand-scan-container" id="hand-scan-zone">
            <div class="scan-radar-grid"></div>
            <div class="scan-laser-line"></div>
            <div class="hand-icon-hologram">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v3"/>
                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v7"/>
                <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
              </svg>
            </div>
            <div id="hand-scan-label" class="hand-scan-status">
              ✋ SHOW HAND TO CAMERA TO ANALYSE & START
            </div>
            <div class="hand-scan-progress-bar">
              <div id="hand-scan-progress-fill" class="hand-scan-progress-fill"></div>
            </div>
          </div>

          <div class="mobile-features-box" style="margin-top: 10px; margin-bottom: 14px;">
            <div class="mobile-feat-title">📱 100% Mobile Phone Physical Controls:</div>
            <ul class="mobile-steps-list">
              <li>• <strong>Extinguisher:</strong> Reach hand or tap on screen to pick up</li>
              <li>• <strong>Safety Pin (P):</strong> Pinch or swipe yellow pin to unlock</li>
              <li>• <strong>Aim (A):</strong> Physically point and tilt your mobile phone</li>
              <li>• <strong>Squeeze (S):</strong> Press and hold phone screen (or clench fist)</li>
              <li>• <strong>Sweep (S):</strong> Physically sweep mobile phone side-to-side</li>
            </ul>
          </div>

          <button id="btn-start-ar" class="btn btn-primary btn-big-start">
            ▶ START AR FIRE TRAINING
          </button>
          <div style="font-size: 0.72rem; color: #8B949E; margin-top: 8px; font-family: var(--font-mono);">
            Tap button, touch screen, or show hand to camera to begin
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
    // Start AR Fire Training trigger (button, touch, pointer)
    const triggerStart = (e) => {
      if (e) {
        e.stopPropagation();
      }
      this.hideStartModal();
      if (this.callbacks.onStart) this.callbacks.onStart();
    };

    const btnStart = document.getElementById('btn-start-ar');
    if (btnStart) {
      btnStart.addEventListener('click', triggerStart);
      btnStart.addEventListener('touchend', triggerStart, { passive: false });
      btnStart.addEventListener('pointerup', triggerStart);
    }

    const startCard = document.querySelector('.start-card');
    if (startCard) {
      startCard.addEventListener('pointerup', (e) => {
        if (e.target.id === 'btn-start-ar') return; // Handled by button
        triggerStart(e);
      });
    }

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

    // Open Test Suite button
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

    const btnCloseResults = document.getElementById('btn-close-results');
    if (btnCloseResults) {
      btnCloseResults.addEventListener('click', () => {
        document.getElementById('results-modal').classList.remove('active');
      });
    }

    // Print / PDF Export
    const btnPrint = document.getElementById('btn-print-report');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        window.print();
      });
    }
  }

  updateStage(stage, prompt) {
    const stageBadge = document.getElementById('stage-badge');
    const guidanceTitle = document.getElementById('guidance-title');
    const guidanceInstruction = document.getElementById('guidance-instruction');

    if (stageBadge) stageBadge.textContent = prompt.badge;
    if (guidanceTitle) guidanceTitle.textContent = prompt.title;
    if (guidanceInstruction) guidanceInstruction.textContent = prompt.instruction;
  }

  updateTick(data) {
    // Format timer
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
      distEl.textContent = `${data.distToFire.toFixed(1)} m`;
      if (data.distToFire < 1.6) {
        distEl.className = 'distance-val distance-danger';
      } else {
        distEl.className = 'distance-val';
      }
    }

    // Spray tag active
    const sprayTag = document.getElementById('spray-active-tag');
    if (sprayTag) {
      sprayTag.style.display = data.isSqueezing ? 'inline-block' : 'none';
    }

    // Sweep meter fill
    const sweepFill = document.getElementById('sweep-meter-fill');
    if (sweepFill) {
      const sweepPercent = data.passState.S2 ? 100 : Math.min(100, Math.round((data.fireHealth < 95 ? (100 - data.fireHealth) * 1.05 : 0)));
      sweepFill.style.width = `${sweepPercent}%`;
    }

    // PASS status updates
    this.updatePassStep('p', data.passState.P, data.isPinPulled);
    this.updatePassStep('a', data.passState.A, data.stage === 'APPROACH_AIM' || data.stage === 'SUPPRESSION');
    this.updatePassStep('s', data.passState.S, data.isSqueezing);
    this.updatePassStep('s2', data.passState.S2, data.passState.S2);

    // Hand status pill
    const handStatusPill = document.getElementById('hand-status-badge');
    const handStatusText = document.getElementById('hand-status-text');

    if (handStatusPill && handStatusText) {
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
    if (!banner) return;
    if (!text) {
      banner.className = 'feedback-banner';
      banner.textContent = '';
    } else {
      banner.className = 'feedback-banner show';
      banner.textContent = text;
    }
  }

  showResults(report) {
    const finalScore = document.getElementById('final-score-val');
    const resGrade = document.getElementById('res-grade-val');
    const resTotal = document.getElementById('res-total-time');
    const resPickup = document.getElementById('res-pickup-time');
    const resPin = document.getElementById('res-pin-time');
    const resAim = document.getElementById('res-aim-time');
    const resAcc = document.getElementById('res-accuracy');
    const resSweep = document.getElementById('res-sweep');
    const resCorr = document.getElementById('res-corrections');

    if (finalScore) finalScore.textContent = report.totalScore;
    if (resGrade) resGrade.textContent = `Grade: ${report.grade || 'A+ (Exemplary)'}`;
    if (resTotal) resTotal.textContent = `${report.completionTime} s`;
    if (resPickup) resPickup.textContent = `${report.pickupTime} s`;
    if (resPin) resPin.textContent = `${report.pinPullTime} s`;
    if (resAim) resAim.textContent = `${report.aimTime} s`;
    if (resAcc) resAcc.textContent = `${report.accuracy}%`;
    if (resSweep) resSweep.textContent = report.passCompleted.S2 ? 'PASS (10/10)' : `${report.sweepScore} s`;
    if (resCorr) resCorr.textContent = report.aimCorrectionsCount;

    const tipsContainer = document.getElementById('res-tips-list');
    if (tipsContainer) {
      tipsContainer.innerHTML = '';
      report.tips.forEach(tip => {
        const li = document.createElement('li');
        li.textContent = tip;
        tipsContainer.appendChild(li);
      });
    }

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
    const badge = document.getElementById('ar-status-badge');
    const text = document.getElementById('ar-status-text');
    if (text) text.textContent = label;
    if (badge) badge.className = isWarning ? 'badge badge-warning' : 'badge badge-active';
  }

  setSimulatorToggleLabel(isSimulator) {
    // Handled in badges
  }

  setHandScanProgress(progress, statusText) {
    const fill = document.getElementById('hand-scan-progress-fill');
    const label = document.getElementById('hand-scan-label');
    if (fill) {
      fill.style.width = `${Math.min(100, Math.round(progress * 100))}%`;
    }
    if (label && statusText) {
      label.textContent = statusText;
    }
  }

  hideStartModal() {
    const modal = document.getElementById('start-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  }
}
