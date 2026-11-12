import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine.js';
import { GENES, SPECIES, UPGRADES, VEHICLES, ZONES } from '../data.js';
import { Soundscape } from '../audio.js';
import { CAVES, isWater } from '../world.js';
import { BIO_MODULES } from '../bio-modules.js';

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
  assert.equal(game.resources.research, initialResearch + Math.floor(species.research * 0.2));
  assert.equal(game.sampleStock.glassfish, 1);
  assert.equal(game.cargoWeight, 0);
  assert.equal(game.battery, game.stats.battery);
  assert.equal(game.hull, 100);
  assert.equal(game.lastExpedition.captures, 1);

  const settled = { ...game.resources };
  assert.equal(game.returnToBase(), false);
  assert.deepEqual(game.resources, settled);
  assert.equal(game.sampleStock.glassfish, 1);
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
  assert.equal(resumed.sampleStock.glassfish, 1);
  for (const key of ['credits', 'research', 'alloy']) {
    assert.equal(resumed.resources[key], before[key] + earnings[key]);
  }

  const reopened = new Game({ storage });
  assert.deepEqual(reopened.resources, resumed.resources);
  assert.equal(reopened.totalDives, resumed.totalDives);
  assert.equal(reopened.lastExpedition.captures, 1);
  assert.deepEqual(reopened.sampleStock, resumed.sampleStock);
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

test('carrier deployment transfers finite energy, uses separate cargo, and only protects within tether range', () => {
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
  assert.ok(game.stats.cargo < capacity);
  assert.deepEqual(game.carrier.cargo, []);
  assert.equal(game.stats.maxDepth, maxDepth);
  assert.equal(game.battery + game.carrier.battery, carrierBattery - 8);

  game.player.y += 600;
  assert.equal(game.tetherConnected, false);
  assert.equal(game.stats.maxDepth, VEHICLES.moth.maxDepth);
  assert.equal(game.deploySub(), false);
  assert.equal(game.deployed, true);
  game.player.y = game.carrier.y;
  assert.equal(game.deploySub(), true);
  assert.equal(game.vehicle, 'whale');
  assert.equal(game.deployed, false);
  assert.equal(game.battery, carrierBattery - 12);
  const afterFirstCycle = game.battery;
  assert.equal(game.deploySub(), true);
  assert.equal(game.deploySub(), true);
  assert.equal(game.battery, afterFirstCycle - 12);
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
  game.wonders = [];
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
    assert.ok(isWater(entity.x, entity.y));
    assert.ok(entity.y > 0 && entity.y < 11000);
    if (entity.type === 'creature') {
      const species = game.getSpecies(entity.speciesId);
      const range = game.speciesDepthRange(species);
      assert.ok(entity.y >= range[0] && entity.y <= range[1], `${species.id} spawned outside its depth range`);
    }
  }
});

test('creature motion respects depth ranges and attached organisms never drift into open water', () => {
  const game = fresh();
  const attached = game.entities.filter(entity => entity.type === 'creature' && ['sessile', 'benthic'].includes(entity.behavior));
  const initialPositions = new Map(attached.map(entity => [entity.id, { x: entity.x, y: entity.y }]));
  for (const time of [0.2, 2, 7, 20, 60]) {
    game.elapsed = time;
    for (const entity of game.entities.filter(item => item.type === 'creature')) {
      game.moveCreature(entity);
      assert.ok(isWater(entity.x, entity.y));
      const range = game.speciesDepthRange(game.getSpecies(entity.speciesId));
      assert.ok(entity.y >= range[0] && entity.y <= range[1]);
      if (entity.behavior === 'sessile') assert.deepEqual({ x: entity.x, y: entity.y }, initialPositions.get(entity.id));
      if (entity.behavior === 'benthic' && !entity.caveId && entity.attachment?.side !== 'floor') assert.ok(entity.x < 125 || entity.x > 875);
      if (entity.attachment?.side === 'floor' && !entity.caveId) assert.equal(entity.y, initialPositions.get(entity.id).y);
    }
  }
});

