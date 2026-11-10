import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine.js';
import { GENES, SPECIES, UPGRADES, VEHICLES, ZONES } from '../data.js';
import { Soundscape } from '../audio.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

function fresh() {
  return new Game({ storage: memoryStorage(), load: false });
}

function putSampleWithinReach(game, speciesId = 'glassfish') {
  game.entities = [{
    id: 'test-sample', type: 'creature', speciesId, alive: true,
    x: game.player.x + 20, y: game.player.y,
    originX: game.player.x + 20, originY: game.player.y, phase: 0,
  }];
  game.captureCooldown = 0;
  return game.entities[0];
}

test('capturing awards discoveries immediately but settles sample resources only on return', () => {
  const game = fresh();
  const species = game.getSpecies('glassfish');
  const initialCredits = game.resources.credits;
  const initialResearch = game.resources.research;
  const initialBattery = game.battery;
  const entity = putSampleWithinReach(game);

  assert.equal(game.capture(), true);
  assert.equal(entity.alive, false);
  assert.equal(game.battery, initialBattery - 2);
  assert.equal(game.totalCaptures, 1);
  assert.deepEqual(game.discoveries, ['glassfish']);
  assert.equal(game.cargoWeight, species.weight);
  assert.equal(game.resources.credits, initialCredits);
  assert.equal(game.resources.research, initialResearch);

  assert.equal(game.returnToBase(), true);
  assert.equal(game.resources.credits, initialCredits + species.value);
  assert.equal(game.resources.research, initialResearch + species.research);
  assert.equal(game.cargoWeight, 0);
  assert.equal(game.battery, game.stats.battery);
  assert.equal(game.hull, 100);
  assert.equal(game.lastExpedition.captures, 1);

  const settled = { ...game.resources };
  assert.equal(game.returnToBase(), false);
  assert.deepEqual(game.resources, settled);
  assert.equal(game.launch(), true);
  assert.equal(game.expedition.captures, 0);
  assert.equal(game.expedition.credits, 0);
});

test('full cargo and insufficient battery leave nearby creatures and resources intact', () => {
  const game = fresh();
  const entity = putSampleWithinReach(game);
  game.cargo = [{ weight: game.stats.cargo, count: 1 }];
  const initialBattery = game.battery;
  assert.equal(game.capture(), false);
  assert.equal(entity.alive, true);
  assert.equal(game.battery, initialBattery);
  game.cargo = [];
  game.battery = 1;
  assert.equal(game.capture(), false);
  assert.equal(entity.alive, true);
  assert.equal(game.totalCaptures, 0);
});

test('reloading an active expedition safely settles it exactly once', () => {
  const storage = memoryStorage();
  const game = new Game({ storage, load: false });
  putSampleWithinReach(game);
  game.capture();
  const before = { ...game.resources };
  const earnings = { ...game.expedition };

  const resumed = new Game({ storage });
  assert.equal(resumed.docked, true);
  assert.equal(resumed.totalDives, 1);
  assert.equal(resumed.cargoWeight, 0);
  assert.equal(resumed.lastExpedition.resumed, true);
  assert.deepEqual(resumed.discoveries, ['glassfish']);
  for (const key of ['credits', 'research', 'alloy']) {
    assert.equal(resumed.resources[key], before[key] + earnings[key]);
  }

  const reopened = new Game({ storage });
  assert.deepEqual(reopened.resources, resumed.resources);
  assert.equal(reopened.totalDives, resumed.totalDives);
  assert.equal(reopened.lastExpedition.captures, 1);
});

test('broken or unavailable storage does not prevent gameplay', () => {
  const brokenJSON = { getItem: () => '{broken', setItem() {}, removeItem() {} };
  const game = new Game({ storage: brokenJSON });
  assert.equal(game.vehicle, 'moth');
  assert.equal(game.level, 1);
  assert.ok(game.entities.length > 0);

  const blocked = new Game({ storage: {
    getItem() { throw new Error('storage blocked'); },
    setItem() { throw new Error('storage blocked'); },
    removeItem() { throw new Error('storage blocked'); },
  } });
  let warnings = 0;
  blocked.subscribe(event => { if (event.type === 'warning') warnings++; });
  assert.equal(blocked.save(), false);
  assert.equal(blocked.save(), false);
  assert.equal(warnings, 1);
  putSampleWithinReach(blocked);
  assert.equal(blocked.capture(), true);
  assert.equal(blocked.returnToBase(), true);
});

test('upgrades require the port, honor their level cap, and apply across the fleet', () => {
  const game = fresh();
  game.resources = { credits: 100000, research: 100000, alloy: 100000 };
  assert.equal(game.upgrade('hull'), false);
  assert.equal(game.craftVehicle('ray'), false);
  game.returnToBase();

  const upgrade = UPGRADES.find(item => item.id === 'hull');
  for (let i = 0; i < upgrade.maxLevel; i++) assert.equal(game.upgrade('hull'), true);
  assert.equal(game.stats.maxDepth, VEHICLES.moth.maxDepth + 900 * upgrade.maxLevel);
  const resourcesAtCap = { ...game.resources };
  assert.equal(game.upgrade('hull'), false);
  assert.deepEqual(game.resources, resourcesAtCap);
  assert.equal(game.craftVehicle('ray'), true);
  assert.equal(game.stats.maxDepth, VEHICLES.ray.maxDepth + 900 * upgrade.maxLevel);
  assert.equal(game.selectVehicle('moth'), true);
  assert.deepEqual(new Set(game.ownedVehicles), new Set(['moth', 'ray']));
  assert.equal(game.craftVehicle('whale'), true);
  assert.ok(game.stats.maxDepth >= ZONES.at(-1).max);
});

