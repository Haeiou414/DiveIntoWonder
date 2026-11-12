import test from 'node:test';
import assert from 'node:assert/strict';
import { ResearchShift, SHIFT_SECONDS } from '../research-shift.js';

function fixture(stock = { glassfish: 3, moonjelly: 2 }) {
  const game = { docked: true, sampleStock: { ...stock }, labState: null, resources: { credits: 0, research: 0 }, labProcessed: 0, labRuns: 0, labBestCombo: 0, save() {}, addXp() {}, unlockPaint(id) { this.paint = id; } };
  return { game, shift: new ResearchShift(game) };
}
function advance(shift, seconds) { for (let i = 0; i < Math.ceil(seconds / .1); i++) shift.update(.1); }
function prepareReport(shift, id = 'glassfish') {
  assert.equal(shift.admit(id), true);
  advance(shift, 2.2); assert.equal(shift.stabilize(), true);
  advance(shift, 3); assert.equal(shift.transfer('culture'), true);
  while (!shift.calibrationReady) shift.update(.05);
  assert.equal(shift.calibrate(), true);
  advance(shift, 6); assert.equal(shift.transfer('analyzer'), true);
  for (const symbol of shift.state.stations.report.code) assert.equal(shift.decode(symbol), true);
}

test('research shift requires port and real samples, including admission exactly once', () => {
  const { game, shift } = fixture();
  game.docked = false; assert.equal(shift.start(), false);
  game.docked = true; assert.equal(shift.start(), true);
  assert.equal(shift.admit('glassfish'), true);
  assert.equal(game.sampleStock.glassfish, 2);
  assert.equal(shift.admit('glassfish'), false);
  assert.equal(game.sampleStock.glassfish, 2);
  assert.equal(shift.transfer('culture'), false);
  assert.equal(shift.deliver(), false);
});

test('pausing freezes timers and prevents workstation actions until resumed', () => {
  const { shift } = fixture();
  shift.start(); shift.admit('glassfish'); advance(shift, 2);
  const snapshot = JSON.stringify(shift.state);
  shift.paused = true;
  advance(shift, 10);
  assert.equal(shift.stabilize(), false);
  assert.equal(shift.transfer('culture'), false);
  assert.equal(JSON.stringify(shift.state), snapshot);
  shift.paused = false;
  assert.equal(shift.stabilize(), true);
  advance(shift, 4);
  assert.equal(shift.transfer('culture'), true);
});

test('three manual stages yield science, improve combo, and cannot double-pay', () => {
  const { game, shift } = fixture(); shift.start();
  prepareReport(shift);
  assert.equal(shift.deliver(), true);
  assert.ok(game.resources.research > 8);
  assert.ok(game.resources.credits > 0);
  assert.equal(shift.state.combo, 1);
  assert.equal(game.labProcessed, 1);
  const paid = { ...game.resources };
  assert.equal(shift.deliver(), false); assert.deepEqual(game.resources, paid);
});

test('parallel pipeline allows another sample while analysis runs and blocks occupied station', () => {
  const { shift } = fixture(); shift.start(); shift.admit('glassfish'); advance(shift, 5.2);
  assert.equal(shift.transfer('culture'), true);
  assert.equal(shift.admit('moonjelly'), true); advance(shift, 6);
  assert.equal(shift.transfer('culture'), false);
  assert.equal(shift.transfer('analyzer'), false, 'uncalibrated analysis must require player action');
});

test('timer expiry and manual finish recover unfinished inventory exactly once', () => {
  const { game, shift } = fixture({ glassfish: 1 }); shift.start(); shift.admit('glassfish');
  advance(shift, SHIFT_SECONDS + 1);
  assert.equal(shift.state.status, 'complete'); assert.equal(game.sampleStock.glassfish, 1);
  assert.equal(shift.finish(), false); assert.equal(game.sampleStock.glassfish, 1); assert.equal(game.labRuns, 1);
});

test('saved in-flight work resumes without consuming or duplicating a specimen', () => {
  const { game, shift } = fixture({ glassfish: 1 }); shift.start(); shift.admit('glassfish'); advance(shift, 2);
  const snapshot = JSON.parse(JSON.stringify({ sampleStock: game.sampleStock, labState: game.labState }));
  const second = fixture({}); Object.assign(second.game, snapshot); const reopened = new ResearchShift(second.game);
  assert.equal(reopened.active, true); assert.equal(reopened.availableSamples, 0);
  assert.equal(reopened.state.stations.culture.speciesId, 'glassfish');
  reopened.finish(); assert.equal(second.game.sampleStock.glassfish, 1);
});

test('wrong report sequence interrupts combo but never destroys the sample', () => {
  const { shift } = fixture(); shift.start(); prepareReport(shift);
  shift.state.stations.report.step = 0; shift.state.combo = 3;
  const wrong = (shift.state.stations.report.code[0] + 1) % 3;
  assert.equal(shift.decode(wrong), false); assert.equal(shift.state.combo, 0);
  for (const symbol of shift.state.stations.report.code) shift.decode(symbol);
  assert.equal(shift.deliver(), true);
});

test('ten successful lab deliveries unlock the cosmetic without repeated rewards', () => {
  const { game, shift } = fixture({ glassfish: 1 }); game.labProcessed = 9; shift.start(); prepareReport(shift);
  shift.deliver(); assert.equal(game.paint, 'aurora'); assert.equal(game.labProcessed, 10);
  const elapsed = shift.state.elapsed; shift.update(1); assert.equal(shift.state.elapsed, elapsed);
});