test('deep targets require the lamp or a live sonar detection before capture', () => {
  const game = fresh();
  game.player = { x: 490, y: 2000, facing: 1, heading: { x: 1, y: 0 } };
  const entity = putSampleWithinReach(game, 'ghost_shrimp');
  entity.x = game.player.x - 85;
  entity.originX = entity.x;
  assert.equal(game.isEntityVisible(entity), false);
  assert.equal(game.nearestTarget, null);
  assert.equal(game.capture(), false);
  assert.equal(game.scan(), true);
  assert.equal(game.isEntityVisible(entity), true);
  assert.equal(game.nearestTarget, entity);
  game.elapsed += game.sonar.duration + 0.1;
  assert.equal(game.isEntityVisible(entity), false);
  game.player.heading = { x: -1, y: 0 };
  assert.equal(game.isEntityVisible(entity), true);
  assert.equal(game.capture(), true);
});

test('sonar contacts reveal ecological destinations and expire instead of exposing the whole map', () => {
  const game = fresh();
  game.player.y = 8800;
  assert.deepEqual(game.contacts, []);
  game.scan();
  assert.ok(game.contacts.some(contact => contact.id === 'last_light'));
  assert.ok(!game.contacts.some(contact => contact.id === 'moon_garden'));
  game.elapsed += 40;
  assert.deepEqual(game.contacts, []);
});

test('the scientific vessel produces better samples and has uniquely long sonar', () => {
  const game = fresh();
  game.vehicle = 'ray';
  game.ownedVehicles.push('ray');
  const entity = putSampleWithinReach(game, 'lanternfish');
  assert.equal(game.useAbility(), true);
  assert.equal(entity.biologicalScan, true);
  assert.equal(entity.sampleCondition, 'scanned');
  assert.equal(game.useAbility(), false);
  assert.equal(game.capture(), true);
  assert.ok(game.expedition.research > Math.floor(game.getSpecies('lanternfish').research * 0.2));
  assert.equal(game.cargo[0].sampleCondition, 'scanned');
  game.scan();
  assert.equal(game.sonar.duration, 8);
  assert.equal(game.sonar.radius, 1150);
});

test('ray sonar and lineage survey produce remote non-invasive samples without repeat harvesting', () => {
  const storage = memoryStorage();
  const game = new Game({ storage, load: false });
  game.vehicle = 'ray';
  game.ownedVehicles.push('ray');
  game.player = { x: 490, y: 2000, facing: 1, heading: { x: 1, y: 0 } };
  const entity = putSampleWithinReach(game, 'ghost_shrimp');
  entity.y = 2900;
  entity.originY = 2900;
  assert.equal(game.useAbility(), false);
  assert.equal(game.nearestTarget, null);
  assert.equal(game.scan(), true);
  assert.equal(game.useAbility(), true);
  assert.equal(game.getTargetRange(entity), 1150);
  assert.equal(game.nearestTarget, entity);
  assert.equal(game.capture(), true);
  assert.equal(entity.alive, true);
  assert.equal(entity.sampled, true);
  assert.equal(game.cargo[0].fidelity, true);
  assert.equal(game.cargo[0].nonInvasive, true);
  assert.ok(game.cargoWeight <= game.getSpecies('ghost_shrimp').weight);
  assert.equal(game.observations.ghost_shrimp.count, 1);
  assert.equal(game.observations.ghost_shrimp.lastDepth, 2900);
  game.captureCooldown = 0;
  game.abilityCooldowns.ray = 0;
  assert.equal(game.capture(), false);
  assert.equal(game.useAbility(), false);
  assert.equal(game.totalCaptures, 1);
  game.save();
  const restored = new Game({ storage });
  assert.equal(restored.sampleStock.ghost_shrimp, 1);
  assert.equal(restored.sampleFidelity.ghost_shrimp, 1);
  assert.equal(restored.observations.ghost_shrimp.count, 1);
  const restoredAgain = new Game({ storage });
  assert.deepEqual(restoredAgain.sampleFidelity, restored.sampleFidelity);
  assert.deepEqual(restoredAgain.sampleStock, restored.sampleStock);
});

