/** A small, entirely procedural underwater soundscape. Sound is opt-in. */
export class Soundscape {
  constructor() {
    this.enabled = false;
    this.depth = 0;
    this.context = null;
    this.master = null;
    this.ambientFilter = null;
    this.ambientTone = null;
    this.suspendTimer = null;
    this.lastPlayed = new Map();
  }

  toggle() {
    if (!this.enabled && !this._initialize()) return false;
    this.enabled = !this.enabled;
    clearTimeout(this.suspendTimer);
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.enabled ? 0.4 : 0, now, 0.1);
    if (this.enabled) this.resume();
    else {
      this.suspendTimer = setTimeout(() => {
        if (!this.enabled) this.context?.suspend().catch(() => {});
      }, 500);
    }
    return this.enabled;
  }

  resume() {
    if (!this.enabled || !this.context) return;
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
  }

  setDepth(depth) {
    this.depth = Math.max(0, Math.min(12000, Number(depth) || 0));
    if (!this.context) return;
    const descent = this.depth / 12000;
    const now = this.context.currentTime;
    this.ambientFilter.frequency.setTargetAtTime(340 - descent * 225, now, 1.5);
    this.ambientTone.frequency.setTargetAtTime(110 - descent * 48, now, 2);
  }

  play(type = 'click') {
    if (!this.enabled || !this.context) return;
    this.resume();
    const now = this.context.currentTime;
    // Collisions or repeated key presses should never become a wall of sound.
    if (now - (this.lastPlayed.get(type) ?? -Infinity) < 0.08) return;
    this.lastPlayed.set(type, now);
    const tone = (frequency, offset = 0, duration = 0.18, gain = 0.13, endFrequency) => {
      this._tone(frequency, now + offset, duration, gain, endFrequency);
    };

    switch (type) {
      case 'capture':
        tone(440, 0, 0.16, 0.13, 660);
        tone(880, 0.09, 0.24, 0.08);
        break;
      case 'sonar':
        tone(720, 0, 0.65, 0.12, 630);
        tone(720, 0.34, 0.55, 0.04, 630);
        break;
      case 'upgrade':
        [330, 440, 554.37, 660].forEach((note, i) => tone(note, i * 0.085, 0.3, 0.1));
        break;
      case 'level':
        [392, 493.88, 587.33, 783.99].forEach((note, i) => tone(note, i * 0.12, 0.4, 0.11));
        break;
      case 'warning':
        tone(220, 0, 0.2, 0.11);
        tone(196, 0.27, 0.25, 0.09);
        break;
      case 'discovery':
        [261.63, 392, 523.25, 659.25].forEach((note, i) => tone(note, i * 0.18, 0.8, 0.08));
        break;
      case 'return':
        [523.25, 440, 349.23, 261.63].forEach((note, i) => tone(note, i * 0.11, 0.32, 0.08));
        break;
      case 'launch':
        tone(165, 0, 0.7, 0.12, 330);
        tone(440, 0.3, 0.5, 0.06);
        break;
      default:
        tone(660, 0, 0.07, 0.06, 520);
    }
  }

  _initialize() {
    if (this.context) return true;
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return false;
    try {
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.context.destination);

      // Filtered, slow-moving water texture, kept well below interaction sounds.
      const buffer = this.context.createBuffer(1, this.context.sampleRate * 4, this.context.sampleRate);
      const samples = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < samples.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * 0.025) / 1.025;
        samples[i] = previous * 3;
      }
      const water = this.context.createBufferSource();
      water.buffer = buffer;
      water.loop = true;
      this.ambientFilter = this.context.createBiquadFilter();
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.Q.value = 0.4;
      const waterGain = this.context.createGain();
      waterGain.gain.value = 0.08;
      water.connect(this.ambientFilter).connect(waterGain).connect(this.master);
      water.start();

      this.ambientTone = this.context.createOscillator();
      this.ambientTone.type = 'sine';
      const toneGain = this.context.createGain();
      toneGain.gain.value = 0.015;
      this.ambientTone.connect(toneGain).connect(this.master);
      const tide = this.context.createOscillator();
      tide.frequency.value = 0.09;
      const tideGain = this.context.createGain();
      tideGain.gain.value = 0.008;
      tide.connect(tideGain).connect(toneGain.gain);
      this.ambientTone.start();
      tide.start();
      this.setDepth(this.depth);
      return true;
    } catch {
      this.context?.close().catch(() => {});
      this.context = null;
      this.master = null;
      return false;
    }
  }

  _tone(frequency, start, duration, volume, endFrequency) {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + Math.min(0.025, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.025);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }
}
