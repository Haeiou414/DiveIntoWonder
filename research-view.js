import { LAB_SYMBOLS } from './research-shift.js';

const GLYPHS = ['⌁', '≈', '✦'];
const STATIONS = ['culture', 'analyzer', 'report'];

export class ResearchStationUI {
  constructor(root, shift, actions) { this.root = root; this.shift = shift; this.actions = actions; this.lastStatus = ''; }

  render() {
    const { game, state } = this.shift;
    const docked = game.docked;
    this.lastStatus = state.status;
    this.root.innerHTML = `
      <div class="station-heading">
        <div><span class="station-kicker">SECOND SHIFT / 浮岛科研站</span><p>培养 → 校准 → 解码交付。三台设备同时工作，及时为下一份样本腾出位置。</p></div>
        <div class="shift-clock"><span>${this.shift.active ? '本班剩余' : '每班时长'}</span><strong id="shift-clock">${this.shift.active ? Math.ceil(state.remaining) : 90}<small>s</small></strong><div class="meter"><i id="shift-time-bar"></i></div></div>
      </div>
      <div class="station-overview">
        <canvas id="lab-panorama" width="720" height="84" aria-label="浮岛科研站的像素操作台"></canvas>
        <div class="shift-stats"><div><span>报告交付</span><b id="shift-delivered">${state.delivered}</b></div><div><span>连续精确</span><b id="shift-combo">${state.combo}<small>连击</small></b></div><div><span>本班科研</span><b id="shift-research">+${state.research}</b></div><div><span>本班信用</span><b id="shift-credits">+${state.credits}</b></div></div>
      </div>
      ${!docked ? '<div class="station-callout"><div><strong>科研站等待你的样本</strong><p>当前仍在海中。返航把样本放进冷藏库，再开始值班。</p></div><button class="primary-button" id="station-return">返航并入库 ↗</button></div>' : !this.shift.active ? `<div class="station-callout ${state.status === 'complete' ? 'shift-complete' : ''}"><div><strong>${state.status === 'complete' ? `值班结束 · ${state.delivered} 份报告 / 最佳 ${state.bestCombo} 连击` : '三台仪器，一个忙碌的你。'}</strong><p>${state.status === 'complete' ? `${state.lastMessage} 科研可用于基因适应，信用点用于船坞改装。` : '每份样本只消耗一次。准确校准、按序解码和专项匹配都会提高收益；未完成的样本退回冷藏库。'}</p></div><button class="primary-button" id="shift-start" ${this.shift.availableSamples ? '' : 'disabled'}>${this.shift.availableSamples ? '开始 90 秒值班 →' : '等待下潜样本'}</button></div>` : `<div class="shift-order"><span class="order-icon">✧</span><div><strong id="shift-order-label">${this.shift.orderLabel}</strong><span>匹配交付额外 +8 科研 / +20 信用点，完成后轮换专项。</span></div><button class="text-button" id="shift-finish">提前交班 ↗</button></div>`}
      <div class="station-machines">
        ${STATIONS.map((station, index) => this.machine(station, index)).join('')}
      </div>
      <div class="lab-live-message" id="lab-message" role="status">${state.lastMessage}</div>
      <div class="section-heading sample-heading"><div><h2>冷藏库 · 点击装样 <span class="sample-total">${this.shift.availableSamples}</span></h2></div><span>累计交付 ${game.labProcessed} 份 · 极光涂装 ${Math.min(10, game.labProcessed)} / 10</span></div>
      <div class="sample-library">${this.shift.inventory.map(species => `<button class="sample-tile" data-admit="${species.id}" ${!this.shift.canAct || state.stations.culture ? 'disabled' : ''}><canvas width="96" height="70" data-lab-species="${species.id}"></canvas><span><strong>${species.name}</strong><small>基础科研 ${species.research} · ${species.kind === 'jelly' ? '水母' : ['fish','eel'].includes(species.kind) ? '鱼类' : '其他生物'}</small></span><b>×${game.sampleStock[species.id]}</b></button>`).join('') || '<div class="empty-samples"><span>◇</span><p>冷藏库暂时没有样本。<br>下潜捕获生物，回港后即可加入科研值班。</p><button class="primary-button" id="station-explore">去下潜采样 ↓</button></div>'}</div>
      <div class="station-exits"><button class="filter-chip" id="station-genes">用科研点融合基因 ↗</button><button class="filter-chip" id="station-hangar">用信用点改装舰队 ↗</button><button class="filter-chip" id="station-go-dive">${this.shift.active ? '暂存工位，去探索' : '准备下一次下潜'} ↓</button></div>`;
    const listen = (id, action) => this.root.querySelector(`#${id}`)?.addEventListener('click', action);
    listen('shift-start', () => this.shift.start());
    listen('shift-finish', () => this.shift.finish());
    listen('station-return', this.actions.returnPort);
    listen('station-explore', this.actions.openExplore);
    listen('station-go-dive', this.actions.openExplore);
    listen('station-genes', this.actions.openGenes);
    listen('station-hangar', this.actions.openHangar);
    listen('culture-stabilize', () => this.shift.stabilize());
    listen('culture-transfer', () => this.shift.transfer('culture'));
    listen('analyzer-calibrate', () => this.shift.calibrate());
    listen('analyzer-transfer', () => this.shift.transfer('analyzer'));
    listen('report-deliver', () => this.shift.deliver());
    this.root.querySelectorAll('[data-admit]').forEach(button => button.addEventListener('click', () => this.shift.admit(button.dataset.admit)));
    this.root.querySelectorAll('[data-code]').forEach(button => button.addEventListener('click', () => this.shift.decode(Number(button.dataset.code))));
    this.root.querySelectorAll('[data-lab-species]').forEach(canvas => this.actions.drawSpecimen(canvas, canvas.dataset.labSpecies));
    this.tick();
  }