test('ray survey prioritizes distinct species and records each live individual only once', () => {
  const game = fresh();
  game.vehicle = 'ray';
  game.entities = ['glassfish', 'glassfish', 'glassfish', 'emberfin', 'moonjelly', 'ribbon_eel', 'lanternfish'].map((speciesId, index) => ({ id: `survey-${index}`, type: 'creature', alive: true, speciesId, x: 500 + index * 7, y: 100, originX: 500 + index * 7, originY: 100 }));
  assert.equal(game.useAbility(), true);
  const marked = game.entities.filter(entity => entity.biologicalScan);
  assert.equal(marked.length, 5);
  assert.equal(new Set(marked.map(entity => entity.speciesId)).size, 5);
  game.elapsed = 20;
  game.abilityCooldowns.ray = 0;
  assert.equal(game.useAbility(), true);
  assert.equal(game.observations.glassfish.count, 1);
  assert.equal(game.observations.lanternfish.count, 1);
});

test('locked ray observations take precedence over closer duplicate animals and ordinary minerals', () => {
  const game = fresh();
  game.vehicle = 'ray';
  game.player = { x: 490, y: 2000, facing: 1, heading: { x: 1, y: 0 } };
  const creatures = [
    ['lionfish', 20], ['lionfish', 25], ['seahorse', 200],
    ['moonjelly', 300], ['glassfish', 400], ['emberfin', 500],
  ].map(([speciesId, distance], index) => ({ id: `priority-${index}`, type: 'creature', alive: true, speciesId, x: 490, y: 2000 + distance, originX: 490, originY: 2000 + distance }));
  const mineral = { id: 'ordinary-ore', type: 'mineral', alive: true, x: 505, y: 2000, amount: 2 };
  game.entities = [mineral, ...creatures];
  assert.equal(game.nearestTarget, mineral);
  assert.equal(game.scan(), true);
  assert.equal(game.useAbility(), true);
  assert.equal(creatures[0].biologicalScan, true);
  assert.equal(creatures[1].biologicalScan, undefined);
  assert.equal(game.nearestTarget, creatures[0]);
  assert.equal(game.capture(), true);
  game.captureCooldown = 0;
  assert.equal(game.nearestTarget, creatures[2]);
  assert.equal(game.capture(), true);
  assert.equal(creatures[1].alive, true);
  assert.equal(creatures[1].sampled, undefined);
  assert.equal(mineral.alive, true);
  assert.equal(game.cargo.length, 2);
  assert.ok(game.cargo.every(item => item.fidelity && item.nonInvasive));
  game.elapsed = 19;
  game.captureCooldown = 0;
  assert.equal(game.nearestTarget, mineral);
  assert.equal(game.capture(), true);
  assert.equal(game.nearestTarget, creatures[1]);
});

test('fidelity is a bounded subset of sample stock and legacy inventories are not silently promoted', () => {
  const storage = memoryStorage();
  const game = new Game({ storage, load: false });
  game.returnToBase();
  game.sampleStock = { glassfish: 2, emberfin: 3 };
  game.sampleFidelity = { glassfish: 999, moonjelly: 4 };
  game.save();
  const loaded = new Game({ storage });
  assert.equal(loaded.sampleFidelity.glassfish, 2);
  assert.equal(loaded.sampleFidelity.moonjelly, undefined);
  assert.equal(loaded.sampleFidelity.emberfin, undefined);
  loaded.sampleFidelity = {};
  loaded.save();
  assert.deepEqual(new Game({ storage }).sampleFidelity, {});
});

test('a single equipped bio module applies its exact tier effects without stacking unequipped modules', () => {
  const game = fresh();
  const original = { ...game.stats };
  assert.equal(game.unlockBioModule('invalid', 1), false);
  assert.equal(game.unlockBioModule('lumen', 2), true);
  assert.equal(game.equipBioModule('lumen'), false);
  assert.equal(game.stats.vision, original.vision);
  game.returnToBase();
  assert.equal(game.equipBioModule('lumen'), true);
  assert.equal(game.stats.vision, original.vision * 1.35);
  assert.equal(game.unlockBioModule('flow', 3), true);
  assert.equal(game.stats.speed, original.speed);
  assert.equal(game.equipBioModule('flow'), true);
  assert.equal(game.stats.vision, original.vision);
  assert.equal(game.stats.speed, original.speed * 1.24);
  assert.equal(game.unlockBioModule('flow', 1), false);
  assert.equal(game.bioModules.flow, 3);
  assert.equal(game.unlockBioModule('shell', 99), true);
  assert.equal(game.bioModules.shell, 3);
  assert.equal(game.equipBioModule('shell'), true);
  assert.equal(game.stats.speed, original.speed);
  assert.equal(game.stats.maxDepth, original.maxDepth + 900);
  assert.equal(game.equipBioModule(null), true);
  assert.deepEqual(game.stats, original);
});

