import { ZONES, SPECIES, VEHICLES, GENES, UPGRADES, WONDERS, PAINTS } from './data.js';
import { CAVES, HOTSPOTS, getCaveAt, hasLineOfSight, isWater, moveWithCollision, wallX } from './world.js';
import { BIO_MODULES, getBioModuleEffect } from './bio-modules.js';

const SAVE_KEY = 'dive-into-wonder-v1';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const speciesById = Object.fromEntries(SPECIES.map(species => [species.id, species]));
const depthMilestones = [350, 900, 1800, 3500, 5000, 7500, 10500];
const captureMilestones = [3, 8, 16, 28, 45, 70, 100];
const collectionMilestones = [...new Set([3, 6, 10, 14, 18, 24, 30, SPECIES.length])].filter(count => count <= SPECIES.length).sort((a, b) => a - b);

export class Game {
  constructor(options = {}) {
    this.listeners = new Set();
    this.onEvent = null;
    this.storage = options.storage ?? this.getStorage();
    this.elapsed = 0;
    this.entitySequence = 0;
    this.captureCooldown = 0;
    this.warningCooldown = 0;
    this.autosaveTimer = 0;
    this.saveErrorReported = false;
    this.initialize();
    if (options.load !== false) this.load();
    this.spawnWorld();
  }

  getStorage() {
    try { return globalThis.localStorage ?? null; } catch { return null; }
  }

