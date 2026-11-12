// An original eight-bar pentatonic theme, arranged for each part of the journey.
const MOTIF = [
  [0, null, 2, 3, 4, 3, 2, null], [1, null, 2, null, 3, 2, 1, null],
  [0, 2, 3, null, 5, null, 4, 3], [2, null, 1, null, 0, null, null, null],
  [0, null, 2, 3, 4, null, 5, 4], [3, null, 2, 1, 2, null, 3, null],
  [4, 3, 2, null, 1, 2, 1, null], [0, null, null, -2, 0, null, null, null],
];
const SCORES = {
  sun: { name: '日光漂流', bpm: 76, root: 72, scale: [0, 2, 4, 7, 9], wave: 'triangle', melody: .13, pad: .027, bass: .085, pulse: .026, chords: [[48, 55, 60, 64], [53, 60, 64, 69], [45, 52, 57, 60], [43, 50, 55, 62]] },
  twilight: { name: '暮色回声', bpm: 64, root: 69, scale: [0, 3, 5, 7, 10], wave: 'sine', melody: .17, pad: .032, bass: .09, pulse: .018, chords: [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 62]] },
  deep: { name: '星渊摇篮曲', bpm: 54, root: 62, scale: [0, 3, 5, 7, 10], wave: 'sine', melody: .18, pad: .036, bass: .10, pulse: .012, chords: [[38, 45, 50, 53], [46, 53, 57, 60], [41, 48, 53, 57], [36, 43, 48, 55]] },
  lab: { name: '好奇心实验室', bpm: 92, root: 76, scale: [0, 3, 5, 8, 10], wave: 'triangle', melody: .115, pad: .023, bass: .08, pulse: .035, chords: [[48, 55, 60, 64], [53, 60, 64, 69], [45, 52, 57, 60], [43, 50, 55, 62]] },
  port: { name: '归航的灯', bpm: 72, root: 67, scale: [0, 2, 5, 7, 9], wave: 'triangle', melody: .12, pad: .027, bass: .075, pulse: .016, chords: [[48, 55, 60, 64], [53, 60, 64, 69], [45, 52, 57, 60], [43, 50, 55, 62]] },
};
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const melodyPitch = (score, degree) => score.root + Math.floor(degree / 5) * 12 + score.scale[((degree % 5) + 5) % 5];

/** Opt-in music, water ambience and effects, synthesized without remote assets. */
export class Soundscape {
  constructor() {
    this.enabled = false;
    this.paused = false;
    this.volume = .7;
    this.depth = 0;
    this.scene = 'dive';
    this.context = null;
    this.master = null;
    this.ambientFilter = null;
    this.waterGain = null;
    this.musicBus = null;
    this.effectsBus = null;
    this.scheduler = null;
    this.suspendTimer = null;
    this.voices = new Set();
    this.persistentNodes = [];
    this.lastPlayed = new Map();
    this.scoreKey = this._getScoreKey();
    this.step = 0;
    this.nextStepTime = 0;
  }

  get sceneName() { return SCORES[this._getScoreKey()].name; }

  toggle() {
    // Only this gesture-driven entry point may create an AudioContext.
    if (!this.enabled && !this._initialize()) return false;
    this.enabled = !this.enabled;
    if (this.enabled) this.resume();
    else this._silence();
    return this.enabled;
  }

  resume() {
    if (!this._shouldPlay() || !this.context) return;
    clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
    const context = this.context;
    this._setMasterGain();
    if (context.state === 'running') this._startScheduler();
    else Promise.resolve(context.resume()).then(() => {
      if (context === this.context && this._shouldPlay() && context.state === 'running') this._startScheduler();
    }).catch(() => {});
  }

