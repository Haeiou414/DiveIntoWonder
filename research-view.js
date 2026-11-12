import { CORE_CELL, TERMINALS, DIRECTIONS, MUTATIONS, MODULE_THRESHOLDS } from './research-shift.js';
import { BIO_MODULES } from './bio-modules.js';

const ICONS = { lumen: '✧', flow: '≈', shell: '⬡', echo: '◎', repair: '✣' };
const terminalMap = new Map(TERMINALS.map(terminal => [terminal.cell, terminal]));
const moduleMap = new Map(BIO_MODULES.map(module => [module.id, module]));

export class ResearchStationUI {
  constructor(root, chamber, actions) {
    this.root = root;
    this.chamber = chamber;
    this.actions = actions;
    this.previewStarted = 0;
    this.lastStatus = '';
  }

  render() {
    const scrollPosition = window.scrollY;
    const { state, game } = this.chamber;
    const previousStatus = this.lastStatus;
    this.lastStatus = state.status;
    const active = this.chamber.active;
    const preview = active ? this.chamber.simulate() : { cells: {}, targets: {} };
    const result = state.result;
    this.root.innerHTML = `
      <div class="chamber-intro">
        <div><span class="station-kicker">LIVING CIRCUIT / 共鸣演化舱</span><p>旋转生命回路，选择突变，培育下一次远航的能力。</p></div>
        <span class="chamber-mode">三次脉冲 · 自由思考</span>
      </div>
      ${!game.docked ? `<div class="chamber-callout"><span>样本需要在基地接入演化舱。</span><button class="primary-button" id="station-return">返航并入库 ↗</button></div>` : ''}
      ${result && !active ? `<div class="chamber-result" style="--organ-color:${moduleMap.get(result.module)?.color}">
        <span class="result-glyph">${ICONS[result.module]}</span><div><small>生命回路已稳定</small><h2>${moduleMap.get(result.module)?.name} · ${result.level} 阶</h2><p>+${result.research} 科研 · +${result.credits} 信用点</p></div>
        <button class="primary-button" data-equip-module="${result.module}" ${game.equippedBioModule === result.module ? 'disabled' : ''}>${game.equippedBioModule === result.module ? '已装备' : '装备这个模块 ↗'}</button>
      </div>` : ''}
      <div class="chamber-layout">
        <div class="circuit-panel">
          <div class="circuit-top"><strong>${active ? '胚核正在等待你的设计' : '一份样本，无数种可能'}</strong><span>${active ? `脉冲 ${state.pulse} / 3 · 能量 ${this.chamber.energy}` : '从样本库开始'}</span></div>
          <div class="circuit-surface">
            <div class="circuit-grid" aria-label="生命回路，点击连接片顺时针旋转">${this.boardCells(preview)}</div>
            <canvas class="pulse-canvas" id="pulse-canvas" width="500" height="500" aria-hidden="true"></canvas>
            ${!active ? '<div class="circuit-idle"><span>✧</span><strong>选择样本，点亮生命</strong><p>同一份样本也能演化出不同能力。</p></div>' : ''}
          </div>
          <div class="circuit-controls">
            <button class="filter-chip" id="circuit-undo" ${!this.chamber.canAct || !state.history.length || state.status !== 'building' || state.pulse >= 3 ? 'disabled' : ''}>↶ 撤回</button>
            <button class="filter-chip" id="circuit-preview" ${!active ? 'disabled' : ''}>▷ 脉冲预演</button>
            <button class="primary-button" id="circuit-pulse" ${!this.chamber.canAct || state.status !== 'building' || state.pulse >= 3 ? 'disabled' : ''}>${!active ? '选择样本开始' : state.pulse >= 3 ? '选择器官培育' : `释放第 ${state.pulse + 1} 次脉冲`}</button>
          </div>
          <p class="circuit-instruction">点击旋转 · 右键反转 · Z 撤回 · P 预演 · Enter 释放。亮线通向器官，分叉会分散能量。</p>
        </div>
        <aside class="evolution-panel">
          <div class="evolution-heading"><h2>${state.status === 'mutation' ? '选择一次突变' : state.pulse === 3 && active ? '你想带走哪种能力？' : '器官的未来'}</h2><span>${state.status === 'mutation' ? (this.chamber.fidelityCount ? '完整样本 · 四选一' : '三选一') : `${MODULE_THRESHOLDS[1]} 能量升至Ⅱ阶 · ${MODULE_THRESHOLDS[2]} 升至Ⅲ阶`}</span></div>
          ${state.status === 'mutation' ? `<div class="mutation-options">${state.offered.map(id => {
            const mutation = MUTATIONS.find(item => item.id === id);
            return `<button class="mutation-card" data-mutation="${id}" style="--organ-color:${mutation.color}" ${!this.chamber.canAct ? 'disabled' : ''}><b>${mutation.glyph}</b><span><strong>${mutation.name}</strong><small>${mutation.description}</small></span><i>↗</i></button>`;
          }).join('')}</div>` : `<div class="organ-options">${BIO_MODULES.map(module => this.organ(module, preview)).join('')}</div>`}
          <div class="mutation-history">${state.mutations.map(id => `<span>${MUTATIONS.find(item => item.id === id).glyph} ${MUTATIONS.find(item => item.id === id).name}</span>`).join('')}</div>
          <div class="donor-strip">${active ? state.specimens.map(sample => {
            const species = game.getSpecies(sample.speciesId);
            return `<span><canvas width="70" height="50" data-lab-species="${species.id}"></canvas><b>${species.name}</b><small>${sample.fidelity ? '完整谱系 +5 能量' : '活性样本'}</small></span>`;
          }).join('') : '<p>加入不同动物门的样本，获得共生能量。蝠鲼号的完整谱系提供额外能量与突变选项。</p>'}</div>
          ${active ? `<div class="chamber-traits">${this.chamber.traits.map(id => `<span style="color:${moduleMap.get(id)?.color}">${ICONS[id]} ${moduleMap.get(id)?.name}亲和</span>`).join('')}</div><button class="text-button" id="experiment-cancel">撤销实验，取回样本 ↗</button>` : ''}
        </aside>
      </div>
      <div class="chamber-message" role="status">${state.lastMessage}</div>
      <div class="section-heading specimen-heading"><div><h2>样本冷藏库 <span class="sample-total">${this.chamber.availableSamples}</span></h2><p>${active ? state.pulse > 0 ? '本轮谱系已确定。可以预演、旋转回路，或选择突变。' : '可再加入最多两份共生样本，第一束脉冲释放后确定谱系。' : '选择样本开始实验。每次实验最多组合三个样本。'}</p></div><span>已演化 ${game.labProcessed} 份 · 极光涂装 ${Math.min(10, game.labProcessed)}/10</span></div>
      <div class="chamber-inventory">${this.chamber.inventory.map(species => `
        <button class="genome-sample" data-sample="${species.id}" ${!game.docked || this.chamber.paused || (active && (state.pulse > 0 || state.specimens.length >= 3)) ? 'disabled' : ''}>
          <canvas width="96" height="70" data-lab-species="${species.id}"></canvas>
          <span><strong>${species.name}</strong><small>${species.taxonomy?.group || species.kind}</small><em>${(species.traits || ['flow']).map(id => ICONS[id]).join(' ')}${game.sampleFidelity?.[species.id] ? ' · 完整谱系 ×' + game.sampleFidelity[species.id] : ''}</em></span><b>×${game.sampleStock[species.id]}</b>
        </button>`).join('') || `<div class="empty-genomes"><span>${active ? '所有样本都已接入实验。' : '下潜带回生物样本，即可开始演化。'}</span><button class="filter-chip" id="station-go-dive">去下潜采样 ↓</button></div>`}</div>
      <div class="module-locker">
        <div class="section-heading"><div><h2>生物模块</h2><p>一艘载具可装配一个模块。已培育的最高阶版本永久保留。</p></div><button class="filter-chip" id="station-genes">基因实验室 ↗</button></div>
        <div class="module-locker-grid">${BIO_MODULES.map(module => {
          const level = game.bioModules?.[module.id] || 0;
          return `<button class="module-card ${game.equippedBioModule === module.id ? 'equipped' : ''}" data-equip-module="${module.id}" style="--organ-color:${module.color}" ${!level || !game.docked ? 'disabled' : ''}><b>${ICONS[module.id]}</b><span><strong>${module.name} ${level ? 'ⅠⅡⅢ'[level - 1] : ''}</strong><small>${level ? module.levels[level - 1] : '等待演化发现'}</small></span><em>${game.equippedBioModule === module.id ? '已装备' : level ? '装备' : '◇'}</em></button>`;
        }).join('')}</div>
      </div>`;
    if (!active) {
      const layout = this.root.querySelector('.chamber-layout');
      this.root.insertBefore(this.root.querySelector('.specimen-heading'), layout);
      this.root.insertBefore(this.root.querySelector('.chamber-inventory'), layout);
    }
    const listen = (id, handler) => this.root.querySelector('#' + id)?.addEventListener('click', handler);
    listen('station-return', this.actions.returnPort);
    listen('station-go-dive', this.actions.openExplore);
    listen('station-genes', this.actions.openGenes);
    listen('experiment-cancel', () => this.chamber.cancel());
    listen('circuit-undo', () => this.chamber.undo());
    listen('circuit-preview', () => { this.previewStarted = performance.now(); });
    listen('circuit-pulse', () => {
      if (this.chamber.releasePulse()) this.previewStarted = performance.now();
    });
    this.root.querySelectorAll('[data-cell]').forEach(button => {
      button.addEventListener('click', () => this.chamber.rotate(Number(button.dataset.cell)));
      button.addEventListener('contextmenu', event => { event.preventDefault(); this.chamber.rotate(Number(button.dataset.cell), -1); });
    });
    this.root.querySelectorAll('[data-sample]').forEach(button => button.addEventListener('click', () => {
      if (this.chamber.active) this.chamber.addDonor(button.dataset.sample);
      else if (this.chamber.start(button.dataset.sample)) this.root.querySelector('.circuit-panel').scrollIntoView({ block: 'nearest' });
    }));
    this.root.querySelectorAll('[data-mutation]').forEach(button => button.addEventListener('click', () => this.chamber.chooseMutation(button.dataset.mutation)));
    this.root.querySelectorAll('[data-harvest]').forEach(button => button.addEventListener('click', () => this.chamber.harvest(button.dataset.harvest)));
    this.root.querySelectorAll('[data-equip-module]').forEach(button => button.addEventListener('click', () => {
      game.equipBioModule(button.dataset.equipModule);
      this.render();
    }));
    this.root.querySelectorAll('[data-lab-species]').forEach(canvas => this.actions.drawSpecimen(canvas, canvas.dataset.labSpecies));
    this.tick();
    window.scrollTo({ top: scrollPosition, behavior: 'instant' });
    if (state.status === 'complete' && previousStatus !== 'complete') {
      this.root.querySelector('.chamber-result')?.scrollIntoView({ block: 'nearest' });
    }
  }

