import test from 'node:test';
import assert from 'node:assert/strict';
import { ResearchChamber, makeBoard, rotateMask, TERMINALS, CORE_CELL, DIRECTIONS, MUTATIONS, MODULE_THRESHOLDS } from '../research-shift.js';
import { SPECIES } from '../data.js';

function fixture(stock = { glassfish: 3, moonjelly: 2 }, fidelity = {}) {
  const game = {
    docked: true, sampleStock: { ...stock }, sampleFidelity: { ...fidelity }, labState: null,
    resources: { credits: 0, research: 0 }, labProcessed: 0, labRuns: 0, bioModules: {}, equippedBioModule: null,
    save() {}, addXp() {}, unlockPaint(id) { this.paint = id; },
    unlockBioModule(id, level) { this.bioModules[id] = Math.max(this.bioModules[id] || 0, level); },
  };
  return { game, chamber: new ResearchChamber(game) };
}

function solve(chamber) {
  const speciesIndex = SPECIES.findIndex(species => species.id === chamber.state.specimens[0].speciesId);
  const seed = speciesIndex + chamber.state.sequence;
  const terminals = new Set(TERMINALS.map(terminal => terminal.cell));
  for (let cell = 0; cell < 25; cell++) {
    if (cell === CORE_CELL || terminals.has(cell)) continue;
    const turns = (seed * 7 + cell * 3 + Math.floor(cell / 5)) % 4;
    if (turns) chamber.rotate(cell, -turns);
  }
}

function completePulses(chamber) {
  solve(chamber);
  for (let pulse = 0; pulse < 3; pulse++) {
    assert.equal(chamber.releasePulse(), true);
    if (pulse < 2) assert.equal(chamber.chooseMutation(chamber.state.offered[0]), true);
  }
}

// Find valid rotations for one focused route, closing unused branches at the core.
// This exercises the player's strongest ordinary strategy rather than a random board.
function focus(chamber, moduleId) {
  const paths = {
    lumen: [12, 7, 6, 1, 0], flow: [12, 7, 8, 3, 4], shell: [12, 17, 16, 21, 20],
    echo: [12, 13, 14], repair: [12, 17, 18, 23, 24],
  };
  const path = paths[moduleId], onPath = new Set(path), terminals = new Set(TERMINALS.map(terminal => terminal.cell));
  const direction = (from, to) => to === from - 5 ? 1 : to === from + 1 ? 2 : to === from + 5 ? 4 : 8;
  const orient = (cell, predicate) => {
    const turns = [0, 1, 2, 3].find(turn => predicate(rotateMask(chamber.state.board[cell], turn)));
    assert.notEqual(turns, undefined, `Cannot orient cell ${cell} towards ${moduleId}`);
    if (turns) assert.equal(chamber.rotate(cell, turns), true);
  };
  path.forEach((cell, index) => {
    if (cell === CORE_CELL || terminals.has(cell)) return;
    const required = direction(cell, path[index - 1]) | direction(cell, path[index + 1]);
    orient(cell, mask => (mask & required) === required);
  });
  for (let cell = 0; cell < 25; cell++) {
    if (onPath.has(cell) || terminals.has(cell)) continue;
    let forbidden = 0;
    for (const dir of DIRECTIONS) {
      const x = cell % 5 + dir.x, y = Math.floor(cell / 5) + dir.y, neighbor = y * 5 + x;
      if (x < 0 || x >= 5 || y < 0 || y >= 5 || terminals.has(neighbor)) continue;
      if (onPath.has(neighbor) && (chamber.state.board[neighbor] & dir.opposite)) forbidden |= dir.bit;
    }
    orient(cell, mask => (mask & forbidden) === 0);
  }
  assert.deepEqual(Object.keys(chamber.simulate().targets), [moduleId]);
}

test('all species generate solvable circuits, rotation is reversible, and previews spend nothing', () => {
  for (const species of SPECIES) {
    const { game, chamber } = fixture({ [species.id]: 1 });
    assert.equal(chamber.start(species.id), true);
    solve(chamber);
    const before = JSON.stringify({ state: chamber.state, stock: game.sampleStock, resources: game.resources });
    const result = chamber.simulate();
    assert.equal(Object.keys(result.targets).length, 5, species.id);
    assert.ok(result.total > 0 && Number.isFinite(result.total));
    assert.equal(JSON.stringify({ state: chamber.state, stock: game.sampleStock, resources: game.resources }), before);
  }
  assert.equal(rotateMask(3, 4), 3);
  assert.equal(rotateMask(rotateMask(3, 1), -1), 3);
});