  setVolume(value) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) this.volume = clamp(numeric, 0, 1);
    if (this.context) {
      if (this._shouldPlay()) this.resume();
      else this._silence();
    }
    return this.volume;
  }

  setPaused(value) {
    const paused = Boolean(value);
    if (paused === this.paused) return;
    this.paused = paused;
    if (paused) this._silence();
    else this.resume();
  }

  setScene(scene) {
    if (!['dive', 'lab', 'port'].includes(scene) || scene === this.scene) return;
    this.scene = scene;
    this._refreshScore();
    this._setAmbience();
  }

  setDepth(depth) {
    this.depth = clamp(Number(depth) || 0, 0, 12000);
    this._refreshScore();
    this._setAmbience();
  }

  play(type = 'click') {
    if (!this._shouldPlay() || !this.context) return;
    this.resume();
    const now = this.context.currentTime;
    if (now - (this.lastPlayed.get(type) ?? -Infinity) < .08) return;
    this.lastPlayed.set(type, now);
    const tone = (hz, offset = 0, duration = .18, gain = .13, endFrequency) =>
      this._voice(hz, now + offset, duration, gain, { endFrequency, music: false });
    switch (type) {
      case 'capture': tone(440, 0, .16, .13, 660); tone(880, .09, .24, .08); break;
      case 'sonar': tone(720, 0, .65, .12, 630); tone(720, .34, .55, .04, 630); break;
      case 'upgrade': [330, 440, 554.37, 660].forEach((note, i) => tone(note, i * .085, .3, .1)); break;
      case 'level': [392, 493.88, 587.33, 783.99].forEach((note, i) => tone(note, i * .12, .4, .11)); break;
      case 'warning': tone(220, 0, .2, .11); tone(196, .27, .25, .09); break;
      case 'discovery': [261.63, 392, 523.25, 659.25].forEach((note, i) => tone(note, i * .18, .8, .08)); break;
      case 'return': [523.25, 440, 349.23, 261.63].forEach((note, i) => tone(note, i * .11, .32, .08)); break;
      case 'launch': tone(165, 0, .7, .12, 330); tone(440, .3, .5, .06); break;
      default: tone(660, 0, .07, .06, 520);
    }
  }

  _getScoreKey() {
    return this.scene === 'dive' ? this.depth < 200 ? 'sun' : this.depth < 1000 ? 'twilight' : 'deep' : this.scene;
  }
  _shouldPlay() { return this.enabled && !this.paused && this.volume > 0; }

  _refreshScore() {
    const key = this._getScoreKey();
    if (key === this.scoreKey) return;
    this.scoreKey = key;
    this.step = 0;
    if (!this.context) return;
    this._releaseVoices(true);
    this.nextStepTime = this.context.currentTime + .12;
    if (this.scheduler !== null) this._schedule();
  }

  _setAmbience() {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.ambientFilter.frequency.setTargetAtTime(340 - this.depth / 12000 * 225, now, 1.5);
    this.waterGain.gain.setTargetAtTime(this.scene === 'dive' ? .035 : this.scene === 'port' ? .008 : 0, now, .4);
  }

  _setMasterGain() {
    if (!this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this._shouldPlay() ? this.volume * .9 : 0, now, .06);
  }

  _startScheduler() {
    if (this.scheduler !== null || !this._shouldPlay() || this.context?.state !== 'running') return;
    this.nextStepTime = this.context.currentTime + .04;
    this._schedule();
    this.scheduler = setInterval(() => this._schedule(), 100);
  }

  _stopScheduler() {
    if (this.scheduler !== null) clearInterval(this.scheduler);
    this.scheduler = null;
  }

  _schedule() {
    if (!this._shouldPlay() || this.context?.state !== 'running') { this._stopScheduler(); return; }
    const now = this.context.currentTime;
    // A sleeping device must never trigger a burst of overdue notes.
    if (this.nextStepTime < now - .1) this.nextStepTime = now + .04;
    const score = SCORES[this.scoreKey], eighth = 30 / score.bpm;
    while (this.nextStepTime < now + .25) {
      this._scoreStep(score, this.step, this.nextStepTime, eighth);
      this.step = (this.step + 1) % 64;
      this.nextStepTime += eighth;
    }
  }

  _scoreStep(score, step, start, eighth) {
    const bar = Math.floor(step / 8), beat = step % 8;
    const chord = score.chords[bar % score.chords.length];
    if (beat === 0) {
      chord.forEach(note => this._voice(frequency(note + 12), start, eighth * 8 + .8, score.pad, { attack: .55, sustain: .8 }));
    }
    if (beat === 0 || beat === 4) this._voice(frequency(chord[0] + (beat === 4 ? 7 : 0) - (chord[0] >= 43 ? 12 : 0)), start, eighth * 3.5, score.bass, { attack: .025, sustain: .55 });
    const degree = MOTIF[bar][beat];
    if (degree !== null) {
      const note = melodyPitch(score, degree);
      this._voice(frequency(note), start, eighth * (MOTIF[bar][beat + 1] == null ? 2.5 : 1.65), score.melody, { type: score.wave, attack: .018, sustain: .35 });
      this._voice(frequency(note + 12), start + .012, eighth * 1.7, .016, { attack: .008, sustain: .16 });
    } else if (this.scene === 'lab' && beat % 2 === 1 && beat !== 7) {
      // The lab answers rests with a light arpeggio, giving it a busier character.
      this._voice(frequency(chord[(beat + bar) % 4] + 24), start, eighth * .9, .045, { type: 'triangle', attack: .01 });
    }
    if (beat % 2 === 0) this._voice(85, start, .15, score.pulse, { endFrequency: 48, attack: .008 });
    else if (this.scene === 'lab') this._voice(740, start, .06, .014, { attack: .004 });
  }

  _silence() {
    this._stopScheduler();
    clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
    if (!this.context) return;
    this._setMasterGain();
    this._releaseVoices();
    const context = this.context;
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = null;
      if (!this._shouldPlay() && context === this.context && context.state !== 'closed') Promise.resolve(context.suspend()).catch(() => {});
    }, 180);
  }

  _releaseVoices(musicOnly = false) {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const voice of this.voices) {
      if (musicOnly && !voice.music) continue;
      voice.envelope.gain.cancelScheduledValues(now);
      voice.envelope.gain.setValueAtTime(Math.max(.0001, voice.envelope.gain.value), now);
      voice.envelope.gain.exponentialRampToValueAtTime(.0001, now + .08);
      voice.oscillator.stop(now + .1);
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
      this.musicBus = this.context.createGain();
      this.musicBus.gain.value = .85;
      this.effectsBus = this.context.createGain();
      this.effectsBus.gain.value = .8;
      this.musicBus.connect(this.master);
      this.effectsBus.connect(this.master);
      this.persistentNodes = [this.master, this.musicBus, this.effectsBus];

      const buffer = this.context.createBuffer(1, this.context.sampleRate * 4, this.context.sampleRate);
      const samples = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < samples.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * .025) / 1.025;
        samples[i] = previous * 3;
      }
      const water = this.context.createBufferSource();
      water.buffer = buffer;
      water.loop = true;
      this.ambientFilter = this.context.createBiquadFilter();
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.Q.value = .4;
      this.waterGain = this.context.createGain();
      water.connect(this.ambientFilter).connect(this.waterGain).connect(this.master);
      water.start();
      this.persistentNodes.push(water, this.ambientFilter, this.waterGain);
      this._setAmbience();
      this.context.onstatechange = () => {
        if (this.context?.state === 'running' && this._shouldPlay()) this._startScheduler();
        else this._stopScheduler();
      };
      return true;
    } catch {
      this.dispose();
      return false;
    }
  }

  _voice(hz, start, duration, volume, options = {}) {
    // Every note is finite; disconnect its nodes after playback. Bound polyphony.
    if (!this.context || this.voices.size >= 96) return;
    const oscillator = this.context.createOscillator(), envelope = this.context.createGain();
    const music = options.music !== false, voice = { oscillator, envelope, music };
    this.voices.add(voice);
    oscillator.type = options.type || 'sine';
    oscillator.frequency.setValueAtTime(hz, start);
    if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
    const attack = Math.min(options.attack ?? .025, duration / 3);
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.linearRampToValueAtTime(volume, start + attack);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0001, volume * (options.sustain ?? .5)), start + Math.max(attack, duration * .45));
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(envelope).connect(music ? this.musicBus : this.effectsBus);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); this.voices.delete(voice); };
    oscillator.start(start);
    oscillator.stop(start + duration + .025);
  }

  dispose() {
    this.enabled = false;
    this._stopScheduler();
    clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
    for (const voice of this.voices) {
      voice.oscillator.onended = null;
      try { voice.oscillator.stop(); } catch { /* A note may have already ended. */ }
      voice.oscillator.disconnect();
      voice.envelope.disconnect();
    }
    this.voices.clear();
    for (const node of this.persistentNodes) node.disconnect();
    this.persistentNodes = [];
    if (this.context) {
      this.context.onstatechange = null;
      Promise.resolve(this.context.close()).catch(() => {});
    }
    this.context = null;
    this.master = this.musicBus = this.effectsBus = this.ambientFilter = this.waterGain = null;
  }
}