  boardCells(preview) {
    const { state } = this.chamber;
    return Array.from({ length: 25 }, (_, cell) => {
      const terminal = terminalMap.get(cell);
      const mask = state.board[cell] || [3, 5, 6, 9][cell % 4];
      const charge = terminal ? state.charges[terminal.module] || 0 : 0;
      const powered = cell in preview.cells;
      if (cell === CORE_CELL) return `<div class="circuit-cell core-cell"><span>✺</span><b>胚核</b><small>${this.chamber.active ? this.chamber.energy : '—'}</small></div>`;
      if (terminal) {
        const module = moduleMap.get(terminal.module);
        return `<div class="circuit-cell terminal-cell ${powered ? 'powered' : ''}" style="--organ-color:${module.color}"><b>${ICONS[module.id]}</b><span>${terminal.label}</span><small>${charge.toFixed(1)}${preview.targets[module.id] ? ' +' + preview.targets[module.id].toFixed(1) : ''}</small></div>`;
      }
      const ports = DIRECTIONS.filter(direction => mask & direction.bit).map(direction => `<i class="circuit-wire wire-${direction.bit}"></i>`).join('');
      return `<button class="circuit-cell link-cell ${powered ? 'powered' : ''}" data-cell="${cell}" aria-label="旋转第 ${Math.floor(cell / 5) + 1} 行第 ${cell % 5 + 1} 列回路" ${!this.chamber.canAct || state.status !== 'building' || state.pulse >= 3 ? 'disabled' : ''}>${ports}<span class="cell-nucleus"></span></button>`;
    }).join('');
  }

