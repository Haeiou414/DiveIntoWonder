import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, ZONES, GENES } from '../data.js';
import { scientificProfile } from '../taxonomy.js';

const originalIds = [
  'glassfish', 'emberfin', 'moonjelly', 'ribbon_eel', 'lanternfish', 'umbrella_octopus',
  'ghost_shrimp', 'crystal_jelly', 'vampire_squid', 'gulper_eel', 'abyss_ray',
  'siphonophore', 'yeti_crab', 'dumbo', 'ghost_whale', 'hadal_snailfish', 'crown_jelly', 'leviathan',
];
const byId = new Map(SPECIES.map(species => [species.id, species]));
const traits = ['lumen', 'flow', 'shell', 'echo', 'repair'];
const behaviors = ['school', 'cruise', 'drift', 'pulse', 'jet', 'benthic', 'sessile'];

test('thirty distinct species preserve every original save and gene identifier', () => {
  assert.equal(SPECIES.length, 30);
  assert.equal(byId.size, 30);
  assert.equal(new Set(SPECIES.map(species => species.morphology)).size, 30);
  for (const id of originalIds) assert.ok(byId.has(id), id);
  for (const gene of GENES) assert.ok(byId.has(gene.speciesId), gene.id);
});

test('every scientific prototype has a complete attributable classification', () => {
  for (const species of SPECIES) {
    const taxonomy = species.taxonomy;
    for (const field of ['phylum', 'class', 'order', 'family', 'genus', 'group', 'rank']) {
      assert.equal(typeof taxonomy[field], 'string', species.id + '.' + field);
      assert.ok(taxonomy[field].length > 0);
      assert.ok(!taxonomy[field].includes('undefined'));
    }
    assert.ok(species.scientificName.startsWith(taxonomy.genus));
    assert.ok(Number.isInteger(taxonomy.aphiaId) && taxonomy.aphiaId > 0);
    const source = new URL(taxonomy.source);
    assert.equal(source.hostname, 'www.marinespecies.org');
    assert.equal(source.searchParams.get('id'), String(taxonomy.aphiaId));
    assert.match(species.prototype, /原型/);
    assert.ok(species.ecology.length > 15);
    assert.deepEqual(scientificProfile(species.scientificName).taxonomy, taxonomy);
  }
  assert.equal(new Set(SPECIES.map(species => species.taxonomy.phylum)).size, 6);
  assert.equal(new Set(SPECIES.map(species => species.taxonomy.group)).size, 10);
  assert.throws(() => scientificProfile('Unverified species'), /Missing scientific prototype/);
});

test('scientific groups distinguish different gelatinous animals and crustaceans', () => {
  assert.match(byId.get('comb_jelly').taxonomy.phylum, /Ctenophora/);
  assert.match(byId.get('moonjelly').taxonomy.class, /Scyphozoa/);
  assert.match(byId.get('crystal_jelly').taxonomy.class, /Hydrozoa/);
  assert.equal(byId.get('siphonophore').taxonomy.order, 'Siphonophorae');
  assert.equal(byId.get('sea_pen').taxonomy.order, 'Scleralcyonacea');
  assert.equal(byId.get('giant_isopod').taxonomy.order, 'Isopoda');
  assert.equal(byId.get('ghost_shrimp').taxonomy.order, 'Decapoda');
  assert.equal(byId.get('leviathan').taxonomy.order, 'Amphipoda');
  assert.notEqual(byId.get('leviathan').taxonomy.family, byId.get('hadal_amphipod').taxonomy.family);
});

test('legacy fantasy giants use appropriate deep-sea prototypes and current accepted names', () => {
  assert.equal(byId.get('ghost_whale').scientificName, 'Scotoplanes globosa');
  assert.match(byId.get('ghost_whale').taxonomy.class, /Holothuroidea/);
  assert.equal(byId.get('leviathan').scientificName, 'Alicella gigantea');
  assert.equal(byId.get('umbrella_octopus').scientificName, 'Insigniteuthis albatrossi');
  assert.equal(byId.get('dumbo').taxonomy.rank, 'genus');
  assert.match(byId.get('dumbo').prototype, /属级/);
});

test('encounter ranges stay inside their zones and all behaviors are explicit', () => {
  for (const species of SPECIES) {
    const zone = ZONES.find(item => item.id === species.zone);
    assert.ok(zone, species.id);
    assert.equal(species.depthRange.length, 2);
    const [min, max] = species.depthRange;
    assert.ok(Number.isFinite(min) && Number.isFinite(max));
    assert.ok(min >= zone.min && max <= zone.max && min < max, species.id);
    assert.ok(behaviors.includes(species.behavior), species.id);
    assert.ok(species.behaviorLabel.length > 1);
    for (const field of ['size', 'weight', 'value', 'research', 'xp']) {
      assert.ok(Number.isFinite(species[field]) && species[field] > 0, species.id + '.' + field);
    }
  }
  assert.equal(new Set(SPECIES.map(species => species.behavior)).size, 7);
});

test('five engineering affinities remain available from the first sea zone', () => {
  for (const species of SPECIES) {
    assert.ok(species.traits.length >= 1 && species.traits.length <= 2);
    assert.equal(new Set(species.traits).size, species.traits.length);
    for (const trait of species.traits) assert.ok(traits.includes(trait), species.id);
    assert.match(species.ability, /科幻/);
  }
  for (const trait of traits) {
    assert.ok(SPECIES.some(species => species.zone === 'sun' && species.traits.includes(trait)), trait);
    assert.ok(SPECIES.filter(species => species.traits.includes(trait)).length >= 8, trait);
  }
});
