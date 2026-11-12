import test from 'node:test';
import assert from 'node:assert/strict';
import { Soundscape } from '../audio.js';

// A deterministic audio clock checks score scheduling and resource lifetime.
// It does not claim to replace listening to the actual Web Audio output.
function harness(t) {
  const original = Object.fromEntries(['AudioContext', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'].map(key => [key, globalThis[key]]));
  const intervals = new Map(), timeouts = new Map();
  let id = 0, wallTime = 0;
  class Param {
    constructor(value = 0) { this.value = value; this.events = []; }
    event(kind, value, time) { this.value = value; this.events.push({ kind, value, time }); }
    setValueAtTime(value, time) { this.event('value', value, time); }
    setTargetAtTime(value, time) { this.event('target', value, time); }
    linearRampToValueAtTime(value, time) { this.event('linear', value, time); }
    exponentialRampToValueAtTime(value, time) { assert.ok(value > 0); this.event('exponential', value, time); }
    cancelScheduledValues(time) { this.events = this.events.filter(event => event.time < time); }
  }
  class Node {
    constructor() { this.connections = []; this.disconnected = false; }
    connect(node) { this.connections.push(node); return node; }
    disconnect() { this.disconnected = true; this.connections = []; }
  }
  class Oscillator extends Node {
    constructor() { super(); this.frequency = new Param(); this.ended = false; }
    start(time) { this.startTime = time; }
    stop(time = 0) { this.stopTime = time; }
  }
  class Context {
    constructor() { Context.instances.push(this); this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 2000; this.destination = new Node(); this.oscillators = []; this.nodes = []; }
    createGain() { const node = new Node(); node.gain = new Param(1); this.nodes.push(node); return node; }
    createBiquadFilter() { const node = new Node(); node.frequency = new Param(); node.Q = new Param(); this.nodes.push(node); return node; }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { const node = new Node(); node.start = () => {}; this.nodes.push(node); return node; }
    createOscillator() { const node = new Oscillator(); this.oscillators.push(node); this.nodes.push(node); return node; }
    resume() { this.state = 'running'; this.onstatechange?.(); return Promise.resolve(); }
    suspend() { this.state = 'suspended'; this.onstatechange?.(); return Promise.resolve(); }
    close() { this.state = 'closed'; this.onstatechange?.(); return Promise.resolve(); }
    advance(seconds) {
      if (this.state !== 'running') return;
      this.currentTime += seconds;
      for (const oscillator of this.oscillators) {
        if (!oscillator.ended && oscillator.stopTime <= this.currentTime) { oscillator.ended = true; oscillator.onended?.(); }
      }
    }
  }
  Context.instances = [];
  globalThis.AudioContext = Context;
  globalThis.setInterval = callback => { intervals.set(++id, callback); return id; };
  globalThis.clearInterval = timer => intervals.delete(timer);
  globalThis.setTimeout = (callback, delay) => { timeouts.set(++id, { callback, due: wallTime + delay }); return id; };
  globalThis.clearTimeout = timer => timeouts.delete(timer);
  const sound = new Soundscape();
  t.after(() => { sound.dispose(); for (const [key, value] of Object.entries(original)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
  return {
    sound, intervals, timeouts, Context,
    advance(seconds) {
      const steps = Math.ceil(seconds / .05);
      for (let i = 0; i < steps; i++) {
        wallTime += seconds / steps * 1000;
        sound.context?.advance(seconds / steps);
        for (const callback of [...intervals.values()]) callback();
        for (const [timer, item] of [...timeouts]) if (item.due <= wallTime) { timeouts.delete(timer); item.callback(); }
      }
    },
  };
}

test('scene, depth, volume and resume never create audio before opt-in', t => {
  const h = harness(t), sound = h.sound;
  sound.setScene('lab');
  sound.setDepth(6200);
  sound.setVolume(.4);
  sound.setPaused(true);
  sound.setPaused(false);
  sound.resume();
  sound.play('discovery');
  assert.equal(sound.enabled, false);
  assert.equal(sound.context, null);
  assert.equal(h.Context.instances.length, 0);
  assert.equal(h.intervals.size, 0);
  assert.equal(h.timeouts.size, 0);
});

test('enabling schedules melody, harmony and bass, with one scheduling clock', t => {
  const h = harness(t), sound = h.sound;
  assert.equal(sound.toggle(), true);
  assert.equal(sound.sceneName, '日光漂流');
  assert.equal(sound.context.state, 'running');
  assert.ok(sound.master.gain.value > .5);
  assert.equal(h.intervals.size, 1);
  const music = [...sound.voices].filter(voice => voice.music);
  assert.ok(music.length >= 8);
  assert.ok(music.some(voice => voice.oscillator.stopTime - voice.oscillator.startTime > 3));
  const pitches = music.map(voice => voice.oscillator.frequency.events[0].value);
  assert.ok(pitches.some(hz => hz < 100), 'bass is present');
  assert.ok(pitches.some(hz => hz > 500), 'melody is present');
  assert.ok(new Set(pitches).size >= 5, 'music contains a chord, not a single drone');
  for (let i = 0; i < 10; i++) sound.resume();
  assert.equal(h.intervals.size, 1);
  sound.play('capture');
  assert.equal([...sound.voices].filter(voice => !voice.music).length, 2);
});

test('depth and scene change the score without creating more contexts or timers', t => {
  const h = harness(t), sound = h.sound;
  sound.toggle();
  sound.setDepth(400);
  assert.equal(sound.sceneName, '暮色回声');
  sound.setDepth(4000);
  assert.equal(sound.sceneName, '星渊摇篮曲');
  sound.setScene('lab');
  assert.equal(sound.sceneName, '好奇心实验室');
  assert.equal(sound.waterGain.gain.value, 0);
  sound.setDepth(50);
  assert.equal(sound.sceneName, '好奇心实验室');
  sound.setScene('port');
  assert.equal(sound.sceneName, '归航的灯');
  sound.setScene('dive');
  assert.equal(sound.sceneName, '日光漂流');
  sound.setScene('invalid');
  assert.equal(sound.scene, 'dive');
  assert.equal(h.Context.instances.length, 1);
  assert.equal(h.intervals.size, 1);
});

test('muting and hidden-page pause stop scheduling, release notes and suspend the context', t => {
  const h = harness(t), sound = h.sound;
  sound.toggle();
  sound.setPaused(true);
  assert.equal(sound.enabled, true);
  assert.equal(h.intervals.size, 0);
  const noteCount = sound.context.oscillators.length;
  sound.play('level');
  assert.equal(sound.context.oscillators.length, noteCount);
  h.advance(.25);
  assert.equal(sound.context.state, 'suspended');
  assert.equal(sound.voices.size, 0);
  assert.equal(h.timeouts.size, 0);
  sound.setPaused(false);
  assert.equal(h.intervals.size, 1);
  assert.equal(sound.context.state, 'running');
  assert.equal(sound.toggle(), false);
  assert.equal(h.intervals.size, 0);
  h.advance(.25);
  assert.equal(sound.context.state, 'suspended');
  assert.equal(sound.voices.size, 0);
  assert.equal(h.timeouts.size, 0);
});

test('zero volume pauses audio work and volume changes stay within the supported range', t => {
  const h = harness(t), sound = h.sound;
  sound.toggle();
  assert.equal(sound.setVolume(5), 1);
  assert.equal(sound.setVolume(-1), 0);
  assert.equal(h.intervals.size, 0);
  h.advance(.25);
  assert.equal(sound.context.state, 'suspended');
  assert.equal(sound.setVolume(.35), .35);
  assert.equal(h.intervals.size, 1);
  assert.equal(sound.setVolume(NaN), .35);
  assert.equal(sound.master.gain.value, .35 * .9);
});

test('two minutes of music keep bounded voices and dispose disconnects every owned node', t => {
  const h = harness(t), sound = h.sound;
  sound.setScene('lab');
  sound.toggle();
  let maximumVoices = 0;
  for (let i = 0; i < 240; i++) {
    h.advance(.5);
    maximumVoices = Math.max(maximumVoices, sound.voices.size);
  }
  const context = sound.context;
  assert.ok(context.oscillators.length > 300);
  assert.ok(maximumVoices < 40, 'completed notes are retired');
  for (const oscillator of context.oscillators) {
    assert.ok(Number.isFinite(oscillator.stopTime));
    assert.ok(oscillator.stopTime > oscillator.startTime);
    if (oscillator.ended) assert.equal(oscillator.disconnected, true);
  }
  sound.dispose();
  assert.equal(context.state, 'closed');
  assert.equal(sound.context, null);
  assert.equal(sound.voices.size, 0);
  assert.equal(h.intervals.size, 0);
  assert.equal(h.timeouts.size, 0);
  assert.ok(context.nodes.every(node => node.disconnected));
});

test('a delayed scheduling callback does not play an accumulated backlog', t => {
  const h = harness(t), sound = h.sound;
  sound.toggle();
  sound.context.advance(120);
  const before = sound.context.oscillators.length;
  for (const callback of h.intervals.values()) callback();
  assert.ok(sound.context.oscillators.length - before <= 8);
  assert.ok(sound.nextStepTime > sound.context.currentTime);
});