test('echo module extends sonar and repair only heals outside excess pressure', () => {
  const game = fresh();
  game.wonders = [];
  game.returnToBase();
  game.unlockBioModule('echo', 3);
  game.equipBioModule('echo');
  game.launch();
  game.scan();
  assert.equal(game.sonar.duration, 8);
  assert.equal(game.sonar.cooldown, 9);
  game.returnToBase();
  game.unlockBioModule('repair', 2);
  game.equipBioModule('repair');
  game.launch();
  game.hull = 50;
  game.update(0.1);
  assert.ok(Math.abs(game.hull - 50.06) < 1e-8);
  game.player.y = game.stats.maxDepth + 700;
  game.update(0.1);
  assert.ok(Math.abs(game.hull - 49.56) < 1e-8);
});

test('module ownership and the selected slot persist, while reset clears all lab extensions', () => {
  const storage = memoryStorage();
  const game = new Game({ storage, load: false });
  game.returnToBase();
  for (const module of BIO_MODULES) game.unlockBioModule(module.id, 2);
  game.equipBioModule('shell');
  game.sampleStock = { glassfish: 2 };
  game.sampleFidelity = { glassfish: 1 };
  game.observations = { glassfish: { count: 1, firstDepth: 40, lastDepth: 40, behavior: 'school' } };
  game.save();
  const restored = new Game({ storage });
  assert.equal(restored.equippedBioModule, 'shell');
  assert.deepEqual(restored.bioModules, game.bioModules);
  assert.equal(restored.stats.maxDepth, VEHICLES.moth.maxDepth + 650);
  assert.deepEqual(restored.sampleFidelity, { glassfish: 1 });
  restored.reset();
  assert.deepEqual(restored.bioModules, {});
  assert.equal(restored.equippedBioModule, null);
  assert.deepEqual(restored.observations, {});
  assert.deepEqual(restored.sampleFidelity, {});
});

test('whale drilling extracts more rock and cannot vacuum cave ore through the wall', () => {
  const game = fresh();
  game.vehicle = 'whale';
  game.player = { x: 160, y: 1500, facing: -1, heading: { x: -1, y: 0 } };
  const mineral = { id: 'ore', type: 'mineral', alive: true, x: 102, y: 1500, amount: 4, attachment: { side: 'left', anchorX: 90, anchorY: 1500 } };
  game.entities = [mineral];
  assert.equal(game.useAbility(), true);
  assert.equal(game.expedition.alloy, 10);
  assert.equal(mineral.alive, false);
  const cave = CAVES[0];
  game.player.x = 134;
  game.player.y = cave.y;
  const caveOre = { ...mineral, id: 'cave-ore', alive: true, x: 42, y: cave.y, caveId: cave.id };
  game.entities = [caveOre];
  game.abilityCooldowns.whale = 0;
  assert.equal(game.nearestTarget, null);
  assert.equal(game.useAbility(), false);
  assert.equal(caveOre.alive, true);
});

test('all minerals are anchored to real walls or cave floors and deep ecosystems are sparse', () => {
  const game = fresh();
  for (const entity of game.entities.filter(item => item.type === 'mineral')) {
    assert.ok(entity.attachment);
    const { side, anchorX, anchorY } = entity.attachment;
    if (side === 'floor') {
      const cave = CAVES.find(item => item.id === entity.caveId);
      assert.equal(anchorY, cave.bounds.bottom);
      assert.equal(entity.y, anchorY - 12);
    } else {
      assert.equal(anchorX, side === 'left' ? 90 : 910);
      assert.equal(Math.abs(entity.x - anchorX), 12);
    }
  }
  const deep = game.entities.filter(entity => entity.type === 'creature' && entity.y >= 4000);
  assert.ok(deep.length >= 25 && deep.length <= 45);
  assert.ok(!deep.some(entity => entity.y > 8000 && entity.y < 10000));
  assert.ok(VEHICLES.moth.speed > VEHICLES.ray.speed && VEHICLES.ray.speed > VEHICLES.whale.speed);
});

