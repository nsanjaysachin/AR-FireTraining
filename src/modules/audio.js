// SafeSphere Audio Synthesizer & Voice Announcer using Web Audio & Web Speech APIs
// 100% procedural with zero external asset dependencies

class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isVoiceEnabled = true;
    this.sprayNode = null;
    this.sprayGain = null;
    this.fireNode = null;
    this.fireGain = null;
    this.initialized = false;
    this.lastSpokenText = '';
  }

  init() {
    if (this.initialized) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.initialized = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.fireGain) {
      this.fireGain.gain.setValueAtTime(this.isMuted ? 0 : 0.25, this.ctx.currentTime);
    }
    if (this.sprayGain && this.isMuted) {
      this.sprayGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  // PASS Step 1: Pull the pin (metallic clink and spring ping)
  playPinPull() {
    if (!this.initialized || this.isMuted) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1450, now);
    osc1.frequency.exponentialRampToValueAtTime(700, now + 0.18);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2900, now);
    osc2.frequency.exponentialRampToValueAtTime(1750, now + 0.35);

    gainNode.gain.setValueAtTime(0.45, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  }

  // Mechanical squeeze click
  playLeverSqueeze() {
    if (!this.initialized || this.isMuted) return;
    this.resume();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.06);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // High-pressure extinguisher spray
  startSpray() {
    if (!this.initialized || this.isMuted || this.sprayNode) return;
    this.resume();

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.sprayNode = this.ctx.createBufferSource();
    this.sprayNode.buffer = buffer;
    this.sprayNode.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1750, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.1, this.ctx.currentTime);

    this.sprayGain = this.ctx.createGain();
    this.sprayGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    this.sprayGain.gain.linearRampToValueAtTime(0.48, this.ctx.currentTime + 0.08);

    this.sprayNode.connect(filter);
    filter.connect(this.sprayGain);
    this.sprayGain.connect(this.ctx.destination);

    this.sprayNode.start();
  }

  stopSpray() {
    if (!this.sprayNode) return;
    const now = this.ctx.currentTime;
    if (this.sprayGain) {
      this.sprayGain.gain.linearRampToValueAtTime(0.01, now + 0.08);
    }
    setTimeout(() => {
      if (this.sprayNode) {
        try {
          this.sprayNode.stop();
          this.sprayNode.disconnect();
        } catch (_) {}
        this.sprayNode = null;
        this.sprayGain = null;
      }
    }, 90);
  }

  // Procedural Fire Crackle
  startFireSound() {
    if (!this.initialized || this.fireNode) return;
    this.resume();

    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      let sample = lastOut * 3.5;
      if (Math.random() < 0.0025) {
        sample += (Math.random() * 2 - 1) * 0.95;
      }
      data[i] = sample;
    }

    this.fireNode = this.ctx.createBufferSource();
    this.fireNode.buffer = buffer;
    this.fireNode.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, this.ctx.currentTime);

    this.fireGain = this.ctx.createGain();
    this.fireGain.gain.setValueAtTime(this.isMuted ? 0 : 0.28, this.ctx.currentTime);

    this.fireNode.connect(filter);
    filter.connect(this.fireGain);
    this.fireGain.connect(this.ctx.destination);

    this.fireNode.start();
  }

  updateFireVolume(healthRatio) {
    if (!this.fireGain || this.isMuted) return;
    const targetVol = Math.max(0, Math.min(1, healthRatio)) * 0.32;
    this.fireGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.1);
  }

  stopFireSound() {
    if (this.fireNode) {
      try {
        this.fireNode.stop();
        this.fireNode.disconnect();
      } catch (_) {}
      this.fireNode = null;
      this.fireGain = null;
    }
  }

  // Fanfare on extinguish
  playExtinguished() {
    if (!this.initialized || this.isMuted) return;
    this.resume();
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6
    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = this.ctx.currentTime + index * 0.10;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.28, time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.65);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.7);
    });
  }

  playWarning() {
    if (!this.initialized || this.isMuted) return;
    this.resume();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(460, now);
    osc.frequency.setValueAtTime(320, now + 0.12);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  }
}

export const soundFx = new SoundSynthesizer();