  initialize() {
    this.player = { x: 490, y: 100, facing: 1, heading: { x: 1, y: 0 } };
    this.vehicle = 'moth';
    this.battery = VEHICLES.moth.battery;
    this.hull = 100;
    this.cargo = [];
    this.resources = { credits: 240, research: 0, alloy: 5 };
    this.level = 1;
    this.xp = 0;
    this.maxDepth = 100;
    this.discoveries = [];
    this.researched = [];
    this.ownedVehicles = ['moth'];
    this.upgrades = { hull: 0, battery: 0, cargo: 0, thruster: 0 };
    this.docked = false;
    this.paused = false;
    this.sonar = { remaining: 0, cooldown: 0 };
    this.boost = false;
    this.carrier = null;
    this.abilityCooldowns = { moth: 0, ray: 0, whale: 0 };
    this.dashRemaining = 0;
    this.detectedHotspots = {};
    this.ecologicalHotspots = [];
    this.caveDiscoveries = [];
    this.unlockedPaints = ['classic'];
    this.paintByVehicle = { moth: 'classic', ray: 'classic', whale: 'classic' };
    this.sampleStock = {};
    this.sampleFidelity = {};
    this.observations = {};
    this.bioModules = {};
    this.equippedBioModule = null;
    this.labState = null;
    this.labProcessed = 0;
    this.labRuns = 0;
    this.labBestCombo = 0;
    this.expedition = { captures: 0, alloy: 0, credits: 0, research: 0, startDepth: 100, deepest: 100, duration: 0 };
    this.lastExpedition = null;
    this.totalCaptures = 0;
    this.totalDives = 0;
    this.totalAlloy = 0;
    this.captureCounts = {};
    this.collectionTier = 0;
    this.missionTiers = { depth: 0, capture: 0, research: 0 };
    this.wonders = WONDERS.map(wonder => ({ ...wonder, discovered: false }));
    this.entities = [];
    this.previousZone = this.zone.id;
    this.missions = [];
    this.refreshMissions();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(type, title, message = '', extra = {}) {
    const event = { type, title, message, ...extra };
    this.onEvent?.(event);
    for (const listener of this.listeners) listener(event);
  }

  get stats() {
    const vehicle = VEHICLES[this.vehicle];
    const pressureVehicle = this.tetherConnected ? VEHICLES.whale : vehicle;
    const module = this.bioModuleEffect;
    return {
      maxDepth: pressureVehicle.maxDepth + this.upgrades.hull * 900 + (module.depthBonus ?? 0),
      battery: vehicle.battery + this.upgrades.battery * 65,
      cargo: vehicle.cargo + this.upgrades.cargo * 8 + (this.researched.includes('elastic') ? 10 : 0),
      speed: vehicle.speed * (1 + this.upgrades.thruster * 0.15) * (this.researched.includes('streamline') ? 1.15 : 1) * (module.speedMultiplier ?? 1),
      vision: vehicle.vision * (this.researched.includes('lumen') ? 1.3 : 1) * (module.visionMultiplier ?? 1),
      captureRange: vehicle.captureRange * (this.researched.includes('echo') ? 1.25 : 1),
    };
  }

  get cargoWeight() { return this.cargo.reduce((sum, item) => sum + (item.weight ?? 1) * (item.count ?? 1), 0); }
  get zone() { return ZONES.find(zone => this.player.y < zone.max) ?? ZONES[ZONES.length - 1]; }
  get xpToNextLevel() { return 60 + (this.level - 1) * 35; }
  get batteryPercent() { return clamp(this.battery / this.stats.battery * 100, 0, 100); }
  get deployed() { return Boolean(this.carrier); }
  get tetherDistance() { return this.carrier ? Math.hypot(this.player.x - this.carrier.x, this.player.y - this.carrier.y) : 0; }
  get tetherConnected() { return Boolean(this.carrier && this.tetherDistance <= this.carrier.tetherRange); }
  get currentCave() { return getCaveAt(this.player.x, this.player.y); }
  get paintId() { return this.paintByVehicle[this.vehicle] ?? 'classic'; }
  get bioModuleEffect() { return getBioModuleEffect(this.equippedBioModule, this.bioModules[this.equippedBioModule] ?? 0); }
  get visibility() {
    const depth = this.player.y;
    const ambientRadius = depth < 200 ? 640 : depth < 1000 ? 105 : depth < 4000 ? 52 : 38;
    return { ambientRadius, beamRange: this.stats.vision * (depth >= 4000 ? 0.82 : 1), beamCos: 0.68, sonarRadius: this.sonar.remaining > 0 ? this.sonar.radius ?? 650 : 0 };
  }

  isEntityVisible(entity) {
    if (!entity || entity.alive === false) return false;
    const dx = entity.x - this.player.x;
    const dy = entity.y - this.player.y;
    const distance = Math.hypot(dx, dy);
    const visibility = this.visibility;
    const targetAmbient = entity.y < 200 ? 640 : entity.y < 1000 ? 105 : entity.y < 4000 ? 52 : 38;
    const heading = this.player.heading ?? { x: this.player.facing, y: 0 };
    const illuminated = distance <= Math.min(visibility.ambientRadius, targetAmbient)
      || distance <= visibility.beamRange && (dx * heading.x + dy * heading.y) / Math.max(1, distance) >= visibility.beamCos;
    if (!illuminated && (entity.scannedUntil ?? 0) <= this.elapsed) return false;
    return hasLineOfSight(this.player.x, this.player.y, entity.x, entity.y);
  }

  get contacts() {
    return this.hotspots.filter(spot => (this.detectedHotspots[spot.id] ?? 0) > this.elapsed)
      .map(spot => ({ ...spot, expiresAt: this.detectedHotspots[spot.id], distance: Math.hypot(spot.x - this.player.x, spot.y - this.player.y) }))
      .sort((a, b) => a.distance - b.distance);
  }

  get hotspots() { return [...HOTSPOTS, ...this.ecologicalHotspots]; }

  get activeAbility() {
    const abilities = {
      moth: { name: '窄域冲刺', description: '消耗 10 电量，2 秒灵巧冲刺。萤蛾号可通过洞穴狭口。' },
      ray: { name: '活体谱系勘测', description: '消耗 12 电量，锁定已探明的至多 5 份活体，优先不同物种。18 秒内按 E 远距记录高完整度样本；生物不会被带走。' },
      whale: { name: '连锁破岩', description: '消耗 15 电量，开采前方 3 处岩壁矿脉，矿物产出提高。' },
    };
    const cooldown = this.abilityCooldowns[this.vehicle] ?? 0;
    return { ...abilities[this.vehicle], cooldown, ready: !this.docked && !this.paused && cooldown <= 0 };
  }

  get nearestTarget() {
    let nearest = null;
    let best = Infinity;
    let bestPriority = Infinity;
    for (const entity of this.entities) {
      if (!entity.alive || entity.sampled || !this.isEntityVisible(entity)) continue;
      if (entity.caveId && (this.vehicle !== 'moth' || this.currentCave?.id !== entity.caveId)) continue;
      const distance = Math.hypot(entity.x - this.player.x, entity.y - this.player.y);
      if (distance >= this.getTargetRange(entity)) continue;
      const priority = this.isObservationTarget(entity) ? 0 : 1;
      if (priority < bestPriority || priority === bestPriority && distance < best) {
        nearest = entity;
        best = distance;
        bestPriority = priority;
      }
    }
    return nearest;
  }

  isObservationTarget(entity) {
    return this.vehicle === 'ray' && entity?.type === 'creature' && !entity.caveId && !entity.sampled
      && entity.biologicalScan && (entity.surveyUntil ?? 0) > this.elapsed;
  }

  getTargetRange(entity) {
    return this.isObservationTarget(entity) ? 1150 * (this.researched.includes('echo') ? 1.15 : 1) : this.stats.captureRange;
  }

  equipBioModule(id) {
    if (!this.docked) { this.emit('info', '仿生模块需要港口安装', '返回基地后可选择一个生效的仿生模块。'); return false; }
    if (id !== null && (!BIO_MODULES.some(module => module.id === id) || !Object.hasOwn(this.bioModules, id) || this.bioModules[id] <= 0)) return false;
    this.equippedBioModule = id;
    const module = BIO_MODULES.find(item => item.id === id);
    this.emit('module', module ? `${module.name}已装备` : '仿生模块已卸下', module ? module.levels[this.bioModules[id] - 1] : '下潜时只有当前装备的一个模块生效。');
    this.save();
    return true;
  }

  unlockBioModule(id, level = 1) {
    const module = BIO_MODULES.find(item => item.id === id);
    if (!module || !Number.isFinite(level) || level < 1) return false;
    const nextLevel = Math.min(3, Math.floor(level));
    if ((this.bioModules[id] ?? 0) >= nextLevel) return false;
    this.bioModules[id] = nextLevel;
    this.emit('module', `${module.name} · 阶段 ${nextLevel}`, `${module.levels[nextLevel - 1]}。返回港口选择装备，只有一个模块可同时生效。`, { moduleId: id, level: nextLevel });
    this.save();
    return true;
  }

  getSpecies(id) { return speciesById[id]; }
  getVehicle(id = this.vehicle) { return VEHICLES[id]; }

  getUpgradeCost(id) {
    const upgrade = UPGRADES.find(item => item.id === id);
    if (!upgrade) return null;
    const level = this.upgrades[id];
    return { credits: Math.round(upgrade.baseCost.credits * (1 + level * 0.8)), alloy: upgrade.baseCost.alloy + level * 3 };
  }

  random(seed) {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  speciesDepthRange(species) {
    const zone = ZONES.find(item => item.id === species.zone) ?? ZONES[0];
    const range = species.depthRange;
    if (Array.isArray(range) && range.length === 2 && range.every(Number.isFinite)) return [Math.max(20, zone.min, range[0]), Math.min(10960, zone.max, range[1])];
    return [Math.max(20, zone.min + 25), Math.min(10960, zone.max - 25)];
  }

  spawnWorld() {
    this.entities = [];
    this.ecologicalHotspots = [];
    let seed = 37 + this.totalDives * 103;
    const creatureCounts = [14, 15, 19, 10, 24];
    const speciesHabitats = {};
    for (const species of SPECIES) {
      const [minimum, maximum] = this.speciesDepthRange(species);
      let habitats = this.hotspots.filter(spot => spot.y >= minimum && spot.y <= maximum);
      if (!habitats.length) {
        const depth = Math.round((minimum + maximum) / 2);
        const habitat = { id: `habitat_${species.id}`, name: `${ZONES.find(zone => zone.id === species.zone)?.name ?? '深海'}生态群落`, x: 500, y: depth, type: 'ecology' };
        this.ecologicalHotspots.push(habitat);
        habitats = [habitat];
      }
      speciesHabitats[species.id] = habitats;
    }
    const addCreature = (species, x, y, extra = {}) => {
      if (!species) return;
      const depthRange = this.speciesDepthRange(species);
      y = clamp(y, depthRange[0], depthRange[1]);
      const behavior = species.behavior ?? ({ jelly: 'pulse', squid: 'jet', crab: 'benthic' }[species.kind] ?? 'cruise');
      let attachment;
      if (behavior === 'benthic' || behavior === 'sessile') {
        const cave = CAVES.find(item => item.id === extra.caveId);
        if (cave) {
          y = clamp(cave.bounds.bottom - 22, depthRange[0], depthRange[1]);
          attachment = { side: 'floor', anchorX: x, anchorY: cave.bounds.bottom };
        } else {
          const side = this.random(seed++) < 0.5 ? 'left' : 'right';
          const anchorX = wallX(side);
          const standing = ['sea_pen', 'tripod_fish', 'feather_star'].includes(species.id);
          x = anchorX + (side === 'left' ? 1 : -1) * (standing ? 38 : 18);
          attachment = standing
            ? { side: 'floor', anchorX: x, anchorY: y + species.size * 0.5, wallSide: side, wallAnchorX: anchorX }
            : { side, anchorX, anchorY: y };
        }
      }
      this.entities.push({ id: `e${this.entitySequence++}`, type: 'creature', speciesId: species.id, x, y, originX: x, originY: y, behavior, depthRange, attachment, phase: this.random(seed++) * Math.PI * 2, alive: true, size: species.size, color: species.color, scannedUntil: 0, ...extra });
    };
    const addMineral = (side, y, amount, extra = {}) => {
      const anchorX = wallX(side);
      const x = anchorX + (side === 'left' ? 12 : -12);
      this.entities.push({ id: `e${this.entitySequence++}`, type: 'mineral', material: 'alloy', x, y, originX: x, originY: y, alive: true, amount, size: 13, attachment: { side, anchorX, anchorY: y }, scannedUntil: 0, ...extra });
    };
    for (const [zoneIndex, zone] of ZONES.entries()) {
      const species = SPECIES.filter(item => item.zone === zone.id);
      const spots = this.hotspots.filter(spot => spot.y >= zone.min && spot.y < zone.max);
      for (let i = 0; i < Math.max(creatureCounts[zoneIndex], species.length); i++) {
        const creature = species[i % species.length];
        const habitats = speciesHabitats[creature.id];
        const spot = habitats[Math.floor(i / species.length) % habitats.length];
        const [minimum, maximum] = this.speciesDepthRange(creature);
        // Deep life clusters around energy sources, leaving long, quiet passages.
        const y = zoneIndex < 2
          ? minimum + this.random(seed++) * (maximum - minimum)
          : clamp(spot.y + (this.random(seed++) - 0.5) * 260, minimum, maximum);
        const x = zoneIndex < 2 ? 150 + this.random(seed++) * 700 : clamp(spot.x + (this.random(seed++) - 0.5) * 260, 150, 850);
        addCreature(creature, x, y, { hotspotId: spot.id });
      }
      const mineralCount = [5, 7, 8, 5, 8][zoneIndex];
      for (let i = 0; i < mineralCount; i++) {
        const spot = spots[i % spots.length];
        const y = zoneIndex < 2 ? zone.min + 35 + this.random(seed++) * (zone.max - zone.min - 70) : clamp(spot.y + (this.random(seed++) - 0.5) * 250, zone.min + 25, zone.max - 25);
        addMineral(i % 2 ? 'right' : 'left', y, zoneIndex + 2, { hotspotId: spot.id });
      }
    }
    // The shallow tutorial supplies samples; ore is always attached to real rock.
    for (const [speciesId, x, y] of [['glassfish', 550, 105], ['emberfin', 410, 165], ['moonjelly', 600, 190], ['ribbon_eel', 500, 275], ['lanternfish', 620, 380]]) {
      addCreature(speciesById[speciesId], x, y);
    }
    addMineral('left', 245, 3);
    for (const [index, cave] of CAVES.entries()) {
      const x = (cave.bounds.left + cave.bounds.right) / 2;
      const eligible = SPECIES.filter(species => {
        const [minimum, maximum] = this.speciesDepthRange(species);
        return minimum <= cave.y - 35 && maximum >= cave.y + 60;
      });
      const species = eligible.find(item => item.id === ['umbrella_octopus', 'crystal_jelly', 'ghost_whale'][index]) ?? eligible[0];
      if (species) addCreature(species, x, cave.y - 35, { caveId: cave.id, hotspotId: cave.id, drift: 5, researchBonus: 15 + index * 20, sampleCondition: 'pristine' });
      const y = cave.bounds.bottom - 12;
      this.entities.push({ id: `e${this.entitySequence++}`, type: 'mineral', material: 'alloy', x, y, originX: x, originY: y, alive: true, amount: 5 + index * 5, size: 15, caveId: cave.id, hotspotId: cave.id, scannedUntil: 0, attachment: { side: 'floor', anchorX: x, anchorY: cave.bounds.bottom } });
    }
  }

  update(dt, input = {}) {
    const delta = clamp(Number(dt) || 0, 0, 0.1);
    if (!delta || this.paused) return;
    this.elapsed += delta;
    if (this.docked) return;
    this.expedition.duration += delta;
    this.captureCooldown = Math.max(0, this.captureCooldown - delta);
    this.warningCooldown = Math.max(0, this.warningCooldown - delta);
    this.dashRemaining = Math.max(0, this.dashRemaining - delta);
    for (const id of Object.keys(this.abilityCooldowns)) this.abilityCooldowns[id] = Math.max(0, this.abilityCooldowns[id] - delta);
    this.sonar.remaining = Math.max(0, this.sonar.remaining - delta);
    this.sonar.cooldown = Math.max(0, this.sonar.cooldown - delta);
    if (this.sonar.remaining > 0) this.sonar.waveRadius = Math.min(this.sonar.radius, (this.sonar.duration - this.sonar.remaining) * 900);
    const stats = this.stats;
    const x = clamp(Number(input.x) || 0, -1, 1);
    const y = clamp(Number(input.y) || 0, -1, 1);
    const length = Math.hypot(x, y) || 1;
    const moving = x !== 0 || y !== 0;
    this.boost = Boolean(input.boost && moving && this.battery > 3);
    const speed = stats.speed * (this.dashRemaining > 0 ? 2.2 : this.boost ? 1.8 : 1);
    const tetherWasConnected = this.tetherConnected;
    moveWithCollision(this.player, x / Math.max(1, length) * speed * delta, y / Math.max(1, length) * speed * delta, this.vehicle);
    if (x !== 0) this.player.facing = x > 0 ? 1 : -1;
    if (moving) this.player.heading = { x: x / length, y: y / length };
    if (tetherWasConnected && !this.tetherConnected) this.emit('warning', '脐带保护中断', '距母舰超过 500 米，恢复萤蛾号自身耐压上限。返回母舰附近可重新连接。');
    this.maxDepth = Math.max(this.maxDepth, Math.floor(this.player.y));
    this.expedition.deepest = Math.max(this.expedition.deepest, Math.floor(this.player.y));
    const safeDepth = this.stats.maxDepth;
    const pressure = Math.max(0, (this.player.y - safeDepth) / 700);
    const consumption = (moving ? 0.85 : 0.28) * (this.researched.includes('metabolism') ? 0.75 : 1) + (this.boost ? 1.4 : 0) + pressure * 0.9;
    this.battery = Math.max(0, this.battery - consumption * delta);
    const repairRate = (this.researched.includes('repair') ? 1 : 0) + (this.bioModuleEffect.repairRate ?? 0);
    this.hull = clamp(this.hull - pressure * 5 * delta + (!pressure ? repairRate * delta : 0), 0, 100);
    if (pressure > 0 && this.warningCooldown <= 0) {
      this.emit('warning', '超过安全深度', `当前艇壳额定 ${safeDepth.toLocaleString()} 米。请上浮、靠近母舰或返回港口升级。`);
      this.warningCooldown = 14;
    } else if (this.batteryPercent < 20 && this.warningCooldown <= 0) {
      this.emit('warning', '电量不足 20%', '按 R 安全返航，所有收获都会保留。');
      this.warningCooldown = 20;
    }
    if (this.zone.id !== this.previousZone) {
      this.previousZone = this.zone.id;
      this.emit('zone', `进入${this.zone.name}`, this.zone.description, { zone: this.zone });
    }
    for (const entity of this.entities) {
      if (!entity.alive || entity.type !== 'creature' || Math.abs(entity.y - this.player.y) > 1100) continue;
      this.moveCreature(entity);
    }
    for (const hotspot of this.hotspots) {
      if (this.isEntityVisible(hotspot)) this.detectedHotspots[hotspot.id] = this.elapsed + 20;
    }
    for (const wonder of this.wonders) {
      if (!wonder.discovered && this.isEntityVisible(wonder)) this.discoverWonder(wonder);
    }
    if (this.currentCave && this.vehicle === 'moth') this.discoverCave(this.currentCave);
    this.refreshMissions();
    this.autosaveTimer += delta;
    if (this.autosaveTimer >= 12) { this.autosaveTimer = 0; this.save(); }
    if (this.battery <= 0 || this.hull <= 0) this.returnToBase(true);
  }

  moveCreature(entity) {
    const species = speciesById[entity.speciesId];
    const behavior = entity.behavior ?? species.behavior ?? 'cruise';
    const t = this.elapsed;
    const phase = entity.phase ?? 0;
    let dx = 0;
    let dy = 0;
    if (entity.caveId) {
      if (behavior === 'benthic') dx = Math.sin(t * 0.2 + phase) * 7;
      else if (behavior !== 'sessile') {
        dx = Math.sin(t * 0.4 + phase) * 5;
        dy = Math.cos(t * 0.3 + phase) * 5;
      }
    } else if (entity.attachment?.side === 'floor') {
      if (behavior === 'benthic') dx = Math.sin(t * 0.13 + phase) * 6;
    } else if (behavior === 'school') {
      const schoolPhase = SPECIES.indexOf(species) * 0.7;
      dx = Math.sin(t * 0.6 + schoolPhase) * 42;
      dy = Math.cos(t * 0.36 + schoolPhase) * 12;
    } else if (behavior === 'drift') {
      dx = Math.sin(t * 0.12 + phase) * 20;
      dy = Math.cos(t * 0.1 + phase) * 20;
    } else if (behavior === 'pulse') {
      dx = Math.sin(t * 0.2 + phase) * 13;
      dy = Math.sin(t * 0.75 + phase) * 14;
    } else if (behavior === 'jet') {
      dx = Math.sin(t * 0.75 + phase) ** 3 * 60;
      dy = Math.cos(t * 0.3 + phase) * 15;
    } else if (behavior === 'benthic') {
      dx = Math.sin(t * 0.2 + phase) * 3;
      dy = Math.sin(t * 0.13 + phase) * 18;
    } else if (behavior !== 'sessile') {
      dx = Math.sin(t * 0.32 + phase) * 55;
      dy = Math.cos(t * 0.19 + phase) * 14;
    }
    const range = entity.depthRange ?? this.speciesDepthRange(species);
    let nextX = entity.originX + dx;
    let nextY = clamp(entity.originY + dy, range[0], range[1]);
    if (entity.caveId) {
      const cave = CAVES.find(item => item.id === entity.caveId);
      if (cave) {
        nextX = clamp(nextX, cave.bounds.left + 12, cave.bounds.right - 12);
        nextY = clamp(nextY, Math.max(range[0], cave.bounds.top + 12), Math.min(range[1], cave.bounds.bottom - 12));
      }
    } else nextX = clamp(nextX, 103, 897);
    if (isWater(nextX, nextY)) {
      if (Math.abs(nextX - entity.x) > 0.001) entity.facing = nextX > entity.x ? 1 : -1;
      entity.x = nextX;
      entity.y = nextY;
    }
  }

  capture() {
    if (this.docked || this.paused || this.captureCooldown > 0) return false;
    const entity = this.nearestTarget;
    if (!entity) { this.emit('info', '靠近一点', '将载具开到生物或矿物附近，再按 E 采集。'); return false; }
    return this.collectEntity(entity);
  }

  collectEntity(entity, { miningMultiplier = this.vehicle === 'whale' ? 1.5 : 1, energyCost = 2 } = {}) {
    if (!entity?.alive || entity.sampled || !this.isEntityVisible(entity)) return false;
    if (entity.caveId && (this.vehicle !== 'moth' || this.currentCave?.id !== entity.caveId)) return false;
    const species = entity.type === 'creature' ? speciesById[entity.speciesId] : null;
    const observation = species && this.isObservationTarget(entity);
    const weight = observation ? Math.max(1, Math.ceil(species.weight * 0.4)) : species?.weight ?? 1;
    if (this.cargoWeight + weight > this.stats.cargo) { this.emit('warning', '样本舱已满', '按 R 返航结算，或升级样本舱以增加负载。'); return false; }
    if (this.carrier) {
      const storedWeight = this.carrier.cargo.reduce((sum, item) => sum + (item.weight ?? 1) * (item.count ?? 1), 0);
      const carrierCapacity = VEHICLES.whale.cargo + this.upgrades.cargo * 8 + (this.researched.includes('elastic') ? 10 : 0);
      if (storedWeight + this.cargoWeight + weight > carrierCapacity) { this.emit('warning', '母舰仓储容量不足', '母舰与探索艇的总载重已达上限，请返航卸载。'); return false; }
    }
    if (this.battery < energyCost) { this.emit('warning', '采集电量不足', '按 R 返回港口补给。'); return false; }
    this.captureCooldown = species ? 0.45 : this.vehicle === 'whale' ? 0.2 : 0.85;
    this.battery = Math.max(0, this.battery - energyCost);
    entity.sampled = true;
    entity.alive = Boolean(observation);
    if (species) {
      const researchBonus = observation || entity.sampleCondition === 'pristine' ? entity.researchBonus ?? 0 : 0;
      const initialResearch = Math.max(1, Math.floor(species.research * 0.2)) + researchBonus;
      const sampleCondition = observation ? 'scanned' : entity.sampleCondition === 'pristine' ? 'pristine' : 'fresh';
      this.cargo.push({ speciesId: species.id, count: 1, weight, value: species.value, research: initialResearch, researchBonus, sampleCondition, fidelity: Boolean(observation), nonInvasive: Boolean(observation) });
      this.expedition.captures++;
      this.expedition.credits += species.value;
      this.expedition.research += initialResearch;
      this.totalCaptures++;
      this.captureCounts[species.id] = (this.captureCounts[species.id] ?? 0) + 1;
      const isNew = !this.discoveries.includes(species.id);
      if (isNew) this.discoveries.push(species.id);
      this.addXp(species.xp + (isNew ? 18 : 0));
      this.emit(isNew ? 'discovery' : 'capture', isNew ? `新发现 · ${species.name}` : `${observation ? '活体观测' : '采集成功'} · ${species.name}`, `+${species.value} 信用点 · +${initialResearch} 初检科研点。${observation ? '高完整度档案已记录，生物留在原栖地；可开启额外演化选择。' : '返航后可在科研中研究样本。'}`, { speciesId: species.id, entityId: entity.id, x: entity.x, y: entity.y, sampleCondition, nonInvasive: Boolean(observation) });
    } else {
      const amount = Math.ceil((entity.amount ?? 2) * miningMultiplier);
      this.cargo.push({ material: 'alloy', count: 1, weight: 1, amount });
      this.expedition.alloy += amount;
      this.totalAlloy += amount;
      this.addXp(16);
      this.emit('capture', '矿物采集成功', `+${amount} 合金（返航结算）`, { entityId: entity.id, x: entity.x, y: entity.y });
    }
    this.refreshMissions();
    this.save();
    return true;
  }

  scan() {
    if (this.docked || this.paused) return false;
    if (this.sonar.cooldown > 0) { this.emit('info', '声呐正在充能', `${Math.ceil(this.sonar.cooldown)} 秒后可再次使用。`); return false; }
    const cost = this.vehicle === 'ray' ? 4 : 8;
    if (this.battery < cost) { this.emit('warning', '声呐电量不足', '返回港口即可补充电量。'); return false; }
    this.battery -= cost;
    this.sonar.duration = (this.vehicle === 'ray' ? 8 : 4) + (this.bioModuleEffect.sonarDuration ?? 0);
    this.sonar.remaining = this.sonar.duration;
    this.sonar.radius = this.vehicle === 'ray' ? 1150 : 650;
    this.sonar.origin = { x: this.player.x, y: this.player.y };
    this.sonar.waveRadius = 0;
    this.sonar.cooldown = (this.researched.includes('echo') ? 6 : 12) * (this.bioModuleEffect.sonarCooldownMultiplier ?? 1);
    let found = 0;
    for (const entity of this.entities) {
      if (entity.alive && Math.hypot(entity.x - this.player.x, entity.y - this.player.y) <= this.sonar.radius) {
        entity.scannedUntil = this.elapsed + this.sonar.duration;
        found++;
      }
    }
    const contactRadius = this.vehicle === 'ray' ? 3000 : 2000;
    for (const hotspot of this.hotspots) {
      if (Math.hypot(hotspot.x - this.player.x, hotspot.y - this.player.y) <= contactRadius) this.detectedHotspots[hotspot.id] = this.elapsed + (this.vehicle === 'ray' ? 35 : 22);
    }
    const waypoint = this.contacts.find(contact => contact.y > this.player.y + 100) ?? this.contacts[0];
    this.emit('sonar', '声呐脉冲已释放', `附近探测到 ${found} 个生命与矿物信号。${waypoint ? `生态回波：${waypoint.name}，${Math.round(waypoint.y).toLocaleString()} 米。` : '这片水域十分安静，继续向深处探测。'}`);
    return true;
  }

  useAbility() {
    if (!this.activeAbility.ready) return false;
    const cost = { moth: 10, ray: 12, whale: 15 }[this.vehicle];
    if (this.battery < cost) { this.emit('warning', '专长电量不足', `需要 ${cost} 电量。`); return false; }
    if (this.vehicle === 'moth') {
      this.battery -= cost;
      this.dashRemaining = 2;
      this.abilityCooldowns.moth = 10;
      this.emit('ability', '窄域冲刺', '2 秒高机动推进。岩壁会阻挡冲刺，请沿洞喉进入。');
    } else if (this.vehicle === 'ray') {
      const candidates = this.entities.filter(entity => entity.alive && !entity.sampled && entity.type === 'creature' && !entity.caveId && (entity.surveyUntil ?? 0) <= this.elapsed && Math.hypot(entity.x - this.player.x, entity.y - this.player.y) <= 1150 && this.isEntityVisible(entity))
        .sort((a, b) => Number(this.discoveries.includes(a.speciesId)) - Number(this.discoveries.includes(b.speciesId)) || Math.hypot(a.x - this.player.x, a.y - this.player.y) - Math.hypot(b.x - this.player.x, b.y - this.player.y));
      const targets = [];
      const selectedSpecies = new Set();
      for (const entity of candidates) {
        if (selectedSpecies.has(entity.speciesId)) continue;
        targets.push(entity);
        selectedSpecies.add(entity.speciesId);
        if (targets.length === 5) break;
      }
      for (const entity of candidates) {
        if (targets.length === 5) break;
        if (!targets.includes(entity)) targets.push(entity);
      }
      if (!targets.length) { this.emit('info', '尚无可观测的活体目标', '先按 Q 声呐探测，再按 V 锁定；1150 米内的已探明活体可远距观测。已记录的个体本航次不会重复取样。'); return false; }
      this.battery -= cost;
      this.abilityCooldowns.ray = 12;
      for (const entity of targets) {
        entity.biologicalScan = true;
        entity.sampleCondition = 'scanned';
        entity.researchBonus = Math.ceil(speciesById[entity.speciesId].research * 0.65);
        entity.surveyUntil = this.elapsed + 18;
        entity.scannedUntil = Math.max(entity.scannedUntil ?? 0, entity.surveyUntil);
        if (!entity.ecologyRecorded) {
          const previous = this.observations[entity.speciesId];
          this.observations[entity.speciesId] = {
            count: (previous?.count ?? 0) + 1,
            firstDepth: previous?.firstDepth ?? Math.round(entity.y),
            lastDepth: Math.round(entity.y),
            behavior: speciesById[entity.speciesId].behavior ?? 'cruise',
          };
          entity.ecologyRecorded = true;
        }
      }
      this.emit('ability', '活体谱系已锁定', `${selectedSpecies.size} 种、${targets.length} 个活体已记录生态行为。18 秒内按 E 远距取得高完整度档案；无需追逐或带走生物。`, { observedSpecies: [...selectedSpecies], targets: targets.map(entity => entity.id) });
    } else {
      const targets = this.entities.filter(entity => entity.alive && entity.type === 'mineral' && !entity.caveId && entity.attachment && this.isEntityVisible(entity) && Math.hypot(entity.x - this.player.x, entity.y - this.player.y) <= 210)
        .sort((a, b) => Math.hypot(a.x - this.player.x, a.y - this.player.y) - Math.hypot(b.x - this.player.x, b.y - this.player.y)).slice(0, Math.min(3, Math.floor(this.stats.cargo - this.cargoWeight)));
      if (!targets.length) { this.emit('info', '请靠近岩壁矿脉', '重型钻机需要 210 米内可见的矿物，以及空余样本舱。'); return false; }
      this.battery -= cost;
      this.abilityCooldowns.whale = 14;
      const before = this.expedition.alloy;
      for (const entity of targets) this.collectEntity(entity, { miningMultiplier: 2.5, energyCost: 0 });
      this.emit('ability', '连锁破岩完成', `${targets.length} 处矿脉 · +${this.expedition.alloy - before} 合金。`);
    }
    this.save();
    return true;
  }

  discoverCave(cave) {
    if (!cave || this.caveDiscoveries.includes(cave.id)) return false;
    this.caveDiscoveries.push(cave.id);
    this.resources.credits += 120;
    this.addXp(75);
    this.emit('cave', `洞穴发现 · ${cave.name}`, '狭口后的安静世界。珍稀样本和岩层矿物就在洞穴内部。');
    if (cave.rewardSkin) this.unlockPaint(cave.rewardSkin);
    this.save();
    return true;
  }

  unlockPaint(id) {
    const paint = PAINTS.find(item => item.id === id);
    if (!paint || this.unlockedPaints.includes(id)) return false;
    this.unlockedPaints.push(id);
    this.emit('cosmetic', `新涂装 · ${paint.name}`, '已加入永久收藏，在载具工坊中可免费更换。');
    this.save();
    return true;
  }

  equipPaint(vehicleId, paintId) {
    if (!this.docked || !this.ownedVehicles.includes(vehicleId) || !this.unlockedPaints.includes(paintId) || !PAINTS.some(paint => paint.id === paintId)) return false;
    this.paintByVehicle[vehicleId] = paintId;
    this.emit('cosmetic', '涂装已更换', `${VEHICLES[vehicleId].name} · ${PAINTS.find(paint => paint.id === paintId).name}`);
    this.save();
    return true;
  }

  discoverWonder(wonder) {
    if (!wonder || wonder.discovered) return false;
    wonder.discovered = true;
    this.resources.credits += wonder.reward;
    this.resources.research += Math.round(wonder.reward / 4);
    this.addXp(80 + Math.round(wonder.y / 80));
    this.emit('wonder', `奇观发现 · ${wonder.name}`, wonder.description, { wonderId: wonder.id, reward: wonder.reward });
    this.save();
    return true;
  }

  addXp(amount) {
    this.xp += amount;
    while (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.level++;
      const credits = 45 + this.level * 10;
      this.resources.credits += credits;
      this.resources.alloy += 1;
      this.emit('level', `探索等级提升 · Lv.${this.level}`, `+${credits} 信用点 · +1 合金`, { level: this.level });
    }
  }

  returnToBase(emergency = false) {
    if (this.docked) return false;
    const allCargo = [...this.cargo, ...(this.carrier?.cargo ?? [])];
    this.settleSamples(allCargo);
    this.lastExpedition = { ...this.expedition, emergency, species: [...new Set(allCargo.filter(item => item.speciesId).map(item => item.speciesId))] };
    this.resources.credits += this.expedition.credits;
    this.resources.research += this.expedition.research;
    this.resources.alloy += this.expedition.alloy;
    if (this.carrier) this.vehicle = 'whale';
    this.carrier = null;
    this.dashRemaining = 0;
    this.cargo = [];
    this.docked = true;
    this.paused = false;
    this.boost = false;
    this.player.y = 35;
    this.player.x = 490;
    this.battery = this.stats.battery;
    this.hull = 100;
    this.sonar = { remaining: 0, cooldown: 0 };
    this.totalDives++;
    this.refreshMissions();
    this.emit('return', emergency ? '应急牵引完成' : '欢迎回港', `带回 ${this.lastExpedition.captures} 份生物样本 · ${this.lastExpedition.credits} 信用点 · ${this.lastExpedition.alloy} 合金。${emergency ? '所有样本安全回收。' : ''}`, { expedition: this.lastExpedition });
    this.save();
    return true;
  }

  settleSamples(cargo) {
    if (!Array.isArray(cargo)) return;
    for (const item of cargo) {
      if (!item || !speciesById[item.speciesId]) continue;
      const count = Number.isFinite(item.count) ? clamp(Math.floor(item.count), 0, 1000) : 1;
      this.sampleStock[item.speciesId] = (this.sampleStock[item.speciesId] ?? 0) + count;
      if (item.fidelity === true || item.sampleCondition === 'scanned') this.sampleFidelity[item.speciesId] = (this.sampleFidelity[item.speciesId] ?? 0) + count;
    }
  }

  launch() {
    if (!this.docked) return false;
    this.docked = false;
    this.paused = false;
    this.player = { x: 490, y: 100, facing: 1, heading: { x: 1, y: 0 } };
    this.battery = this.stats.battery;
    this.hull = 100;
    this.expedition = { captures: 0, alloy: 0, credits: 0, research: 0, startDepth: 100, deepest: 100, duration: 0 };
    this.sonar = { remaining: 0, cooldown: 0 };
    this.abilityCooldowns = { moth: 0, ray: 0, whale: 0 };
    this.dashRemaining = 0;
    this.detectedHotspots = {};
    this.previousZone = this.zone.id;
    this.captureCooldown = 0;
    this.warningCooldown = 0;
    this.spawnWorld();
    this.emit('launch', `${VEHICLES[this.vehicle].name}，出发`, `安全深度 ${this.stats.maxDepth.toLocaleString()} 米。向未知，再深一点。`);
    this.save();
    return true;
  }

  selectVehicle(id) {
    if (!VEHICLES[id] || !this.ownedVehicles.includes(id)) return false;
    if (!this.docked) { this.emit('info', '请先返回港口', '回港后可自由切换已经拥有的载具。'); return false; }
    this.vehicle = id;
    this.battery = this.stats.battery;
    this.emit('vehicle', `已选择${VEHICLES[id].name}`, VEHICLES[id].tag);
    this.save();
    return true;
  }

  canAfford(cost) { return Object.entries(cost).every(([resource, amount]) => (this.resources[resource] ?? 0) >= amount); }
  spend(cost) { for (const [resource, amount] of Object.entries(cost)) this.resources[resource] -= amount; }

  craftVehicle(id) {
    const vehicle = VEHICLES[id];
    if (!vehicle || this.ownedVehicles.includes(id)) return false;
    if (!this.docked) { this.emit('info', '建造需要港口船坞', '按 R 返回港口后建造新载具。'); return false; }
    if (!this.canAfford(vehicle.cost)) { this.emit('warning', '建造材料不足', `需要 ${vehicle.cost.credits} 信用点和 ${vehicle.cost.alloy} 合金。`); return false; }
    this.spend(vehicle.cost);
    this.ownedVehicles.push(id);
    this.vehicle = id;
    this.battery = this.stats.battery;
    this.addXp(100);
    this.emit('craft', `${vehicle.name}建造完成`, `${vehicle.tag}已经准备好，所有通用改装自动生效。`);
    this.save();
    return true;
  }

  upgrade(id) {
    const upgrade = UPGRADES.find(item => item.id === id);
    if (!upgrade || this.upgrades[id] >= upgrade.maxLevel) return false;
    if (!this.docked) { this.emit('info', '改装需要港口船坞', '按 R 返回港口后安装模块。'); return false; }
    const cost = this.getUpgradeCost(id);
    if (!this.canAfford(cost)) { this.emit('warning', '改装材料不足', `需要 ${cost.credits} 信用点和 ${cost.alloy} 合金。`); return false; }
    this.spend(cost);
    this.upgrades[id]++;
    this.battery = this.stats.battery;
    this.emit('upgrade', `${upgrade.name} Mk.${this.upgrades[id]}`, upgrade.description);
    this.save();
    return true;
  }

  research(id) {
    const gene = GENES.find(item => item.id === id);
    if (!gene || this.researched.includes(id)) return false;
    if (!this.discoveries.includes(gene.speciesId)) { this.emit('info', '尚未取得研究样本', `先采集一份${speciesById[gene.speciesId].name}。`); return false; }
    if (this.resources.research < gene.cost) { this.emit('warning', '科研点不足', `需要 ${gene.cost} 科研点。返回基地，在共鸣演化舱中培育模块可获得更多。`); return false; }
    this.resources.research -= gene.cost;
    this.researched.push(id);
    this.addXp(70);
    this.refreshMissions();
    this.emit('research', `基因适应 · ${gene.name}`, gene.effect);
    this.save();
    return true;
  }

  deploySub() {
    if (this.docked || this.paused) return false;
    if (this.carrier) {
      if (this.tetherDistance > 120 || !hasLineOfSight(this.player.x, this.player.y, this.carrier.x, this.carrier.y)) { this.emit('info', '请靠近母舰', `返回 ${Math.round(this.carrier.y).toLocaleString()} 米处的鲸落号，在通视的 120 米内重新接驳。`); return false; }
      const battery = this.carrier.battery + this.battery;
      this.cargo = [...this.carrier.cargo, ...this.cargo];
      this.player.x = this.carrier.x;
      this.player.y = this.carrier.y;
      this.vehicle = 'whale';
      this.carrier = null;
      this.battery = clamp(battery - 4, 0, this.stats.battery);
      this.emit('vehicle', '接驳完成', '样本已转入母舰；剩余电量回流，共消耗 4 电量完成接驳。');
    } else {
      if (this.vehicle !== 'whale') { this.emit('info', '需要鲸落号母舰', '建造鲸落号后，可以在深海释放萤蛾号探索艇。'); return false; }
      if (this.battery < 30) { this.emit('warning', '母舰电量不足', '请回港充电后再释放探索艇。'); return false; }
      const transferred = Math.min(VEHICLES.moth.battery + this.upgrades.battery * 65, Math.floor((this.battery - 8) * 0.4));
      this.carrier = { x: this.player.x, y: this.player.y, vehicle: 'whale', battery: this.battery - transferred - 8, cargo: this.cargo, tetherRange: 500 };
      this.cargo = [];
      this.vehicle = 'moth';
      this.battery = transferred;
      moveWithCollision(this.player, this.player.facing * 55, 0, 'moth');
      this.emit('vehicle', '萤蛾号已释放', `已从母舰转移 ${transferred} 电量。500 米内享有耐压保护；带回样本，在 120 米内按 F 接驳。`);
    }
    this.save();
    return true;
  }

  refreshMissions() {
    const depthTier = this.missionTiers.depth;
    const captureTier = this.missionTiers.capture;
    const researchTier = this.missionTiers.research;
    const depthTarget = depthMilestones[depthTier] ?? 10900;
    const captureTarget = captureMilestones[captureTier] ?? 100 + (captureTier - captureMilestones.length + 1) * 30;
    const researchTarget = Math.min(researchTier + 1, GENES.length);
    this.missions = [
      ...(depthTier < depthMilestones.length ? [{ id: 'depth', title: `向下，再深一点`, description: `抵达 ${depthTarget.toLocaleString()} 米深度`, progress: Math.min(this.maxDepth, depthTarget), target: depthTarget, reward: { credits: 110 + depthTier * 80, alloy: 3 + depthTier, research: 10 + depthTier * 5 }, claimed: false }] : []),
      { id: 'capture', title: captureTier === 0 ? '初次接触' : '海洋样本计划', description: `累计采集 ${captureTarget} 份生物样本`, progress: Math.min(this.totalCaptures, captureTarget), target: captureTarget, reward: { credits: 100 + captureTier * 55, alloy: 3 + captureTier, research: 20 + captureTier * 5 }, claimed: false },
      ...(researchTier < GENES.length ? [{ id: 'research', title: '向生命学习', description: `完成 ${researchTarget} 项基因研究`, progress: Math.min(this.researched.length, researchTarget), target: researchTarget, reward: { credits: 180 + researchTier * 70, alloy: 4 + researchTier, research: 15 }, claimed: false }] : []),
    ];
  }

  claimMission(id) {
    this.refreshMissions();
    const mission = this.missions.find(item => item.id === id);
    if (!mission || mission.progress < mission.target) return false;
    for (const [resource, amount] of Object.entries(mission.reward)) this.resources[resource] += amount;
    this.missionTiers[id]++;
    if (id === 'depth' && mission.target >= 5000) this.unlockPaint('abyss');
    this.addXp(50);
    this.emit('mission', `委托完成 · ${mission.title}`, `+${mission.reward.credits} 信用点 · +${mission.reward.alloy} 合金 · +${mission.reward.research} 科研点`);
    this.refreshMissions();
    this.save();
    return true;
  }

  get collectionReward() {
    const target = collectionMilestones[this.collectionTier];
    if (!target) return { target: SPECIES.length, claimed: true, available: false, credits: 0, research: 0, alloy: 0 };
    return { target, claimed: false, available: this.discoveries.length >= target, credits: 200 + this.collectionTier * 200, research: 35 + this.collectionTier * 30, alloy: 5 + this.collectionTier * 3 };
  }

  claimCollection() {
    const reward = this.collectionReward;
    if (!reward.available) return false;
    this.resources.credits += reward.credits;
    this.resources.research += reward.research;
    this.resources.alloy += reward.alloy;
    this.collectionTier++;
    this.addXp(90);
    this.emit('collection', `图鉴里程碑 · ${reward.target} 种发现`, `+${reward.credits} 信用点 · +${reward.research} 科研点 · +${reward.alloy} 合金`);
    this.save();
    return true;
  }

  togglePause() { this.paused = !this.paused; return this.paused; }

  save() {
    if (!this.storage) return false;
    const data = {
      version: 2, player: this.player, vehicle: this.vehicle, battery: this.battery, hull: this.hull,
      cargo: this.cargo, resources: this.resources, level: this.level, xp: this.xp, maxDepth: this.maxDepth,
      discoveries: this.discoveries, researched: this.researched, ownedVehicles: this.ownedVehicles,
      upgrades: this.upgrades, docked: this.docked, expedition: this.expedition, lastExpedition: this.lastExpedition,
      totalCaptures: this.totalCaptures, totalDives: this.totalDives, totalAlloy: this.totalAlloy,
      captureCounts: this.captureCounts, collectionTier: this.collectionTier, missionTiers: this.missionTiers,
      wonderIds: this.wonders.filter(wonder => wonder.discovered).map(wonder => wonder.id), carrier: this.carrier,
      sampleStock: this.sampleStock, sampleFidelity: this.sampleFidelity, observations: this.observations,
      bioModules: this.bioModules, equippedBioModule: this.equippedBioModule,
      labState: this.labState, labProcessed: this.labProcessed,
      labRuns: this.labRuns, labBestCombo: this.labBestCombo, caveDiscoveries: this.caveDiscoveries,
      unlockedPaints: this.unlockedPaints, paintByVehicle: this.paintByVehicle,
    };
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(data)); return true; }
    catch {
      if (!this.saveErrorReported) { this.saveErrorReported = true; this.emit('warning', '暂时无法自动保存', '浏览器存储空间或隐私设置阻止了保存，本次游玩可继续。'); }
      return false;
    }
  }