test('gene research requires its specimen and points, and cannot charge twice', () => {
  const game = fresh();
  const gene = GENES.find(item => item.id === 'lumen');
  const initialVision = game.stats.vision;
  game.resources.research = gene.cost;
  assert.equal(game.research(gene.id), false);
  game.discoveries.push(gene.speciesId);
  game.resources.research = gene.cost - 1;
  assert.equal(game.research(gene.id), false);
  game.resources.research = gene.cost;
  assert.equal(game.research(gene.id), true);
  assert.equal(game.resources.research, 0);
  assert.equal(game.stats.vision, initialVision * 1.3);
  assert.equal(game.research(gene.id), false);
  assert.deepEqual(game.researched, ['lumen']);
});

test('carrier deployment shares pressure protection and cargo, and requires proximity to dock', () => {
  const game = fresh();
  game.resources = { credits: 10000, research: 1000, alloy: 1000 };
  game.returnToBase();
  assert.equal(game.craftVehicle('whale'), true);
  game.launch();
  game.player.y = 4000;
  const carrierBattery = game.battery;
  const capacity = game.stats.cargo;
  const maxDepth = game.stats.maxDepth;
  assert.equal(game.deploySub(), true);
  assert.equal(game.vehicle, 'moth');
  assert.equal(game.deployed, true);
  assert.equal(game.stats.cargo, capacity);
  assert.equal(game.stats.maxDepth, maxDepth);

  game.player.y += 500;
  assert.equal(game.deploySub(), false);
  assert.equal(game.deployed, true);
  game.player.y = game.carrier.y;
  assert.equal(game.deploySub(), true);
  assert.equal(game.vehicle, 'whale');
  assert.equal(game.deployed, false);
  assert.equal(game.battery, carrierBattery - 18);
});

test('mission and collection claims advance their thresholds without repeat payouts', () => {
  const game = fresh();
  assert.equal(game.claimMission('capture'), false);
  game.totalCaptures = 3;
  const researchBefore = game.resources.research;
  assert.equal(game.claimMission('capture'), true);
  assert.equal(game.resources.research, researchBefore + 20);
  assert.equal(game.missionTiers.capture, 1);
  const paid = { ...game.resources };
  assert.equal(game.claimMission('capture'), false);
  assert.deepEqual(game.resources, paid);

  game.discoveries = SPECIES.slice(0, 3).map(species => species.id);
  assert.equal(game.claimCollection(), true);
  assert.equal(game.collectionTier, 1);
  const collectionPaid = { ...game.resources };
  assert.equal(game.collectionReward.target, 6);
  assert.equal(game.claimCollection(), false);
  assert.deepEqual(game.resources, collectionPaid);
});

test('movement normalizes diagonals, boosting costs more, and pause freezes actions', () => {
  const straight = fresh();
  const diagonal = fresh();
  const boost = fresh();
  const origin = { ...straight.player };
  straight.update(0.1, { x: 1 });
  diagonal.update(0.1, { x: 1, y: 1 });
  boost.update(0.1, { x: 1, boost: true });
  const distance = game => Math.hypot(game.player.x - origin.x, game.player.y - origin.y);
  assert.ok(Math.abs(distance(straight) - distance(diagonal)) < 1e-8);
  assert.ok(distance(boost) > distance(straight));
  assert.ok(boost.battery < straight.battery);

  const game = fresh();
  putSampleWithinReach(game);
  game.togglePause();
  const playerBefore = { ...game.player };
  const batteryBefore = game.battery;
  game.update(0.1, { y: 1, boost: true });
  assert.deepEqual(game.player, playerBefore);
  assert.equal(game.battery, batteryBefore);
  assert.equal(game.capture(), false);
  assert.equal(game.scan(), false);
});

test('pressure damages the hull and exhausted power rescues all collected samples', () => {
  const game = fresh();
  game.player.y = game.stats.maxDepth + 700;
  game.update(0.1);
  assert.ok(game.hull < 100);
  game.player.y = 100;
  putSampleWithinReach(game);
  game.capture();
  const credits = game.resources.credits + game.expedition.credits;
  game.battery = 0;
  game.update(0.1);
  assert.equal(game.docked, true);
  assert.equal(game.lastExpedition.emergency, true);
  assert.equal(game.lastExpedition.captures, 1);
  assert.equal(game.resources.credits, credits);
  assert.equal(game.battery, game.stats.battery);
});

test('every collectible species has reachable world spawns', () => {
  const game = fresh();
  const spawned = new Set(game.entities.filter(entity => entity.type === 'creature').map(entity => entity.speciesId));
  assert.deepEqual(spawned, new Set(SPECIES.map(species => species.id)));
  for (const entity of game.entities) {
    assert.ok(entity.x >= 85 && entity.x <= 915);
    assert.ok(entity.y > 0 && entity.y < 11000);
  }
});

test('audio starts muted and safely tolerates platforms without Web Audio', () => {
  const sound = new Soundscape();
  assert.equal(sound.enabled, false);
  assert.equal(sound.context, null);
  assert.doesNotThrow(() => sound.play('capture'));
  assert.doesNotThrow(() => sound.resume());
  sound.setDepth(4500);
  assert.equal(sound.depth, 4500);
  assert.equal(sound.context, null);
  if (!globalThis.AudioContext && !globalThis.webkitAudioContext) {
    assert.equal(sound.toggle(), false);
    assert.equal(sound.enabled, false);
  }
});