  organ(module, preview) {
    const charge = this.chamber.state.charges[module.id] || 0;
    const incoming = preview.targets[module.id] || 0;
    const level = this.chamber.moduleLevel(module.id);
    const harvestable = this.chamber.active && this.chamber.state.pulse === 3 && level > 0;
    return `<button class="organ-card ${incoming > 0 ? 'receiving' : ''}" data-harvest="${module.id}" style="--organ-color:${module.color}" ${!harvestable || !this.chamber.canAct ? 'disabled' : ''}>
      <b>${ICONS[module.id]}</b><span><strong>${module.name}<em>${level ? 'ⅠⅡⅢ'[level - 1] : '未激活'}</em></strong><small>${module.levels[Math.max(1, level) - 1]}</small><i class="organ-charge"><u style="width:${Math.min(100, charge / MODULE_THRESHOLDS[2] * 100)}%"></u></i></span>
      <span class="organ-numbers"><strong>${charge.toFixed(1)}</strong><small>${harvestable ? '培育 ↗' : this.chamber.state.status === 'complete' ? '实验已完成' : incoming > 0 ? '预演 +' + incoming.toFixed(1) : '尚未连通'}</small></span>
    </button>`;
  }

  shortcut(key) {
    if (key === 'z') this.chamber.undo();
    if (key === 'p' && this.chamber.active) this.previewStarted = performance.now();
    if (key === 'enter' && this.chamber.releasePulse()) this.previewStarted = performance.now();
  }

  tick() {
    const canvas = this.root.querySelector('#pulse-canvas');
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, 500, 500);
    if (!this.chamber.active || !this.previewStarted) return;
    const age = (performance.now() - this.previewStarted) / 1000;
    if (age > 2.4) { this.previewStarted = 0; return; }
    const result = this.chamber.simulate();
    context.shadowColor = '#aeffdb';
    context.shadowBlur = 12;
    for (const [index, edge] of result.edges.entries()) {
      const progress = ((age * 2 - index * .12) % 1 + 1) % 1;
      const [from, to] = edge;
      const x = (from % 5 + (to % 5 - from % 5) * progress) * 100 + 50;
      const y = (Math.floor(from / 5) + (Math.floor(to / 5) - Math.floor(from / 5)) * progress) * 100 + 50;
      context.fillStyle = age > 1.8 ? '#b8efd588' : '#d6ffe9';
      context.fillRect(x - 4, y - 4, 8, 8);
    }
    context.shadowBlur = 0;
  }
}
