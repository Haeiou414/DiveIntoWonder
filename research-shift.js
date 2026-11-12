import { SPECIES } from './data.js';
import { BIO_MODULES } from './bio-modules.js';

export const BOARD_SIZE = 5;
export const CORE_CELL = 12;
// Tier I needs any charge; later tiers reward a working circuit and a stronger lineage.
export const MODULE_THRESHOLDS = Object.freeze([0, 13, 90]);
export const TERMINALS = [
  { cell: 0, module: 'lumen', label: '光感' },
  { cell: 4, module: 'flow', label: '推进' },
  { cell: 20, module: 'shell', label: '耐压' },
  { cell: 14, module: 'echo', label: '感知' },
  { cell: 24, module: 'repair', label: '再生' },
];
export const DIRECTIONS = [
  { bit: 1, opposite: 4, x: 0, y: -1 },
  { bit: 2, opposite: 8, x: 1, y: 0 },
  { bit: 4, opposite: 1, x: 0, y: 1 },
  { bit: 8, opposite: 2, x: -1, y: 0 },
];
export const MUTATIONS = [
  { id: 'amplify', name: '线粒体爆发', glyph: '✦', description: '之后每次脉冲的初始能量 +6。', color: '#efbc76' },
  { id: 'insulate', name: '超导髓鞘', glyph: '⌁', description: '回路每经过一格的损耗降至 0.15。', color: '#9cd7e9' },
  { id: 'branch', name: '分形共生', glyph: '⑂', description: '分叉后的能量衰减减轻，适合同时培育多种器官。', color: '#b8dda0' },
  { id: 'memory', name: '遗传回响', glyph: '◎', description: '当前器官中积累的能量立即增加 50%。', color: '#cbb0ef' },
  { id: 'adapt', name: '定向适应', glyph: '◇', description: '样本对应器官每次接收脉冲时额外获得 3 能量。', color: '#f0a8b7' },
];
const speciesById = new Map(SPECIES.map(species => [species.id, species]));
const terminalByCell = new Map(TERMINALS.map(terminal => [terminal.cell, terminal]));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mutationOptions = (state, fidelityCount) => {
  const start = (state.sequence + state.pulse) % MUTATIONS.length;
  return Array.from({ length: MUTATIONS.length }, (_, offset) => MUTATIONS[(start + offset) % MUTATIONS.length].id)
    .filter(id => !state.mutations.includes(id))
    .slice(0, fidelityCount ? 4 : 3);
};
const freshState = () => ({
  version: 2, status: 'idle', specimens: [], board: [], initialBoard: [],
  pulse: 0, charges: {}, mutations: [], offered: [], history: [],
  lastPulse: null, result: null, sequence: 0,
  lastMessage: '选择一份样本，唤醒它的生命回路。',
});

export function rotateMask(mask, turns = 1) {
  let result = mask;
  for (let step = 0; step < ((turns % 4) + 4) % 4; step++) result = ((result << 1) & 15) | (result >> 3);
  return result;
}

export function makeBoard(seed = 0) {
  const masks = Array.from({ length: 25 }, (_, cell) => [3, 5, 7][(cell + seed) % 3]);
  // A solvable branching anatomy, scrambled for every sample and experiment.
  const paths = [[12, 7, 6, 1, 0], [12, 7, 8, 3, 4], [12, 17, 16, 21, 20], [12, 17, 18, 23, 24], [12, 13, 14]];
  const connected = new Map();
  for (const path of paths) {
    for (let step = 0; step < path.length - 1; step++) {
      const from = path[step], to = path[step + 1];
      const direction = to === from - 5 ? DIRECTIONS[0] : to === from + 1 ? DIRECTIONS[1] : to === from + 5 ? DIRECTIONS[2] : DIRECTIONS[3];
      connected.set(from, (connected.get(from) || 0) | direction.bit);
      connected.set(to, (connected.get(to) || 0) | direction.opposite);
    }
  }
  for (const [cell, mask] of connected) masks[cell] = mask;
  return masks.map((mask, cell) => cell === CORE_CELL || terminalByCell.has(cell) ? 15 : rotateMask(mask, (seed * 7 + cell * 3 + Math.floor(cell / 5)) % 4));
}

export class ResearchChamber {
  constructor(game) {
    this.game = game;
    this.onChange = null;
    this.paused = false;
    this.ensureState();
  }

