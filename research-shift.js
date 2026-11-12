import { SPECIES } from './data.js';

const speciesById = new Map(SPECIES.map(species => [species.id, species]));
export const LAB_SYMBOLS = ['螺旋', '波纹', '星点'];
export const SHIFT_SECONDS = 90;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const freshState = () => ({ version: 1, status: 'idle', remaining: SHIFT_SECONDS, elapsed: 0, stations: { culture: null, analyzer: null, report: null }, delivered: 0, combo: 0, bestCombo: 0, credits: 0, research: 0, qualityTotal: 0, sequence: 0, order: 'fish', orderCompleted: 0, lastMessage: '先带回样本，再开始一班科研工作。' });

/** A real-time three-station pipeline. All inventory and jobs share Game's save transaction. */
export class ResearchShift {
  constructor(game) {
    this.game = game;
    this.onChange = null;
    this.saveTimer = 0;
    this.ensureState();
  }

  ensureState() {
    const state = this.game.labState;
    if (!state || state.version !== 1 || !['idle', 'running', 'complete'].includes(state.status) || !state.stations) {
      this.game.labState = freshState();
    } else {
      const normalized = { ...freshState(), ...state };
      for (const field of ['elapsed', 'delivered', 'combo', 'bestCombo', 'credits', 'research', 'qualityTotal', 'sequence', 'orderCompleted']) {
        normalized[field] = Number.isFinite(normalized[field]) ? Math.max(0, normalized[field]) : 0;
      }
      normalized.remaining = Number.isFinite(state.remaining) ? clamp(state.remaining, 0, SHIFT_SECONDS) : SHIFT_SECONDS;
      normalized.stations = {};
      for (const station of ['culture', 'analyzer', 'report']) {
        const job = state.stations[station];
        normalized.stations[station] = job && speciesById.has(job.speciesId) ? {
          speciesId: job.speciesId, quality: clamp(Number(job.quality) || 70, 20, 120),
          progress: clamp(Number(job.progress) || 0, 0, 1), age: Math.max(0, Number(job.age) || 0),
          calibrated: Boolean(job.calibrated), correction: Boolean(job.correction),
          code: Array.isArray(job.code) && job.code.length === 3 && job.code.every(n => Number.isInteger(n) && n >= 0 && n < 3) ? job.code : [0, 1, 2],
          step: clamp(Math.floor(Number(job.step) || 0), 0, 3), wait: Math.max(0, Number(job.wait) || 0),
          cooldown: clamp(Number(job.cooldown) || 0, 0, 1), penalized: Boolean(job.penalized),
        } : null;
      }
      this.game.labState = normalized;
    }
    this.game.sampleStock ??= {};
    this.game.labProcessed ??= 0;
    this.game.labRuns ??= 0;
    this.game.labBestCombo ??= 0;
  }

  get state() { return this.game.labState; }
  get inventory() { return SPECIES.filter(species => (this.game.sampleStock[species.id] || 0) > 0); }
  get availableSamples() { return this.inventory.reduce((sum, species) => sum + this.game.sampleStock[species.id], 0); }
  get active() { return this.state.status === 'running'; }
  get canAct() { return this.game.docked && this.active && !this.paused; }
  get phase() { return (Math.sin((this.state.stations.analyzer?.age || 0) * 2.4 - Math.PI / 2) + 1) / 2; }
  get calibrationReady() { return this.phase >= .32 && this.phase <= .68; }
  get orderLabel() { return this.state.order === 'jelly' ? '发光生物专项（水母）' : '游泳肌束专项（鱼类、鳗类）'; }

  change(message = '', sound = '') {
    if (message) this.state.lastMessage = message;
    this.game.save();
    this.onChange?.({ message, sound });
  }

  start() {
    if (!this.game.docked || this.active || !this.availableSamples) return false;
    const sequence = this.state.sequence + 1;
    this.game.labState = { ...freshState(), status: 'running', sequence, order: this.game.labRuns % 2 ? 'jelly' : 'fish' };
    this.change('值班开始。先点击样本装载培养槽；可以让三台设备同时工作。', 'launch');
    return true;
  }

  admit(speciesId) {
    if (!this.canAct || this.state.stations.culture || !(this.game.sampleStock[speciesId] > 0) || !speciesById.has(speciesId)) return false;
    this.game.sampleStock[speciesId]--;
    const index = SPECIES.findIndex(species => species.id === speciesId);
    this.state.stations.culture = { speciesId, quality: 70, progress: 0, age: 0, calibrated: false, correction: false, code: [index % 3, (index + 1 + this.state.sequence) % 3, (index + 2) % 3], step: 0, wait: 0, cooldown: 0, penalized: false };
    this.change(`${speciesById.get(speciesId).name}已装载。培养至 35–80% 时校准温控。`, 'click');
    return true;
  }

  stabilize() {
    const job = this.state.stations.culture;
    if (!this.canAct || !job || job.correction || job.progress >= 1) return false;
    job.correction = true;
    const good = job.progress >= .35 && job.progress <= .8;
    job.quality = clamp(job.quality + (good ? 15 : -5), 20, 120);
    this.change(good ? '温控稳定，样本质量 +15。' : '温控偏早或偏晚，质量 −5；等待培养结束后仍可分析。', good ? 'capture' : 'warning');
    return good;
  }