test('real samples are reserved once, full-fidelity donors increase energy and return on cancellation', () => {
  const { game, chamber } = fixture({ glassfish: 1, moonjelly: 1 }, { glassfish: 1 });
  assert.equal(chamber.start('glassfish'), true);
  assert.equal(chamber.energy, 21);
  assert.equal(game.sampleStock.glassfish, 0);
  assert.equal(game.sampleFidelity.glassfish, 0);
  assert.equal(chamber.start('moonjelly'), false);
  assert.equal(chamber.addDonor('moonjelly'), true);
  assert.ok(chamber.energy > 21);
  assert.equal(chamber.addDonor('glassfish'), false);
  assert.equal(chamber.cancel(), true);
  assert.deepEqual(game.sampleStock, { glassfish: 1, moonjelly: 1 });
  assert.equal(game.sampleFidelity.glassfish, 1);
  assert.equal(chamber.cancel(), false);
});

test('pulse stages require meaningful connections and an offered mutation before continuation', () => {
  const { chamber } = fixture();
  chamber.start('glassfish');
  chamber.state.board[7] = 10;
  chamber.state.board[11] = 5;
  chamber.state.board[13] = 5;
  chamber.state.board[17] = 10;
  assert.equal(chamber.releasePulse(), false);
  assert.equal(chamber.state.pulse, 0);
  chamber.state.board = makeBoard(1);
  solve(chamber);
  assert.equal(chamber.releasePulse(), true);
  assert.equal(chamber.state.status, 'mutation');
  assert.equal(chamber.releasePulse(), false);
  assert.equal(chamber.rotate(1), false);
  assert.equal(chamber.chooseMutation('unknown'), false);
  assert.equal(chamber.chooseMutation(chamber.state.offered[0]), true);
  assert.equal(chamber.state.status, 'building');
  assert.equal(chamber.addDonor('moonjelly'), false);
});

test('complete samples expose four mutation choices and mutations change actual propagation', () => {
  const normal = fixture({ glassfish: 1 });
  normal.chamber.start('glassfish'); solve(normal.chamber); normal.chamber.releasePulse();
  assert.equal(normal.chamber.state.offered.length, 3);
  const { chamber } = fixture({ glassfish: 1 }, { glassfish: 1 });
  chamber.start('glassfish'); solve(chamber);
  const original = chamber.simulate();
  chamber.releasePulse();
  assert.equal(chamber.state.offered.length, 4);
  chamber.state.offered = ['insulate'];
  chamber.chooseMutation('insulate');
  assert.ok(chamber.simulate().total > original.total);
  assert.equal(chamber.releasePulse(), true);
  assert.equal(chamber.state.offered.length, 4);
  assert.equal(new Set(chamber.state.offered).size, 4);
  assert.ok(!chamber.state.offered.includes('insulate'));
  chamber.state.offered.push('insulate');
  const before = JSON.stringify(chamber.state);
  assert.equal(chamber.chooseMutation('insulate'), false);
  assert.equal(JSON.stringify(chamber.state), before);
});

test('module tiers preserve quick tier II while tier III requires 90 charge', () => {
  const { chamber } = fixture();
  assert.deepEqual(MODULE_THRESHOLDS, [0, 13, 90]);
  for (const [charge, level] of [[0, 0], [.1, 1], [12.9, 1], [13, 2], [89.9, 2], [90, 3]]) {
    chamber.state.charges.echo = charge;
    assert.equal(chamber.moduleLevel('echo'), level);
  }
});

test('one ordinary sample reaches tier II but cannot cap out through any offered mutation pair', () => {
  let completed = 0;
  for (const species of SPECIES) {
    // Focusing an affinity organ gives this sample its largest terminal bonus.
    const moduleId = species.traits[0];
    for (let sequence = 1; sequence <= MUTATIONS.length; sequence++) {
      for (const first of MUTATIONS) for (const second of MUTATIONS) {
        if (first.id === second.id) continue;
        const { chamber } = fixture({ [species.id]: 1 });
        chamber.state.sequence = sequence - 1;
        chamber.start(species.id);
        focus(chamber, moduleId);
        chamber.releasePulse();
        if (!chamber.chooseMutation(first.id)) continue;
        chamber.releasePulse();
        if (!chamber.chooseMutation(second.id)) continue;
        assert.equal(chamber.releasePulse(), true);
        assert.equal(chamber.moduleLevel(moduleId), 2, `${species.id}: ${first.id} / ${second.id}`);
        assert.ok(chamber.state.charges[moduleId] < MODULE_THRESHOLDS[2]);
        assert.equal(chamber.harvest(moduleId), true);
        completed++;
      }
    }
  }
  assert.equal(completed, SPECIES.length * MUTATIONS.length * 9);
});

test('a full-fidelity sample can reach tier III with focused energy and two distinct mutations', () => {
  for (const { module } of TERMINALS) {
    const { game, chamber } = fixture({ glassfish: 1 }, { glassfish: 1 });
    chamber.start('glassfish');
    focus(chamber, module);
    assert.equal(chamber.releasePulse(), true);
    assert.equal(chamber.chooseMutation('amplify'), true);
    assert.equal(chamber.releasePulse(), true);
    assert.equal(chamber.state.offered.length, 4);
    assert.ok(!chamber.state.offered.includes('amplify'));
    assert.equal(chamber.chooseMutation('memory'), true);
    assert.equal(chamber.releasePulse(), true);
    assert.equal(chamber.moduleLevel(module), 3);
    assert.equal(chamber.harvest(module), true);
    assert.equal(game.bioModules[module], 3);
  }
});