test('entering the first cave unlocks a permanent usable paint without double rewards', () => {
  const game = fresh();
  const cave = CAVES[0];
  game.player.x = 42;
  game.player.y = cave.y;
  game.update(0.1);
  assert.equal(game.currentCave.id, cave.id);
  assert.ok(game.unlockedPaints.includes('coral'));
  const credits = game.resources.credits;
  game.update(0.1);
  assert.equal(game.resources.credits, credits);
  assert.equal(game.equipPaint('moth', 'coral'), false);
  game.returnToBase();
  assert.equal(game.equipPaint('moth', 'coral'), true);
  assert.equal(game.paintId, 'coral');
});

test('lab state, admitted stock and cosmetic choices survive a save without duplicating inventory', () => {
  const storage = memoryStorage();
  const game = new Game({ storage, load: false });
  game.returnToBase();
  game.sampleStock = { glassfish: 4 };
  game.labState = { running: true, queue: [{ speciesId: 'glassfish' }], score: 5 };
  game.labProcessed = 10;
  game.labRuns = 2;
  game.labBestCombo = 4;
  game.unlockPaint('aurora');
  game.equipPaint('moth', 'aurora');
  game.save();
  const loaded = new Game({ storage });
  assert.deepEqual(loaded.sampleStock, { glassfish: 4 });
  assert.deepEqual(loaded.labState, game.labState);
  assert.equal(loaded.labProcessed, 10);
  assert.equal(loaded.labRuns, 2);
  assert.equal(loaded.labBestCombo, 4);
  assert.equal(loaded.paintId, 'aurora');
});

test('a saved carrier expedition recovers mother and scout samples exactly once', () => {
  const storage = memoryStorage();
  const game = new Game({ storage, load: false });
  game.vehicle = 'whale';
  game.ownedVehicles.push('whale');
  game.battery = game.stats.battery;
  putSampleWithinReach(game, 'glassfish');
  game.capture();
  game.deploySub();
  assert.equal(game.carrier.cargo[0].speciesId, 'glassfish');
  assert.equal(game.cargoWeight, 0);
  putSampleWithinReach(game, 'emberfin');
  game.capture();
  game.save();
  const loaded = new Game({ storage });
  assert.equal(loaded.vehicle, 'whale');
  assert.deepEqual(loaded.sampleStock, { glassfish: 1, emberfin: 1 });
  assert.equal(loaded.lastExpedition.captures, 2);
  const again = new Game({ storage });
  assert.deepEqual(again.sampleStock, loaded.sampleStock);
  assert.deepEqual(again.resources, loaded.resources);
});

test('version one migration preserves upgrades and resources and recovers outstanding samples exactly once', () => {
  const storage = memoryStorage();
  storage.setItem('dive-into-wonder-v1', JSON.stringify({ version: 1, vehicle: 'ray', ownedVehicles: ['moth', 'ray'], resources: { credits: 1234, research: 321, alloy: 20 }, upgrades: { hull: 3, cargo: 2 }, discoveries: ['glassfish'], docked: false, expedition: { credits: 32, research: 8, alloy: 0, captures: 1 }, cargo: [{ speciesId: 'glassfish', count: 1, weight: 1 }], missionTiers: { depth: 2 } }));
  const game = new Game({ storage });
  assert.equal(game.resources.credits, 1266);
  assert.equal(game.resources.research, 329);
  assert.equal(game.upgrades.hull, 3);
  assert.equal(game.upgrades.cargo, 2);
  assert.equal(game.vehicle, 'ray');
  assert.equal(game.sampleStock.glassfish, 1);
  assert.equal(JSON.parse(storage.getItem('dive-into-wonder-v1')).version, 2);
  const reloaded = new Game({ storage });
  assert.deepEqual(reloaded.resources, game.resources);
  assert.deepEqual(reloaded.sampleStock, game.sampleStock);
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