  ensureState() {
    this.game.sampleStock ??= {};
    this.game.sampleFidelity ??= {};
    this.game.labProcessed ??= 0;
    this.game.labRuns ??= 0;
    const old = this.game.labState;
    // Refund unfinished v1.1 work before replacing the timed workstation save.
    if (old?.version === 1 && old.status === 'running') {
      for (const job of Object.values(old.stations || {})) {
        if (speciesById.has(job?.speciesId)) this.returnSpecimen({ speciesId: job.speciesId, fidelity: false });
      }
    }
    if (old?.version !== 2 || !['idle', 'building', 'mutation', 'complete'].includes(old.status)) {
      this.game.labState = freshState();
      this.game.save();
      return;
    }
    const state = { ...freshState(), ...old };
    state.specimens = (Array.isArray(old.specimens) ? old.specimens : []).filter(sample => speciesById.has(sample?.speciesId)).slice(0, 3);
    state.pulse = clamp(Math.floor(Number(old.pulse) || 0), 0, 3);
    state.sequence = Math.max(0, Math.floor(Number(old.sequence) || 0));
    state.charges = Object.fromEntries(BIO_MODULES.map(module => [module.id, clamp(Number(old.charges?.[module.id]) || 0, 0, 999)]));
    state.mutations = [...new Set((Array.isArray(old.mutations) ? old.mutations : []).filter(id => MUTATIONS.some(mutation => mutation.id === id)))].slice(0, 2);
    state.offered = state.status === 'mutation' ? mutationOptions(state, state.specimens.filter(sample => sample.fidelity).length) : [];
    const validBoard = board => Array.isArray(board) && board.length === 25 && board.every(mask => Number.isInteger(mask) && mask > 0 && mask <= 15);
    if (!validBoard(state.board) && state.specimens.length) {
      for (const specimen of state.specimens) this.returnSpecimen(specimen);
      this.game.labState = freshState();
    } else {
      state.history = [];
      if (!validBoard(state.initialBoard)) state.initialBoard = [...state.board];
      this.game.labState = state;
    }
    this.game.save();
  }

  get state() { return this.game.labState; }
  get active() { return ['building', 'mutation'].includes(this.state.status); }
  get canAct() { return this.game.docked && this.active && !this.paused; }
  get inventory() { return SPECIES.filter(species => (this.game.sampleStock[species.id] || 0) > 0); }
  get availableSamples() { return this.inventory.reduce((sum, species) => sum + this.game.sampleStock[species.id], 0); }
  get fidelityCount() { return this.state.specimens.filter(sample => sample.fidelity).length; }
  get traits() { return [...new Set(this.state.specimens.flatMap(sample => speciesById.get(sample.speciesId)?.traits || ['flow']))]; }
  get diversity() { return new Set(this.state.specimens.map(sample => speciesById.get(sample.speciesId)?.taxonomy?.phylum || '未知')).size; }
  get energy() {
    return 16 + Math.max(0, this.state.specimens.length - 1) * 4 + this.fidelityCount * 5
      + Math.max(0, this.diversity - 1) * 3 + (this.state.mutations.includes('amplify') ? 6 : 0);
  }

  change(message, sound = 'click') {
    if (message) this.state.lastMessage = message;
    this.game.save();
    this.onChange?.({ message, sound });
  }

  takeSpecimen(speciesId) {
    if (!(this.game.sampleStock[speciesId] > 0) || !speciesById.has(speciesId)) return null;
    const fidelity = (this.game.sampleFidelity[speciesId] || 0) > 0;
    this.game.sampleStock[speciesId]--;
    if (fidelity) this.game.sampleFidelity[speciesId]--;
    return { speciesId, fidelity };
  }

  returnSpecimen(sample) {
    this.game.sampleStock[sample.speciesId] = (this.game.sampleStock[sample.speciesId] || 0) + 1;
    if (sample.fidelity) this.game.sampleFidelity[sample.speciesId] = (this.game.sampleFidelity[sample.speciesId] || 0) + 1;
  }

  start(speciesId) {
    if (!this.game.docked || this.active || this.paused) return false;
    const specimen = this.takeSpecimen(speciesId);
    if (!specimen) return false;
    const sequence = this.state.sequence + 1;
    const board = makeBoard(SPECIES.findIndex(species => species.id === speciesId) + sequence);
    this.game.labState = { ...freshState(), status: 'building', specimens: [specimen], board, initialBoard: [...board], sequence };
    this.change('旋转回路，把中心胚核接到外侧器官。先看能量预演，再决定向哪里演化。', 'launch');
    return true;
  }

  addDonor(speciesId) {
    if (!this.canAct || this.state.pulse > 0 || this.state.specimens.length >= 3 || this.state.status !== 'building') return false;
    const specimen = this.takeSpecimen(speciesId);
    if (!specimen) return false;
    this.state.specimens.push(specimen);
    this.change('新样本加入共生。不同动物门提供额外能量，完整样本增加突变选择。', 'capture');
    return true;
  }

  rotate(cell, turns = 1) {
    if (!this.canAct || this.state.status !== 'building' || !Number.isInteger(cell) || cell < 0 || cell >= 25 || cell === CORE_CELL || terminalByCell.has(cell) || this.state.pulse >= 3) return false;
    this.state.history.push([...this.state.board]);
    if (this.state.history.length > 40) this.state.history.shift();
    this.state.board[cell] = rotateMask(this.state.board[cell], turns);
    this.change('回路已调整。亮起的通路会传递下一次脉冲。', '');
    return true;
  }

  undo() {
    if (!this.canAct || this.state.status !== 'building' || !this.state.history.length || this.state.pulse >= 3) return false;
    this.state.board = this.state.history.pop();
    this.change('已撤回上一次旋转。', '');
    return true;
  }

