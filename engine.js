import { ZONES, SPECIES, VEHICLES, GENES, UPGRADES, WONDERS } from './data.js';

const SAVE_KEY = 'dive-into-wonder-v1';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const speciesById = Object.fromEntries(SPECIES.map(species => [species.id, species]));
const depthMilestones = [350, 900, 1800, 3500, 5000, 7500, 10500];
const captureMilestones = [3, 8, 16, 28, 45, 70, 100];
const collectionMilestones = [3, 6, 10, 14, 18];

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
    this.player = { x: 490, y: 100, facing: 1 };
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
    const mothership = this.carrier ? VEHICLES.whale : vehicle;
    return {
      maxDepth: mothership.maxDepth + this.upgrades.hull * 900,
      battery: vehicle.battery + this.upgrades.battery * 65,
      cargo: mothership.cargo + this.upgrades.cargo * 8 + (this.researched.includes('elastic') ? 10 : 0),
      speed: vehicle.speed * (1 + this.upgrades.thruster * 0.15) * (this.researched.includes('streamline') ? 1.15 : 1),
      vision: vehicle.vision * (this.researched.includes('lumen') ? 1.3 : 1),
      captureRange: vehicle.captureRange * (this.researched.includes('echo') ? 1.25 : 1),
    };
  }

  get cargoWeight() { return this.cargo.reduce((sum, item) => sum + (item.weight ?? 1) * (item.count ?? 1), 0); }
  get zone() { return ZONES.find(zone => this.player.y < zone.max) ?? ZONES[ZONES.length - 1]; }
  get xpToNextLevel() { return 60 + (this.level - 1) * 35; }
  get batteryPercent() { return clamp(this.battery / this.stats.battery * 100, 0, 100); }
  get deployed() { return Boolean(this.carrier); }
  get nearestTarget() {
    let nearest = null;
    let best = this.stats.captureRange;
    for (const entity of this.entities) {
      if (!entity.alive) continue;
      const distance = Math.hypot(entity.x - this.player.x, entity.y - this.player.y);
      if (distance < best) { nearest = entity; best = distance; }
    }
    return nearest;
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

  spawnWorld() {
    this.entities = [];
    let seed = 37 + this.totalDives * 103;
    for (const [zoneIndex, zone] of ZONES.entries()) {
      const species = SPECIES.filter(item => item.zone === zone.id);
      const count = zoneIndex === 0 ? 12 : Math.ceil((zone.max - zone.min) / 55);
      for (let i = 0; i < count; i++) {
        const creature = species[i % species.length];
        const y = zone.min + 30 + this.random(seed++) * (zone.max - zone.min - 55);
        const x = 135 + this.random(seed++) * 730;
        this.entities.push({ id: `e${this.entitySequence++}`, type: 'creature', speciesId: creature.id, x, y, originX: x, originY: y, phase: this.random(seed++) * Math.PI * 2, alive: true, size: creature.size, color: creature.color });
      }
      const mineralCount = zoneIndex === 0 ? 7 : Math.ceil((zone.max - zone.min) / 120);
      for (let i = 0; i < mineralCount; i++) {
        const x = 160 + this.random(seed++) * 680;
        const y = zone.min + 35 + this.random(seed++) * (zone.max - zone.min - 60);
        this.entities.push({ id: `e${this.entitySequence++}`, type: 'mineral', material: 'alloy', x, y, originX: x, originY: y, alive: true, amount: zoneIndex + 2, size: 13 });
      }
    }
    // An immediately readable first dive: each core interaction is within reach.
    for (const [speciesId, x, y] of [['glassfish', 550, 105], ['emberfin', 410, 165], ['moonjelly', 600, 190], ['ribbon_eel', 500, 275], ['lanternfish', 620, 380]]) {
      const species = speciesById[speciesId];
      this.entities.push({ id: `e${this.entitySequence++}`, type: 'creature', speciesId, x, y, originX: x, originY: y, phase: 0, alive: true, size: species.size, color: species.color });
    }
    this.entities.push({ id: `e${this.entitySequence++}`, type: 'mineral', material: 'alloy', x: 450, y: 245, originX: 450, originY: 245, alive: true, amount: 3, size: 13 });
  }

  update(dt, input = {}) {
    const delta = clamp(Number(dt) || 0, 0, 0.1);
    if (!delta || this.paused) return;
    this.elapsed += delta;
    if (this.docked) return;
    this.expedition.duration += delta;
    this.captureCooldown = Math.max(0, this.captureCooldown - delta);
    this.warningCooldown = Math.max(0, this.warningCooldown - delta);
    this.sonar.remaining = Math.max(0, this.sonar.remaining - delta);
    this.sonar.cooldown = Math.max(0, this.sonar.cooldown - delta);
    const stats = this.stats;
    const x = clamp(Number(input.x) || 0, -1, 1);
    const y = clamp(Number(input.y) || 0, -1, 1);
    const length = Math.hypot(x, y) || 1;
    const moving = x !== 0 || y !== 0;
    this.boost = Boolean(input.boost && moving && this.battery > 3);
    const speed = stats.speed * (this.boost ? 1.8 : 1);
    this.player.x = clamp(this.player.x + x / Math.max(1, length) * speed * delta, 85, 915);
    this.player.y = clamp(this.player.y + y / Math.max(1, length) * speed * delta, 12, 10980);
    if (x !== 0) this.player.facing = x > 0 ? 1 : -1;
    this.maxDepth = Math.max(this.maxDepth, Math.floor(this.player.y));
    this.expedition.deepest = Math.max(this.expedition.deepest, Math.floor(this.player.y));
    const pressure = Math.max(0, (this.player.y - stats.maxDepth) / 700);
    const consumption = (moving ? 0.85 : 0.28) * (this.researched.includes('metabolism') ? 0.75 : 1) + (this.boost ? 1.4 : 0) + pressure * 0.9;
    this.battery = Math.max(0, this.battery - consumption * delta);
    this.hull = clamp(this.hull - pressure * 5 * delta + (!pressure && this.researched.includes('repair') ? delta : 0), 0, 100);
    if (pressure > 0 && this.warningCooldown <= 0) {
      this.emit('warning', '超过安全深度', `当前艇壳额定 ${stats.maxDepth.toLocaleString()} 米。请上浮或返回港口升级。`);
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
      entity.x = entity.originX + Math.sin(this.elapsed * 0.42 + entity.phase) * 27;
      entity.y = entity.originY + Math.cos(this.elapsed * 0.3 + entity.phase) * 9;
      entity.facing = Math.cos(this.elapsed * 0.42 + entity.phase) > 0 ? 1 : -1;
    }
    for (const wonder of this.wonders) {
      if (!wonder.discovered && Math.hypot(wonder.x - this.player.x, wonder.y - this.player.y) < stats.vision + (this.sonar.remaining > 0 ? 180 : 0)) this.discoverWonder(wonder);
    }
    this.refreshMissions();
    this.autosaveTimer += delta;
    if (this.autosaveTimer >= 12) { this.autosaveTimer = 0; this.save(); }
    if (this.battery <= 0 || this.hull <= 0) this.returnToBase(true);
  }

  capture() {
    if (this.docked || this.paused || this.captureCooldown > 0) return false;
    const entity = this.nearestTarget;
    if (!entity) { this.emit('info', '靠近一点', '将载具开到生物或矿物附近，再按 E 采集。'); return false; }
    const species = entity.type === 'creature' ? speciesById[entity.speciesId] : null;
    const weight = species?.weight ?? 1;
    if (this.cargoWeight + weight > this.stats.cargo) { this.emit('warning', '样本舱已满', '按 R 返航结算，或升级样本舱以增加负载。'); return false; }
    if (this.battery < 2) { this.emit('warning', '采集电量不足', '按 R 返回港口补给。'); return false; }
    this.captureCooldown = 0.45;
    this.battery = Math.max(0, this.battery - 2);
    entity.alive = false;
    if (species) {
      this.cargo.push({ speciesId: species.id, count: 1, weight, value: species.value, research: species.research });
      this.expedition.captures++;
      this.expedition.credits += species.value;
      this.expedition.research += species.research;
      this.totalCaptures++;
      this.captureCounts[species.id] = (this.captureCounts[species.id] ?? 0) + 1;
      const isNew = !this.discoveries.includes(species.id);
      if (isNew) this.discoveries.push(species.id);
      this.addXp(species.xp + (isNew ? 18 : 0));
      this.emit(isNew ? 'discovery' : 'capture', isNew ? `新发现 · ${species.name}` : `采集成功 · ${species.name}`, `+${species.value} 信用点 · +${species.research} 科研点（返航结算）`, { speciesId: species.id, entityId: entity.id, x: entity.x, y: entity.y });
    } else {
      const amount = entity.amount ?? 2;
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
    this.sonar.remaining = 4;
    this.sonar.cooldown = this.researched.includes('echo') ? 6 : 12;
    const found = this.entities.filter(entity => entity.alive && Math.hypot(entity.x - this.player.x, entity.y - this.player.y) < 650).length;
    this.emit('sonar', '声呐脉冲已释放', `附近探测到 ${found} 个生命与矿物信号。`);
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
    this.lastExpedition = { ...this.expedition, emergency, species: [...new Set(this.cargo.filter(item => item.speciesId).map(item => item.speciesId))] };
    this.resources.credits += this.expedition.credits;
    this.resources.research += this.expedition.research;
    this.resources.alloy += this.expedition.alloy;
    if (this.carrier) this.vehicle = 'whale';
    this.carrier = null;
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

  launch() {
    if (!this.docked) return false;
    this.docked = false;
    this.paused = false;
    this.player = { x: 490, y: 100, facing: 1 };
    this.battery = this.stats.battery;
    this.hull = 100;
    this.expedition = { captures: 0, alloy: 0, credits: 0, research: 0, startDepth: 100, deepest: 100, duration: 0 };
    this.sonar = { remaining: 0, cooldown: 0 };
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
    if (this.resources.research < gene.cost) { this.emit('warning', '科研点不足', `需要 ${gene.cost} 科研点，返航即可结算本次科研收获。`); return false; }
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
      if (Math.hypot(this.player.x - this.carrier.x, this.player.y - this.carrier.y) > 320) { this.emit('info', '请靠近母舰', `返回 ${Math.round(this.carrier.y).toLocaleString()} 米处的鲸落号，320 米内可重新接驳。`); return false; }
      const battery = this.carrier.battery;
      this.player.x = this.carrier.x;
      this.player.y = this.carrier.y;
      this.vehicle = 'whale';
      this.carrier = null;
      this.battery = Math.max(0, battery - 8);
      this.emit('vehicle', '接驳完成', '欢迎回到鲸落号，样本舱已同步。');
    } else {
      if (this.vehicle !== 'whale') { this.emit('info', '需要鲸落号母舰', '建造鲸落号后，可以在深海释放萤蛾号探索艇。'); return false; }
      if (this.battery < 18) { this.emit('warning', '母舰电量不足', '请回港充电后再释放探索艇。'); return false; }
      this.carrier = { x: this.player.x, y: this.player.y, vehicle: 'whale', battery: this.battery - 10 };
      this.vehicle = 'moth';
      this.battery = this.stats.battery;
      this.player.x = clamp(this.player.x + 80, 85, 915);
      this.emit('vehicle', '萤蛾号已释放', '共享母舰耐压保护与样本舱。靠近母舰后按 F 接驳。');
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
      version: 1, player: this.player, vehicle: this.vehicle, battery: this.battery, hull: this.hull,
      cargo: this.cargo, resources: this.resources, level: this.level, xp: this.xp, maxDepth: this.maxDepth,
      discoveries: this.discoveries, researched: this.researched, ownedVehicles: this.ownedVehicles,
      upgrades: this.upgrades, docked: this.docked, expedition: this.expedition, lastExpedition: this.lastExpedition,
      totalCaptures: this.totalCaptures, totalDives: this.totalDives, totalAlloy: this.totalAlloy,
      captureCounts: this.captureCounts, collectionTier: this.collectionTier, missionTiers: this.missionTiers,
      wonderIds: this.wonders.filter(wonder => wonder.discovered).map(wonder => wonder.id), carrier: this.carrier,
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
      if (!data || data.version !== 1 || !VEHICLES[data.vehicle] || !data.resources) return false;
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
      const foundWonders = ids(data.wonderIds, WONDERS.map(wonder => wonder.id));
      this.wonders = WONDERS.map(wonder => ({ ...wonder, discovered: foundWonders.includes(wonder.id) }));
      // Reload resumes at a fully supplied port and safely settles the saved dive.
      // This avoids duplicated world pickups and never loses an expedition on refresh.
      const wasDiving = data.docked === false;
      if (wasDiving) {
        for (const key of ['credits', 'research', 'alloy']) this.resources[key] += finite(data.expedition?.[key], 0);
        this.totalDives++;
      }
      this.lastExpedition = wasDiving ? { captures: finite(data.expedition?.captures, 0), credits: finite(data.expedition?.credits, 0), research: finite(data.expedition?.research, 0), alloy: finite(data.expedition?.alloy, 0), deepest: finite(data.expedition?.deepest, 100), duration: finite(data.expedition?.duration, 0), emergency: false, resumed: true, species: [] } : data.lastExpedition ?? null;
      if (data.carrier && this.ownedVehicles.includes('whale')) this.vehicle = 'whale';
      this.carrier = null;
      this.cargo = [];
      this.expedition = { captures: 0, alloy: 0, credits: 0, research: 0, startDepth: 100, deepest: 100, duration: 0 };
      this.player = { x: 490, y: 35, facing: 1 };
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