  machine(station, index) {
    const job = this.shift.state.stations[station];
    const names = ['恒温培养槽', '光谱分析仪', '基因报告终端'];
    const english = ['CULTURE', 'SPECTRUM', 'DELIVERY'];
    const descriptions = ['样本培养至绿色区间，调整温控提高质量。', '等待指针进入中间绿色区域，锁定光谱。', '照着序列点击三个符号，再交付报告。'];
    const species = job && this.shift.game.getSpecies(job.speciesId);
    return `<article class="lab-machine ${job ? 'occupied' : 'empty'}" data-station="${station}">
      <div class="machine-top"><span class="machine-number">0${index + 1}</span><div><h3>${names[index]}</h3><small>${english[index]}</small></div><span class="machine-state" id="${station}-status">${job ? '处理中' : '空闲'}</span></div>
      <div class="machine-window"><div class="window-grid"></div>${job ? `<canvas width="180" height="100" data-lab-species="${job.speciesId}"></canvas><span class="machine-species">${species.name}</span><span class="sample-quality">质量 <b id="${station}-quality">${job.quality}</b></span>` : `<span class="empty-machine-icon">${['♧','⌁','▤'][index]}</span><span class="machine-species">${index === 0 ? '从冷藏库装载样本' : '等待上游设备移交'}</span>`}</div>
      <p class="machine-description">${descriptions[index]}</p>
      <div class="machine-operation">${station === 'culture' ? `<div class="calibration-track culture-track"><span class="calibration-zone"></span><i id="culture-progress"></i><b id="culture-percent">0%</b></div><div class="machine-buttons"><button id="culture-stabilize" class="card-button" ${!job ? 'disabled' : ''}>温控校准 <kbd>1</kbd></button><button id="culture-transfer" class="card-button transfer-button" ${!job ? 'disabled' : ''}>送往分析 →</button></div>` : station === 'analyzer' ? `<div class="calibration-track analyzer-track"><span class="calibration-zone"></span><i id="analyzer-pointer"></i><b id="analyzer-percent">等待样本</b></div><div class="machine-buttons"><button id="analyzer-calibrate" class="card-button" ${!job ? 'disabled' : ''}>锁定光谱 <kbd>2</kbd></button><button id="analyzer-transfer" class="card-button transfer-button" ${!job ? 'disabled' : ''}>生成报告 →</button></div>` : `<div class="gene-sequence">${(job?.code || [0,1,2]).map((symbol, step) => `<span class="${job && step < job.step ? 'decoded' : ''}">${GLYPHS[symbol]}<small>${LAB_SYMBOLS[symbol]}</small></span>`).join('')}<span class="sequence-arrow">→</span><b>${job?.step || 0}/3</b></div><div class="decode-buttons">${LAB_SYMBOLS.map((label, symbol) => `<button data-code="${symbol}" ${!job || job.step >= 3 ? 'disabled' : ''}>${GLYPHS[symbol]}<small>${label}</small></button>`).join('')}<button id="report-deliver" class="card-button" ${!job || job.step !== 3 ? 'disabled' : ''}>交付 <kbd>3</kbd></button></div>`}</div>
    </article>`;
  }