test('diverse ordinary donors can reach all five tier III modules through focused circuits', () => {
  for (const { module } of TERMINALS) {
    const { game, chamber } = fixture({ glassfish: 1, moonjelly: 1, yeti_crab: 1 });
    chamber.start('glassfish');
    chamber.addDonor('moonjelly');
    chamber.addDonor('yeti_crab');
    assert.equal(chamber.fidelityCount, 0);
    assert.equal(chamber.diversity, 3);
    focus(chamber, module);
    assert.equal(chamber.releasePulse(), true); assert.equal(chamber.chooseMutation('branch'), true);
    assert.equal(chamber.releasePulse(), true); assert.equal(chamber.chooseMutation('memory'), true);
    assert.equal(chamber.releasePulse(), true);
    assert.equal(chamber.moduleLevel(module), 3);
    assert.equal(chamber.harvest(module), true);
    assert.equal(game.bioModules[module], 3);
  }
});

test('restoring an experiment deduplicates mutations and retains four unchosen fidelity options', () => {
  const { game, chamber } = fixture({ glassfish: 1 }, { glassfish: 1 });
  chamber.start('glassfish'); focus(chamber, 'echo');
  chamber.releasePulse(); chamber.chooseMutation('amplify'); chamber.releasePulse();
  chamber.state.mutations.push('amplify');
  chamber.state.offered.push('amplify', 'unknown');
  const restored = new ResearchChamber(game);
  assert.deepEqual(restored.state.mutations, ['amplify']);
  assert.equal(restored.energy, 27);
  assert.equal(restored.state.offered.length, 4);
  assert.equal(new Set(restored.state.offered).size, 4);
  assert.ok(restored.state.offered.every(id => id !== 'amplify' && MUTATIONS.some(mutation => mutation.id === id)));
});

test('three pulses unlock a usable module and settle exactly once', () => {
  const { game, chamber } = fixture({ glassfish: 1 });
  chamber.start('glassfish'); completePulses(chamber);
  assert.equal(chamber.releasePulse(), false);
  assert.equal(chamber.harvest('unknown'), false);
  assert.equal(chamber.harvest('echo'), true);
  assert.ok(game.bioModules.echo >= 1);
  assert.ok(game.resources.research > 8 && game.resources.credits > 0);
  assert.equal(game.labProcessed, 1);
  const snapshot = JSON.stringify(game);
  assert.equal(chamber.harvest('echo'), false);
  assert.equal(chamber.cancel(), false);
  assert.equal(JSON.stringify(game), snapshot);
});

test('saved evolving circuits and fidelity resume without refunding or consuming another sample', () => {
  const first = fixture({ glassfish: 1 }, { glassfish: 1 });
  first.chamber.start('glassfish'); solve(first.chamber); first.chamber.releasePulse();
  const snapshot = JSON.parse(JSON.stringify(first.game));
  const next = fixture({});
  Object.assign(next.game, snapshot);
  const restored = new ResearchChamber(next.game);
  assert.equal(restored.state.status, 'mutation');
  assert.equal(restored.fidelityCount, 1);
  assert.equal(next.game.sampleStock.glassfish, 0);
  restored.cancel();
  assert.equal(next.game.sampleStock.glassfish, 1);
  assert.equal(next.game.sampleFidelity.glassfish, 1);
});

test('v1.1 workstation migration refunds every in-flight specimen once', () => {
  const { game } = fixture({ glassfish: 0 });
  game.labState = { version: 1, status: 'running', stations: {
    culture: { speciesId: 'glassfish' }, analyzer: { speciesId: 'moonjelly' }, report: null,
  } };
  const chamber = new ResearchChamber(game);
  assert.equal(game.sampleStock.glassfish, 1);
  assert.equal(game.sampleStock.moonjelly, 1);
  assert.equal(chamber.state.status, 'idle');
  chamber.ensureState();
  assert.equal(game.sampleStock.glassfish, 1);
  assert.equal(game.sampleStock.moonjelly, 1);
});

test('closed port and paused view block edits without a real-time penalty', () => {
  const { game, chamber } = fixture();
  game.docked = false;
  assert.equal(chamber.start('glassfish'), false);
  game.docked = true; chamber.start('glassfish');
  chamber.paused = true;
  const state = JSON.stringify(chamber.state);
  assert.equal(chamber.rotate(1), false);
  assert.equal(chamber.releasePulse(), false);
  assert.equal(JSON.stringify(chamber.state), state);
  chamber.paused = false;
  assert.equal(chamber.rotate(1), true);
  assert.equal(chamber.undo(), true);
});

test('ten evolved specimens retain the cosmetic milestone', () => {
  const { game, chamber } = fixture({ glassfish: 1 });
  game.labProcessed = 9;
  chamber.start('glassfish'); completePulses(chamber); chamber.harvest('echo');
  assert.equal(game.paint, 'aurora');
});