  simulate() {
    const reached = new Set([CORE_CELL]), queue = [{ cell: CORE_CELL, energy: this.energy }];
    const edges = [], targets = {}, cells = { [CORE_CELL]: this.energy };
    if (!this.state.board.length) return { edges, targets, cells, total: 0 };
    const loss = this.state.mutations.includes('insulate') ? .15 : .35;
    while (queue.length) {
      const { cell, energy } = queue.shift();
      const terminal = terminalByCell.get(cell);
      if (terminal) {
        const affinity = this.traits.includes(terminal.module) ? 1.5 + (this.state.mutations.includes('adapt') ? 3 : 0) : 0;
        targets[terminal.module] = Math.round((energy + affinity) * 10) / 10;
        continue;
      }
      const neighbors = DIRECTIONS.flatMap(direction => {
        const x = cell % 5 + direction.x, y = Math.floor(cell / 5) + direction.y;
        const next = y * 5 + x;
        if (x < 0 || x >= 5 || y < 0 || y >= 5 || reached.has(next)) return [];
        return (this.state.board[cell] & direction.bit) && (this.state.board[next] & direction.opposite) ? [next] : [];
      });
      const divisor = this.state.mutations.includes('branch') ? Math.pow(neighbors.length, .65) : neighbors.length;
      const transmitted = energy / (divisor || 1) - loss;
      if (transmitted <= .1) continue;
      for (const next of neighbors) {
        reached.add(next);
        cells[next] = transmitted;
        edges.push([cell, next]);
        queue.push({ cell: next, energy: transmitted });
      }
    }
    return { edges, targets, cells, total: Object.values(targets).reduce((sum, value) => sum + value, 0) };
  }

  releasePulse() {
    if (!this.canAct || this.state.status !== 'building' || this.state.pulse >= 3) return false;
    const result = this.simulate();
    if (!Object.keys(result.targets).length) {
      this.change('脉冲尚未接通器官。继续旋转回路，预演中至少一个器官亮起后即可释放。', 'warning');
      return false;
    }
    this.state.lastPulse = result;
    this.state.pulse++;
    this.state.history = [];
    for (const [id, value] of Object.entries(result.targets)) this.state.charges[id] = (this.state.charges[id] || 0) + value;
    if (this.state.pulse < 3) {
      this.state.offered = mutationOptions(this.state, this.fidelityCount);
      this.state.status = 'mutation';
      this.change('新的突变正在形成。选择一个方向，之后仍可重新布置回路。', 'level');
    } else {
      this.change('三次共振完成。选择一个已充能的器官，将它培育成下一次下潜的生物模块。', 'upgrade');
    }
    return true;
  }

  chooseMutation(id) {
    if (!this.canAct || this.state.status !== 'mutation' || !this.state.offered.includes(id) || this.state.mutations.includes(id)) return false;
    this.state.mutations.push(id);
    if (id === 'memory') for (const key of Object.keys(this.state.charges)) this.state.charges[key] *= 1.5;
    this.state.offered = [];
    this.state.status = 'building';
    this.change(MUTATIONS.find(mutation => mutation.id === id).name + '已生效。重新分配回路，或沿当前方向继续演化。', 'upgrade');
    return true;
  }

  moduleLevel(id) {
    const charge = this.state.charges[id] || 0;
    return charge >= MODULE_THRESHOLDS[2] ? 3 : charge >= MODULE_THRESHOLDS[1] ? 2 : charge > MODULE_THRESHOLDS[0] ? 1 : 0;
  }

  harvest(id) {
    if (!this.canAct || this.state.status !== 'building' || this.state.pulse !== 3) return false;
    const module = BIO_MODULES.find(item => item.id === id), level = this.moduleLevel(id);
    if (!module || !level) return false;
    const samples = [...this.state.specimens];
    const totalCharge = Object.values(this.state.charges).reduce((sum, value) => sum + value, 0);
    const research = Math.round(samples.reduce((sum, sample) => sum + speciesById.get(sample.speciesId).research, 0) * (1.4 + level * .3) + totalCharge);
    const credits = Math.round(samples.reduce((sum, sample) => sum + speciesById.get(sample.speciesId).value, 0) * .65);
    // Finalize before any event can save the game or revisit this screen.
    this.state.status = 'complete';
    this.state.result = { module: id, level, research, credits, specimens: samples };
    this.state.specimens = [];
    this.game.resources.research += research;
    this.game.resources.credits += credits;
    this.game.labProcessed += samples.length;
    this.game.labRuns++;
    this.game.unlockBioModule(id, level);
    this.game.addXp?.(35 + level * 20 + samples.length * 12);
    if (this.game.labProcessed >= 10) this.game.unlockPaint?.('aurora');
    this.change(module.name + ' · ' + level + '阶诞生。获得 ' + research + ' 科研点与 ' + credits + ' 信用点，可以在下潜前装备。', 'upgrade');
    return true;
  }

  cancel() {
    if (!this.game.docked || !this.active) return false;
    for (const sample of this.state.specimens) this.returnSpecimen(sample);
    const sequence = this.state.sequence;
    this.game.labState = { ...freshState(), sequence };
    this.change('实验已封存，所有样本及完整度已退回。');
    return true;
  }
}