  tick() {
    if (!this.root.querySelector('#shift-clock')) return;
    if (this.shift.state.status !== this.lastStatus) { this.render(); return; }
    const { state } = this.shift;
    const text = (id, content) => { const el = this.root.querySelector(`#${id}`); if (el) el.textContent = content; };
    text('shift-clock', `${Math.ceil(this.shift.active ? state.remaining : 90)}s`);
    this.root.querySelector('.shift-clock > span').textContent = this.shift.active ? (this.shift.paused ? '已暂停' : '本班剩余') : '每班时长';
    const timeBar = this.root.querySelector('#shift-time-bar');
    if (timeBar) timeBar.style.width = `${state.remaining / 90 * 100}%`;
    const culture = state.stations.culture, analyzer = state.stations.analyzer, report = state.stations.report;
    for (const station of STATIONS) {
      const job = state.stations[station];
      text(`${station}-quality`, job?.quality || '—');
      text(`${station}-status`, !job ? '空闲' : station === 'report' ? (job.step === 3 ? '待交付' : '待解码') : job.progress >= 1 && (station !== 'analyzer' || job.calibrated) ? '待移交' : '处理中');
      this.root.querySelector(`[data-station="${station}"]`)?.classList.toggle('waiting', Boolean(job?.wait > 7));
    }
    const enabled = this.shift.canAct;
    this.root.querySelectorAll('[data-admit]').forEach(button => { button.disabled = !enabled || Boolean(culture); });
    this.root.querySelectorAll('[data-code]').forEach(button => { button.disabled = !enabled || !report || report.step >= 3; });
    const disable = (id, value) => { const button = this.root.querySelector(`#${id}`); if (button) button.disabled = value || !enabled; };
    disable('culture-stabilize', !culture || culture.correction || culture.progress >= 1);
    disable('culture-transfer', !culture || culture.progress < 1 || Boolean(analyzer));
    disable('analyzer-calibrate', !analyzer || analyzer.calibrated || analyzer.cooldown > 0);
    disable('analyzer-transfer', !analyzer || analyzer.progress < 1 || !analyzer.calibrated || Boolean(report));
    disable('report-deliver', !report || report.step !== 3);
    if (culture) {
      this.root.querySelector('#culture-progress').style.width = `${culture.progress * 100}%`;
      text('culture-percent', `${Math.round(culture.progress * 100)}%${culture.correction ? ' · 已校准' : ''}`);
    }
    if (analyzer) {
      this.root.querySelector('#analyzer-pointer').style.left = `${this.shift.phase * 100}%`;
      text('analyzer-percent', analyzer.calibrated ? `已锁定 · 分析 ${Math.round(analyzer.progress * 100)}%` : '指针对齐后锁定');
      this.root.querySelector('#analyzer-calibrate').classList.toggle('in-range', this.shift.calibrationReady && !analyzer.calibrated);
    }
    this.drawPanorama();
  }

  shortcut(key) {
    if (!this.shift.canAct) return;
    if (key === '1') { if (this.shift.state.stations.culture?.progress >= 1) this.shift.transfer('culture'); else this.shift.stabilize(); }
    if (key === '2') { if (this.shift.state.stations.analyzer?.calibrated) this.shift.transfer('analyzer'); else this.shift.calibrate(); }
    if (key === '3') this.shift.deliver();
  }

  drawPanorama() {
    const canvas = this.root.querySelector('#lab-panorama');
    if (!canvas) return;
    const c = canvas.getContext('2d'), t = this.shift.state.elapsed;
    c.fillStyle = '#102630'; c.fillRect(0, 0, 720, 84);
    c.fillStyle = '#193f48'; c.fillRect(0, 8, 720, 45);
    for (let x = 0; x < 720; x += 8) { c.fillStyle = x % 24 ? '#285562' : '#3b6a70'; c.fillRect(x, 38 + Math.sin(x / 19 + t) * 3, 7, 2); }
    c.fillStyle = '#d6c9a4'; c.fillRect(548, 17, 11, 10); c.fillStyle = '#0e222b'; c.fillRect(0, 52, 720, 32);
    for (let x = 20; x < 720; x += 98) {
      c.fillStyle = '#28434b'; c.fillRect(x, 6, 4, 46); c.fillRect(x, 55, 67, 5); c.fillRect(x + 4, 60, 4, 18); c.fillRect(x + 58, 60, 4, 18);
      c.fillStyle = '#455d61'; c.fillRect(x + 18, 35, 32, 19); c.fillStyle = '#8dcdb7'; c.fillRect(x + 21, 38, 26, 10);
      c.fillStyle = '#e5bf7c'; c.fillRect(x + 51, 47, 5, 5);
    }
    const person = 120 + Math.sin(t / 3) * 170 + 170;
    c.fillStyle = '#e4c8a3'; c.fillRect(person, 44, 8, 8); c.fillStyle = '#e2e7dc'; c.fillRect(person - 2, 53, 12, 15);
    c.fillStyle = '#93bab3'; c.fillRect(person - 2, 68, 4, 9); c.fillRect(person + 6, 68, 4, 9);
    c.fillStyle = '#a8ded0'; for (let x = 0; x < 720; x += 80) c.fillRect(x + 20, 2, 36, 2);
  }
}