  load() {
    if (!this.storage) return false;
    try {
      const data = JSON.parse(this.storage.getItem(SAVE_KEY));
      if (!data || ![1, 2].includes(data.version) || !VEHICLES[data.vehicle] || !data.resources) return false;
      const finite = (value, fallback, min = 0, max = 1e9) => typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
      const ids = (values, allowed) => Array.isArray(values) ? [...new Set(values.filter(value => allowed.includes(value)))] : [];
      this.ownedVehicles = ids(data.ownedVehicles, Object.keys(VEHICLES));
      if (!this.ownedVehicles.includes('moth')) this.ownedVehicles.unshift('moth');
      this.vehicle = this.ownedVehicles.includes(data.vehicle) ? data.vehicle : 'moth';
      for (const resource of ['credits', 'research', 'alloy']) this.resources[resource] = finite(data.resources[resource], this.resources[resource]);
      for (const upgrade of UPGRADES) this.upgrades[upgrade.id] = Math.floor(finite(data.upgrades?.[upgrade.id], 0, 0, upgrade.maxLevel));
      this.discoveries = ids(data.discoveries, SPECIES.map(species => species.id));
      this.researched = ids(data.researched, GENES.map(gene => gene.id));
      this.level = Math.floor(finite(data.level, 1, 1, 10000));
      this.xp = finite(data.xp, 0);
      this.maxDepth = finite(data.maxDepth, 100, 0, 11000);
      this.totalCaptures = Math.floor(finite(data.totalCaptures, 0));
      this.totalDives = Math.floor(finite(data.totalDives, 0));
      this.totalAlloy = Math.floor(finite(data.totalAlloy, 0));
      this.collectionTier = Math.floor(finite(data.collectionTier, 0, 0, collectionMilestones.length));
      for (const id of ['depth', 'capture', 'research']) this.missionTiers[id] = Math.floor(finite(data.missionTiers?.[id], 0, 0, id === 'depth' ? depthMilestones.length : id === 'research' ? GENES.length : 10000));
      this.captureCounts = {};
      for (const species of SPECIES) this.captureCounts[species.id] = Math.floor(finite(data.captureCounts?.[species.id], 0));
      this.sampleStock = {};
      this.sampleFidelity = {};
      this.observations = {};
      for (const species of SPECIES) {
        const count = Math.floor(finite(data.sampleStock?.[species.id], 0, 0, 100000));
        if (count) this.sampleStock[species.id] = count;
        const fidelity = Math.floor(finite(data.sampleFidelity?.[species.id], 0, 0, count));
        if (fidelity) this.sampleFidelity[species.id] = fidelity;
        const observation = data.observations?.[species.id];
        if (observation && typeof observation === 'object' && finite(observation.count, 0) > 0) {
          this.observations[species.id] = {
            count: Math.floor(finite(observation.count, 0, 0, 100000)),
            firstDepth: finite(observation.firstDepth, 0, 0, 11000),
            lastDepth: finite(observation.lastDepth, 0, 0, 11000),
            behavior: species.behavior ?? 'cruise',
          };
        }
      }
      this.bioModules = {};
      for (const module of BIO_MODULES) {
        const level = Math.floor(finite(data.bioModules?.[module.id], 0, 0, 3));
        if (level) this.bioModules[module.id] = level;
      }
      this.equippedBioModule = this.bioModules[data.equippedBioModule] > 0 ? data.equippedBioModule : null;
      this.labState = data.labState && typeof data.labState === 'object' && !Array.isArray(data.labState) ? JSON.parse(JSON.stringify(data.labState)) : null;
      this.labProcessed = Math.floor(finite(data.labProcessed, 0));
      this.labRuns = Math.floor(finite(data.labRuns, 0));
      this.labBestCombo = Math.floor(finite(data.labBestCombo, 0));
      this.caveDiscoveries = ids(data.caveDiscoveries, CAVES.map(cave => cave.id));
      this.unlockedPaints = ids(data.unlockedPaints, PAINTS.map(paint => paint.id));
      if (!this.unlockedPaints.includes('classic')) this.unlockedPaints.unshift('classic');
      // Reconstruct earned cosmetics for older saves without removing progression.
      if (this.labProcessed >= 10 && !this.unlockedPaints.includes('aurora')) this.unlockedPaints.push('aurora');
      if (this.missionTiers.depth >= 5 && !this.unlockedPaints.includes('abyss')) this.unlockedPaints.push('abyss');
      if (this.caveDiscoveries.includes('coral_hollow') && !this.unlockedPaints.includes('coral')) this.unlockedPaints.push('coral');
      for (const vehicleId of Object.keys(VEHICLES)) this.paintByVehicle[vehicleId] = this.unlockedPaints.includes(data.paintByVehicle?.[vehicleId]) ? data.paintByVehicle[vehicleId] : 'classic';
      const foundWonders = ids(data.wonderIds, WONDERS.map(wonder => wonder.id));
      this.wonders = WONDERS.map(wonder => ({ ...wonder, discovered: foundWonders.includes(wonder.id) }));
      // Reload resumes at a fully supplied port and safely settles the saved dive.
      // This avoids duplicated world pickups and never loses an expedition on refresh.
      const wasDiving = data.docked === false;
      if (wasDiving) {
        for (const key of ['credits', 'research', 'alloy']) this.resources[key] += finite(data.expedition?.[key], 0);
        this.settleSamples(data.cargo);
        this.settleSamples(data.carrier?.cargo);
        this.totalDives++;
      }
      this.lastExpedition = wasDiving ? { captures: finite(data.expedition?.captures, 0), credits: finite(data.expedition?.credits, 0), research: finite(data.expedition?.research, 0), alloy: finite(data.expedition?.alloy, 0), deepest: finite(data.expedition?.deepest, 100), duration: finite(data.expedition?.duration, 0), emergency: false, resumed: true, species: [] } : data.lastExpedition ?? null;
      if (data.carrier && this.ownedVehicles.includes('whale')) this.vehicle = 'whale';
      this.carrier = null;
      this.cargo = [];
      this.expedition = { captures: 0, alloy: 0, credits: 0, research: 0, startDepth: 100, deepest: 100, duration: 0 };
      this.player = { x: 490, y: 35, facing: 1, heading: { x: 1, y: 0 } };
      this.docked = true;
      this.battery = this.stats.battery;
      this.hull = 100;
      this.previousZone = this.zone.id;
      this.refreshMissions();
      this.save();
      return true;
    } catch { return false; }
  }

  reset() {
    try { this.storage?.removeItem(SAVE_KEY); } catch { /* Gameplay remains available without storage. */ }
    this.initialize();
    this.elapsed = 0;
    this.captureCooldown = 0;
    this.warningCooldown = 0;
    this.spawnWorld();
    this.save();
    this.emit('reset', '新的航程', '所有系统就绪。海洋正等待你的第一次发现。');
  }
}