  transfer(from) {
    const to = from === 'culture' ? 'analyzer' : from === 'analyzer' ? 'report' : null;
    const job = this.state.stations[from];
    if (!this.canAct || !to || !job || job.progress < 1 || this.state.stations[to] || (from === 'analyzer' && !job.calibrated)) return false;
    this.state.stations[from] = null;
    this.state.stations[to] = { ...job, progress: 0, age: 0, wait: 0, cooldown: 0, penalized: false };
    this.change(to === 'analyzer' ? '光谱分析已启动。指针进入绿色区间时锁定；培养槽可以装下一个样本。' : '分析完成。按给出的顺序录入三段基因，再提交报告。', 'click');
    return true;
  }

  calibrate() {
    const job = this.state.stations.analyzer;
    if (!this.canAct || !job || job.calibrated || job.cooldown > 0) return false;
    job.cooldown = .4;
    if (!this.calibrationReady) {
      job.quality = Math.max(20, job.quality - 4);
      this.change('波形未对齐。指针进入中间的绿色区域时再试，质量 −4。', 'warning');
      return false;
    }
    job.calibrated = true;
    job.quality = Math.min(120, job.quality + 20);
    this.change('光谱锁定，样本质量 +20。', 'capture');
    return true;
  }

  decode(symbol) {
    const job = this.state.stations.report;
    if (!this.canAct || !job || job.step >= 3 || !Number.isInteger(symbol) || symbol < 0 || symbol > 2) return false;
    if (symbol !== job.code[job.step]) {
      job.step = 0;
      job.quality = Math.max(20, job.quality - 8);
      this.state.combo = 0;
      this.change('序列不匹配，连击中断。按显示顺序重新录入即可，样本不会丢失。', 'warning');
      return false;
    }
    job.step++;
    if (job.step === 3) { job.progress = 1; job.quality = Math.min(120, job.quality + 5); }
    this.change(job.step === 3 ? '基因序列确认，报告可以交付。' : `序列 ${job.step}/3 已录入。`, 'click');
    return true;
  }

  deliver() {
    const job = this.state.stations.report;
    if (!this.canAct || !job || job.step !== 3) return false;
    const species = speciesById.get(job.speciesId);
    const matching = this.state.order === 'jelly' ? species.kind === 'jelly' : ['fish', 'eel'].includes(species.kind);
    if (job.quality >= 85) this.state.combo++;
    else this.state.combo = 0;
    const multiplier = 1 + Math.min(this.state.combo, 5) * .1;
    const research = Math.max(5, Math.round(species.research * 1.35 * job.quality / 100 * multiplier)) + (matching ? 8 : 0);
    const credits = Math.round(species.value * .55 * multiplier) + (matching ? 20 : 0);
    this.game.resources.research += research;
    this.game.resources.credits += credits;
    this.state.research += research;
    this.state.credits += credits;
    this.state.delivered++;
    this.state.qualityTotal += job.quality;
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);
    this.game.labProcessed++;
    this.game.labBestCombo = Math.max(this.game.labBestCombo, this.state.bestCombo);
    if (matching) { this.state.orderCompleted++; this.state.order = this.state.order === 'fish' ? 'jelly' : 'fish'; }
    // Consume the in-flight job before emitting events or persisting a reward.
    this.state.stations.report = null;
    this.game.addXp?.(20 + Math.floor(job.quality / 5));
    if (this.game.labProcessed >= 10) this.game.unlockPaint?.('aurora');
    this.change(`报告交付：+${research} 科研 / +${credits} 信用点${matching ? ' · 专项委托完成' : ''}。`, 'upgrade');
    if (!this.availableSamples && Object.values(this.state.stations).every(value => !value)) this.finish();
    return true;
  }

  update(dt) {
    if (!this.canAct) return;
    const delta = clamp(Number(dt) || 0, 0, .25);
    this.state.elapsed += delta;
    this.state.remaining = Math.max(0, this.state.remaining - delta);
    for (const [station, job] of Object.entries(this.state.stations)) {
      if (!job) continue;
      job.age += delta;
      job.cooldown = Math.max(0, job.cooldown - delta);
      if (station === 'culture') job.progress = Math.min(1, job.progress + delta / 5);
      if (station === 'analyzer') job.progress = Math.min(1, job.progress + delta / 6);
      const ready = station === 'report' ? job.step === 3 : job.progress >= 1 && (station !== 'analyzer' || job.calibrated);
      if (ready) {
        job.wait += delta;
        // Backlogs create light pressure, not destroyed specimens or a hard fail.
        if (job.wait > 14 && !job.penalized) {
          job.penalized = true;
          job.quality = Math.max(20, job.quality - 10);
          this.state.combo = 0;
          this.change('有样本在设备中等待过久，质量 −10。先疏通下游工位。', 'warning');
        }
      }
    }
    this.saveTimer += delta;
    if (this.saveTimer >= 4) { this.saveTimer = 0; this.game.save(); }
    if (this.state.remaining <= 0) this.finish();
  }

  finish() {
    if (!this.active) return false;
    let returned = 0;
    for (const [station, job] of Object.entries(this.state.stations)) {
      if (!job) continue;
      this.game.sampleStock[job.speciesId] = (this.game.sampleStock[job.speciesId] || 0) + 1;
      this.state.stations[station] = null;
      returned++;
    }
    this.state.status = 'complete';
    this.game.labRuns++;
    this.change(`本班交付 ${this.state.delivered} 份报告，获得 ${this.state.research} 科研点。${returned ? `${returned} 份未完成样本已退回冷藏库。` : '收益已入账。'}`, 'level');
    return true;
  }
}
