import { Game } from './engine.js';
import { ZONES, SPECIES, VEHICLES, GENES, UPGRADES, WONDERS } from './data.js';
import { OceanRenderer, drawSpecimen, drawVehicle } from './renderer.js';
import { Soundscape } from './audio.js';

const $ = id => document.getElementById(id);
const icons = {
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  ship: '<path d="M4 11h14l3 4-3 4H5l-3-4zM9 11V6h6v5M2 15h4M17 14h1M9 15h3"/><path d="M12 6V3h4"/>',
  dna: '<path d="M7 2c0 8 10 12 10 20M17 2C17 10 7 14 7 22M8 5h8M9 9h6M9 15h6M8 19h8"/>',
  book: '<path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1zM12 5v15"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="m12 7 4 5-4 5-4-5z"/>',
  flask: '<path d="M9 3h6M10 3v7L4 19l1 2h14l1-2-6-9V3M7 15h10M10 18h1"/>',
  mute: '<path d="M11 4 6 8H3v8h3l5 4zM16 9l6 6M22 9l-6 6"/>',
  sound: '<path d="M11 4 6 8H3v8h3l5 4zM15 8c3 2 3 6 0 8M18 5c5 4 5 10 0 14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  battery: '<rect x="2" y="6" width="17" height="12" rx="2"/><path d="M22 10v4M6 9v6M10 9v6M14 9v6"/>',
  box: '<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7 5.5l9 5v4"/>',
  flag: '<path d="M5 22V3c5-4 9 4 14 0v11c-5 4-9-4-14 0"/>',
  crosshair: '<circle cx="12" cy="12" r="6"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 7-7M12 12v-9"/><circle cx="8" cy="15" r=".5"/>',
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 11h8M3 14c0 9 18 9 18 0M2 17l1-3 3 1M18 15l3-1 1 3"/>',
  waves: '<path d="M2 6c4-5 6 5 10 0s6 5 10 0M2 12c4-5 6 5 10 0s6 5 10 0M2 18c4-5 6 5 10 0s6 5 10 0"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  shield: '<path d="m12 2 8 4v7c0 4-8 9-8 9s-8-5-8-9V6zM8 12l3 3 5-6"/>',
  speed: '<path d="M3 17a9 9 0 1 1 18 0M12 13l5-6M4 13h2M18 13h2M12 4v2"/><circle cx="12" cy="15" r="2"/>',
};
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.compass}</svg>`;
function fillIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = svg(el.dataset.icon); }); }
fillIcons();
const number = value => Math.round(value || 0).toLocaleString('en-US');
const pad = value => String(value).padStart(2, '0');
const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const game = new Game();
const renderer = new OceanRenderer($('ocean'));
const audio = new Soundscape();
const keys = new Set();
const touch = new Set();
const modal = $('modal');
let view = 'explore';
let manuallyPaused = false;
let filter = 'all';
let selectedMission = 'capture';
let announcementTimer;
let hudElapsed = 0;
let lastFrame = performance.now();
let lastReady = false;
const zoneEnglish = ['SUNLIGHT ZONE', 'TWILIGHT ZONE', 'MIDNIGHT ZONE', 'ABYSSAL ZONE', 'HADAL ZONE'];
const viewTitles = { explore: ['向未知，下潜<span>。</span>', '有些奇遇，只有潜下去才会发生。'], hangar: ['让好奇，走更远<span>。</span>', '每一项改装，都是通往更深处的通行证。'], research: ['向生命，借一点灵感<span>。</span>', '海洋已经进化了亿万年。我们才刚刚开始学习。'], codex: ['把未知，变成相识<span>。</span>', '记住每一次相遇，收集属于你的整片海洋。'] };

function syncPause() { game.paused = manuallyPaused || view !== 'explore' || modal.open || document.hidden; }
function setView(next) {
  if (!viewTitles[next]) return;
  view = next;
  keys.clear(); touch.clear();
  document.querySelectorAll('.view').forEach(el => { el.hidden = el.id !== `${next}-view`; });
  document.querySelectorAll('[data-view]').forEach(el => { const active = el.dataset.view === next; el.classList.toggle('active', active); el.setAttribute('aria-current', active ? 'page' : 'false'); });
  $('page-title').innerHTML = viewTitles[next][0];
  $('page-subtitle').textContent = viewTitles[next][1];
  renderView(); syncPause(); updateHUD();
}
document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => { audio.play('click'); setView(el.dataset.view); }));
document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); setView('explore'); });

function toast(title, message = '', type = '') {
  const item = document.createElement('div');
  item.className = `toast ${type === 'warning' ? 'warning' : ''}`;
  const glyph = type === 'level' ? '↑' : type === 'warning' ? '!' : type === 'wonder' || type === 'discovery' ? '✧' : '✓';
  item.innerHTML = `<span class="toast-icon">${glyph}</span><div><strong>${esc(title)}</strong>${message ? `<p>${esc(message)}</p>` : ''}</div>`;
  $('toast-stack').append(item);
  while ($('toast-stack').children.length > 3) $('toast-stack').firstElementChild.remove();
  setTimeout(() => { item.classList.add('exit'); setTimeout(() => item.remove(), 300); }, type === 'wonder' ? 6500 : 3800);
}

function openModal(html, after) {
  $('modal-content').innerHTML = html;
  fillIcons($('modal-content'));
  if (!modal.open) modal.showModal();
  keys.clear(); touch.clear(); syncPause();
  after?.();
}
function closeModal() { modal.close(); syncPause(); }
$('modal-close').addEventListener('click', closeModal);
modal.addEventListener('close', syncPause);
modal.addEventListener('click', event => { if (event.target === modal) { const rect = modal.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal(); } });

function showHelp() {
  openModal(`<p class="modal-eyebrow">FIELD GUIDE / 01</p><h2 class="modal-title">你的深海第一课</h2><p class="modal-description">驾驶潜艇靠近闪光的生物和矿物，带回样本，让下一次下潜再深一点。</p><div class="help-grid"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>驾驶潜艇 · 也可使用方向键</span><span><kbd>E</kbd> / 点击捕获</span><span>捕获最近的生物 / 采集合金矿物</span><span><kbd>Q</kbd></span><span>发射声呐 · 短暂照亮更远的海域</span><span><kbd>SHIFT</kbd></span><span>加速推进 · 更快消耗电量</span><span><kbd>R</kbd></span><span>随时安全返航 · 结算样本并补满电量</span><span><kbd>F</kbd></span><span>鲸落号释放 / 接驳萤蛾号子艇</span><span><kbd>SPACE</kbd> / <kbd>ESC</kbd></span><span>暂停 / 继续航行</span></div><div class="help-note">不需要管理氧气或饥饿。只需留意电量、样本负载和耐压深度。完成委托可领取奖励；回港后建造、改装载具，科研解锁永久基因能力。触屏设备可使用画面左下角方向键。</div><div class="modal-footer"><span>离开页面会自动保存，重开时安全回港。</span><button class="primary-button" id="help-done">准备好了 ↓</button></div>`, () => $('help-done').addEventListener('click', closeModal));
}
$('help-button').addEventListener('click', showHelp);
$('log-button').addEventListener('click', showHelp);

function showLog() {
  openModal(`<p class="modal-eyebrow">YOUR OCEAN JOURNAL</p><h2 class="modal-title">每一米，都算数。</h2><p class="modal-description">探索者 Lv.${game.level} · ${rankName()}</p><ul class="log-list"><li><span>已完成航次</span><b>${number(game.totalDives)} 次</b></li><li><span>最深足迹</span><b>${number(game.maxDepth)} m</b></li><li><span>生物样本</span><b>${number(game.totalCaptures)} 份</b></li><li><span>图鉴收录</span><b>${game.discoveries.length} / ${SPECIES.length}</b></li><li><span>奇观发现</span><b>${game.wonders.filter(w => w.discovered).length} / ${WONDERS.length}</b></li><li><span>永久基因</span><b>${game.researched.length} / ${GENES.length}</b></li><li><span>拥有载具</span><b>${game.ownedVehicles.length} / ${Object.keys(VEHICLES).length}</b></li></ul><div class="modal-footer"><button class="danger-button" id="reset-request">清除存档，重新启航</button><button class="primary-button" id="log-done">继续探索 ↗</button></div>`, () => {
    $('log-done').addEventListener('click', closeModal);
    $('reset-request').addEventListener('click', () => openModal(`<p class="modal-eyebrow">NEW EXPEDITION</p><h2 class="modal-title">重新开始航程？</h2><p class="modal-description">这将清除本机保存的载具、科研、图鉴和探索记录，无法恢复。</p><div class="modal-footer"><button class="text-button" id="reset-cancel">保留我的航程</button><button class="primary-button" id="reset-confirm">确认清除并重新启航</button></div>`, () => { $('reset-cancel').addEventListener('click', showLog); $('reset-confirm').addEventListener('click', () => { closeModal(); manuallyPaused = false; game.reset(); setView('explore'); }); }));
  });
}
$('level-button').addEventListener('click', showLog);
$('discovery-teaser').addEventListener('click', () => setView('codex'));

function showMissions() {
  openModal(`<p class="modal-eyebrow">EXPEDITION BOARD</p><h2 class="modal-title">总有新的小目标。</h2><p class="modal-description">探索、采集、科研随时切换。完成委托后领取奖励，下一项挑战就会出现。</p><div class="mission-list">${game.missions.map(mission => `<article><div><h3>${mission.title}</h3><p>${mission.description} · ${number(mission.progress)} / ${number(mission.target)}</p><small>奖励 ${mission.reward.credits} 信用点 · ${mission.reward.alloy} 合金 · ${mission.reward.research} 科研点</small></div><button class="card-button" data-mission-claim="${mission.id}" ${mission.progress < mission.target ? 'disabled' : ''}>${mission.progress >= mission.target ? '领取奖励 ↗' : '进行中'}</button></article>`).join('')}</div><div class="modal-footer"><span>所有委托均可在多次航行中累计完成。</span><button class="primary-button" id="missions-done">继续航行 ↓</button></div>`, () => {
    $('missions-done').addEventListener('click', closeModal);
    document.querySelectorAll('[data-mission-claim]').forEach(button => button.addEventListener('click', () => { game.claimMission(button.dataset.missionClaim); showMissions(); }));
  });
}
const missionTop = $('mission-card').querySelector('.mission-top');
const missionOpen = document.createElement('button');
missionOpen.className = 'mission-open'; missionOpen.title = '查看全部委托'; missionOpen.setAttribute('aria-label', '查看全部航行委托'); missionOpen.textContent = '↗';
missionOpen.addEventListener('click', event => { event.stopPropagation(); showMissions(); });
missionTop.append(missionOpen);

function showReturn(expedition) {
  openModal(`<p class="modal-eyebrow">EXPEDITION ${String(game.totalDives).padStart(3, '0')} / COMPLETE</p><h2 class="modal-title">${expedition.emergency ? '牵引完成，平安归来。' : '带着奇遇，回家。'}</h2><p class="modal-description">本次最深抵达 ${number(expedition.deepest)} 米，所有样本已安全入库。电池充满，艇壳已修复。</p><div class="summary-grid"><div><strong>+${number(expedition.credits)}</strong><span>信用点</span></div><div><strong>+${number(expedition.research)}</strong><span>科研点</span></div><div><strong>+${number(expedition.alloy)}</strong><span>合金</span></div></div><div class="help-note">采集 ${expedition.captures} 份生物样本 · 航行 ${Math.max(1, Math.round(expedition.duration))} 秒。用收获改装载具、研究基因，或继续完成新的航行委托。</div><div class="modal-footer"><button class="text-button" id="return-explore">补给完毕，再次下潜 ↓</button><button class="primary-button" id="return-hangar">进入船坞 ↗</button></div>`, () => {
    $('return-explore').addEventListener('click', () => { closeModal(); manuallyPaused = false; setView('explore'); game.launch(); updateHUD(); });
    $('return-hangar').addEventListener('click', () => { closeModal(); setView('hangar'); });
  });
}

game.onEvent = event => {
  if (event.type === 'zone') {
    $('zone-announcement').querySelector('strong').textContent = event.zone.name;
    $('zone-announcement').querySelector('p').textContent = event.message;
    $('zone-announcement').classList.add('show');
    clearTimeout(announcementTimer); announcementTimer = setTimeout(() => $('zone-announcement').classList.remove('show'), 3800);
  } else if (event.type === 'return') { showReturn(event.expedition); }
  else if (event.type !== 'sonar') toast(event.title, event.message, event.type);
  const soundTypes = { capture: 'capture', discovery: 'discovery', sonar: 'sonar', upgrade: 'upgrade', research: 'upgrade', craft: 'upgrade', level: 'level', warning: 'warning', wonder: 'discovery', collection: 'level', mission: 'level', return: 'return', launch: 'launch', vehicle: 'click' };
  if (soundTypes[event.type]) audio.play(soundTypes[event.type]);
  if (event.x != null) renderer.fx?.(event.type, event.x, event.y);
  if (event.type === 'wonder') {
    $('discovery-teaser-text').textContent = event.title.replace('奇观发现 · ', '已发现 · ');
    if (event.wonderId === 'last_light') queueMicrotask(() => openModal(`<p class="modal-eyebrow">THE END OF THE OCEAN / A NEW BEGINNING</p><h2 class="modal-title">你抵达了海洋的尽头。</h2><p class="modal-description">一万米之下，地裂里的蓝色微光照亮了你的潜艇。从第一只玻璃鳍鱼，到世界尽头的光——这片海洋，现在记得你。</p><div class="summary-grid"><div><strong>${number(game.maxDepth)}</strong><span>最深足迹 / 米</span></div><div><strong>${game.discoveries.length}/${SPECIES.length}</strong><span>已识生物</span></div><div><strong>${game.wonders.filter(w => w.discovered).length}/${WONDERS.length}</strong><span>发现的奇观</span></div></div><div class="help-note">主线探索已完成。仍有未知生物、未完成的基因和图鉴奖励等待收集。你可以继续自由航行。</div><div class="modal-footer"><span>保持好奇。下一次奇遇，仍在深处。</span><button class="primary-button" id="ending-continue">继续探索 ✧</button></div>`, () => $('ending-continue').addEventListener('click', closeModal)));
  }
  if (['capture','discovery','research','upgrade','craft','vehicle','mission','collection','reset','return'].includes(event.type)) {
    if (view !== 'explore') queueMicrotask(renderView);
  }
  // Events may fire in the middle of an engine transaction; update after it finishes.
  queueMicrotask(() => { updateHUD(); syncPause(); });
};

function rankName() { return game.level < 4 ? '新晋潜航员' : game.level < 8 ? '海洋探索者' : game.level < 14 ? '深海领航员' : '冥渊先行者'; }
function updateHUD() {
  const stats = game.stats;
  const zoneIndex = ZONES.indexOf(game.zone);
  const battery = game.batteryPercent;
  $('credits').textContent = number(game.resources.credits);
  $('research-points').textContent = number(game.resources.research);
  $('level-button').textContent = pad(game.level);
  $('codex-count').textContent = game.discoveries.length;
  $('dive-number').textContent = String(game.totalDives + (game.docked ? 0 : 1)).padStart(3, '0');
  $('zone-index').textContent = pad(zoneIndex + 1);
  $('zone-name').textContent = game.zone.name;
  $('zone-english').textContent = zoneEnglish[zoneIndex];
  $('depth-value').textContent = number(game.player.y);
  $('vehicle-name').textContent = VEHICLES[game.vehicle].name;
  $('vehicle-tag').textContent = { moth: 'SCOUT / 01', ray: 'SCIENCE / 02', whale: 'CARRIER / 03' }[game.vehicle];
  $('battery-value').innerHTML = `${Math.ceil(battery)}<span>%</span>`;
  $('battery-bar').style.width = `${battery}%`;
  $('battery-bar').style.background = battery < 20 ? 'var(--red)' : 'var(--mint)';
  $('cargo-value').innerHTML = `${game.cargoWeight} <em>/ ${stats.cargo} kg</em>`;
  $('cargo-bar').style.width = `${game.cargoWeight / stats.cargo * 100}%`;
  const pressure = game.player.y > stats.maxDepth;
  $('pressure-status').classList.toggle('danger', pressure);
  $('pressure-status').innerHTML = `<span class="status-dot"></span>${pressure ? `超压 · 艇壳 ${Math.ceil(game.hull)}%` : game.hull < 100 ? `艇壳 ${Math.ceil(game.hull)}%` : '船体稳定'}<span>耐压 ${number(stats.maxDepth)} m</span>`;
  document.querySelectorAll('.depth-zone').forEach((el, index) => el.classList.toggle('active', index === zoneIndex));
  const fraction = (game.player.y - game.zone.min) / (game.zone.max - game.zone.min);
  $('depth-marker').style.top = `${9 + zoneIndex * 18 + fraction * 18}%`;
  const complete = game.missions.find(m => m.progress >= m.target);
  const mission = complete || game.missions.find(m => m.id === selectedMission) || game.missions[0];
  if (mission) {
    $('mission-title').textContent = mission.title;
    $('mission-description').textContent = mission.description;
    $('mission-progress').textContent = `${number(mission.progress)} / ${number(mission.target)}`;
    $('mission-bar').style.width = `${Math.min(100, mission.progress / mission.target * 100)}%`;
    $('mission-count').textContent = `${pad(game.missions.indexOf(mission) + 1)} / ${pad(game.missions.length)}`;
    $('claim-mission').hidden = mission.progress < mission.target;
    $('claim-mission').dataset.mission = mission.id;
    $('claim-mission').innerHTML = `领取 ${mission.reward.credits} 信用点 + 材料 <span>↗</span>`;
  }
  const target = game.nearestTarget;
  const ready = Boolean(target && !game.docked && !game.paused);
  $('target-prompt').classList.toggle('ready', ready);
  $('target-prompt').querySelector('span').textContent = ready ? `${target.type === 'mineral' ? '采集' : '捕获'} ${target.speciesId ? game.getSpecies(target.speciesId).name : '深海合金'}` : '靠近生物，即可捕获';
  if (ready !== lastReady) { $('capture-button').classList.toggle('ready', ready); lastReady = ready; }
  $('sonar-label').textContent = game.sonar.cooldown > 0 ? `充能 ${Math.ceil(game.sonar.cooldown)}s` : '声呐探测';
  $('sonar-button').disabled = game.sonar.cooldown > 0 || game.docked;
  $('capture-button').disabled = game.docked;
  $('return-button').disabled = game.docked;
  $('deploy-button').hidden = game.vehicle !== 'whale' && !game.deployed;
  $('deploy-button').querySelector('span:not([data-icon])').textContent = game.deployed ? '接驳母舰' : '部署子艇';
  $('deploy-button').disabled = game.docked;
  $('level-badge').textContent = pad(game.level);
  $('rank-name').textContent = rankName();
  $('xp-bar').style.width = `${game.xp / game.xpToNextLevel * 100}%`;
  $('xp-label').textContent = `${number(game.xp)} / ${number(game.xpToNextLevel)} XP`;
  $('trip-captures').innerHTML = `${pad(game.expedition.captures)}<small>只</small>`;
  $('record-depth').innerHTML = `${number(game.maxDepth)}<small>m</small>`;
  $('species-count').innerHTML = `${pad(game.discoveries.length)}<small>/ ${SPECIES.length}</small>`;
  $('pause-button').innerHTML = svg(manuallyPaused ? 'play' : 'pause');
  $('pause-button').setAttribute('aria-label', manuallyPaused ? '继续航行' : '暂停航行');
  $('screen-state').hidden = !game.docked && !manuallyPaused;
  if (game.docked || manuallyPaused) {
    $('state-eyebrow').textContent = game.docked ? 'WELCOME HOME' : 'TAKE A BREATH';
    $('state-title').textContent = game.docked ? '已返回浮岛基地' : '海洋会等你一会儿';
    $('state-description').textContent = game.docked ? '补满电量，准备下一次奇遇。' : '航行已暂停。慢慢来，奇遇不会错过。';
    $('state-action').innerHTML = game.docked ? '再次下潜 <span>↓</span>' : '继续探索 <span>→</span>';
    $('state-secondary').hidden = !game.docked;
  }
}

$('mission-card').addEventListener('click', event => {
  if (event.target.closest('#claim-mission')) { game.claimMission($('claim-mission').dataset.mission); updateHUD(); }
  else { const index = game.missions.findIndex(m => m.id === selectedMission); selectedMission = game.missions[(index + 1) % game.missions.length]?.id; updateHUD(); }
});
$('mission-card').title = '点击切换航行委托';
$('capture-button').addEventListener('click', () => game.capture());
$('sonar-button').addEventListener('click', () => game.scan());
$('return-button').addEventListener('click', () => game.returnToBase());
$('deploy-button').addEventListener('click', () => game.deploySub());
$('sound-button').addEventListener('click', () => {
  const enabled = audio.toggle();
  $('sound-button').innerHTML = svg(enabled ? 'sound' : 'mute');
  $('sound-button').classList.toggle('enabled', enabled);
  $('sound-button').title = enabled ? '关闭声音' : '开启声音';
  $('sound-button').setAttribute('aria-label', enabled ? '关闭声音' : '开启声音');
  if (enabled) audio.play('sonar');
});
function togglePause() { if (view !== 'explore' || modal.open || game.docked) return; manuallyPaused = !manuallyPaused; keys.clear(); touch.clear(); syncPause(); updateHUD(); }
$('pause-button').addEventListener('click', togglePause);
$('state-action').addEventListener('click', () => { manuallyPaused = false; if (game.docked) game.launch(); syncPause(); updateHUD(); });
$('state-secondary').addEventListener('click', () => setView('hangar'));

function renderView() {
  if (view === 'hangar') renderHangar();
  if (view === 'research') renderResearch();
  if (view === 'codex') renderCodex();
}

function renderHangar() {
  const root = $('hangar-view');
  root.innerHTML = `<div class="section-heading"><div><h2>你的深海舰队</h2><p>${game.docked ? '浮岛基地已接驳。所有通用改装会同步至整支舰队。' : '探索已暂停。返回基地后可建造载具、切换驾驶和安装改装。'}</p></div><span>◇ ${number(game.resources.alloy)} 合金${!game.docked ? ' <button class="filter-chip" data-port>返回基地 ↗</button>' : ' · PORT CONNECTED'}</span></div><div class="fleet-grid">${Object.values(VEHICLES).map(vehicle => {
    const owned = game.ownedVehicles.includes(vehicle.id); const selected = game.vehicle === vehicle.id || (game.deployed && vehicle.id === 'whale');
    return `<article class="fleet-card ${selected ? 'selected' : ''}"><div class="fleet-art"><span class="fleet-tag">${{ moth: '01 / LIGHT SCOUT', ray: '02 / RESEARCH CRUISER', whale: '03 / DEEPSEA CARRIER' }[vehicle.id]}</span>${owned ? `<span class="fleet-status">${selected ? '当前驾驶' : '已加入舰队'}</span>` : ''}<canvas data-vehicle="${vehicle.id}" width="220" height="100"></canvas></div><div class="fleet-content"><div class="fleet-title"><h3>${vehicle.name}</h3><span>${vehicle.tag}</span></div><p>${vehicle.description}</p><div class="fleet-specs"><div>安全深度<b>${number(vehicle.maxDepth + game.upgrades.hull * 900)}<small>m</small></b></div><div>电池容量<b>${vehicle.battery + game.upgrades.battery * 65}<small>kWh</small></b></div><div>舱内负载<b>${vehicle.cargo + game.upgrades.cargo * 8 + (game.researched.includes('elastic') ? 10 : 0)}<small>kg</small></b></div></div><button class="card-button ${selected ? 'purchased' : ''}" data-fleet="${vehicle.id}" ${selected || !game.docked || (!owned && !game.canAfford(vehicle.cost)) ? 'disabled' : ''}><span>${selected ? '已准备就绪' : owned ? '切换至此载具' : '建造载具'}</span><span>${owned ? (selected ? '✓' : '↗') : `${vehicle.cost.credits} 信用点 · ${vehicle.cost.alloy} 合金`}</span></button></div></article>`;
  }).join('')}</div><div class="section-heading upgrades-heading"><div><h2>小改装，大不同</h2><p>升级即时生效，所有载具共享模块。</p></div><span>FLEET UPGRADES</span></div><div class="upgrades-grid">${UPGRADES.map(upgrade => {
    const level = game.upgrades[upgrade.id]; const cost = game.getUpgradeCost(upgrade.id); const maxed = level >= upgrade.maxLevel;
    return `<article class="upgrade-card"><div class="upgrade-top"><span class="upgrade-icon">${svg({ hull: 'shield', battery: 'battery', cargo: 'box', thruster: 'speed' }[upgrade.id])}</span><div><h3>${upgrade.name}</h3><div class="upgrade-levels">${'▰'.repeat(level)}${'▱'.repeat(upgrade.maxLevel - level)} <span>MK.${level}</span></div></div></div><p>${upgrade.description}</p><button class="card-button" data-upgrade="${upgrade.id}" ${maxed || !game.docked || !game.canAfford(cost) ? 'disabled' : ''}><span>${maxed ? '改装已满级' : '升级'}</span><span>${maxed ? 'MAX' : `${cost.credits} 信用 · ${cost.alloy} 合金`}</span></button></article>`;
  }).join('')}</div>${game.docked ? '<div class="section-heading upgrades-heading"><p>一切就绪。新的海域正等着你。</p><button class="primary-button" id="hangar-launch">出发，继续下潜 ↓</button></div>' : ''}`;
  root.querySelectorAll('[data-vehicle]').forEach(canvas => drawVehicle(canvas, canvas.dataset.vehicle));
  root.querySelectorAll('[data-fleet]').forEach(button => button.addEventListener('click', () => { const id = button.dataset.fleet; if (game.ownedVehicles.includes(id)) game.selectVehicle(id); else game.craftVehicle(id); renderHangar(); updateHUD(); }));
  root.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => { game.upgrade(button.dataset.upgrade); renderHangar(); updateHUD(); }));
  root.querySelector('[data-port]')?.addEventListener('click', () => game.returnToBase());
  $('hangar-launch')?.addEventListener('click', () => { manuallyPaused = false; setView('explore'); game.launch(); updateHUD(); });
}

function renderResearch() {
  const root = $('research-view');
  root.innerHTML = `<div class="lab-banner"><span>${svg('dna')}</span><div><h3>亿万年的进化，现在为你所用。</h3><p>捕获对应生物，即可使用科研点解锁永久能力。基因适应会应用于全部载具。</p></div><div class="lab-count">${game.researched.length}<small>/ ${GENES.length} 已融合</small></div></div><div class="section-heading"><div><h2>基因适应计划</h2><p>样本提供灵感，科研带来改变。返航后获得本次采集的科研点。</p></div><span>◈ ${number(game.resources.research)} 科研点</span></div><div class="genes-grid">${GENES.map(gene => {
    const species = game.getSpecies(gene.speciesId); const discovered = game.discoveries.includes(gene.speciesId); const done = game.researched.includes(gene.id);
    return `<article class="gene-card ${done ? 'done' : ''} ${!discovered ? 'locked' : ''}"><div class="gene-top"><canvas width="120" height="90" data-specimen="${gene.speciesId}"></canvas><div><h3>${gene.name}</h3><p>源自 · ${species.name}</p></div></div><p class="gene-description">${gene.description}</p><div class="gene-unlock">${done ? '✓ 已永久融合至全部载具' : discovered ? `✓ ${species.name}样本已取得` : `○ 前往${ZONES.find(zone => zone.id === species.zone).name}捕获${species.name}`}</div><button class="card-button ${done ? 'purchased' : ''}" data-gene="${gene.id}" ${done || !discovered || game.resources.research < gene.cost ? 'disabled' : ''}><span>${done ? '基因适应已激活' : !discovered ? '等待生物样本' : game.resources.research < gene.cost ? '科研点不足' : '开始基因研究'}</span><span>${done ? 'ACTIVE' : `${gene.cost} 科研点`}</span></button></article>`;
  }).join('')}</div>`;
  root.querySelectorAll('[data-specimen]').forEach(canvas => drawSpecimen(canvas, canvas.dataset.specimen));
  root.querySelectorAll('[data-gene]').forEach(button => button.addEventListener('click', () => { game.research(button.dataset.gene); renderResearch(); updateHUD(); }));
}

function renderCodex() {
  const root = $('codex-view');
  const reward = game.collectionReward;
  const filtered = SPECIES.filter(species => filter === 'all' || species.zone === filter || (filter === 'found' && game.discoveries.includes(species.id)));
  root.innerHTML = `<div class="section-heading"><div><h2>一片海洋，${SPECIES.length} 种相遇</h2><p>收集样本并记录深海奇观。巨型生物仅采集自然脱落的活性组织。</p></div><span>${game.discoveries.length} / ${SPECIES.length} DISCOVERED</span></div><div class="codex-toolbar"><div class="filter-chips"><button class="filter-chip ${filter === 'all' ? 'active' : ''}" data-filter="all">全部生物</button>${ZONES.map(zone => `<button class="filter-chip ${filter === zone.id ? 'active' : ''}" data-filter="${zone.id}">${zone.name}</button>`).join('')}<button class="filter-chip ${filter === 'found' ? 'active' : ''}" data-filter="found">已发现</button></div><button class="collection-button" id="collection-claim" ${!reward.available ? 'disabled' : ''}>${reward.claimed ? '✓ 全部收集奖励已领取' : reward.available ? `✧ 领取 ${reward.target} 种收集奖励 ↗` : `✧ 收集奖励 ${game.discoveries.length} / ${reward.target}`}</button></div><div class="specimen-grid">${filtered.map(species => {
    const found = game.discoveries.includes(species.id);
    return `<button class="specimen-card ${found ? '' : 'unknown'}" data-species="${species.id}" aria-label="${found ? species.name : '未发现生物'}"><div class="specimen-art"><canvas width="160" height="120" data-specimen="${species.id}"></canvas></div><div class="specimen-info"><h3>${found ? species.name : '未知的相遇'}</h3><div><span>${ZONES.find(zone => zone.id === species.zone).name}</span><span class="rarity-mark">${found ? species.rarity === '传说' ? '✦ 传说' : species.rarity === '珍奇' ? '✧ 珍奇' : species.rarity === '稀有' ? '◇ 稀有' : '· 常见' : '???'}</span></div></div></button>`;
  }).join('') || '<div class="empty-state">这里还很安静。下潜，带回你的第一个发现。</div>'}</div><div class="section-heading wonders-heading"><div><h2>值得停下来的瞬间</h2><p>靠近奇观即可记录。声呐可以帮助你发现远处的秘密。</p></div><span>${game.wonders.filter(w => w.discovered).length} / ${WONDERS.length} WONDERS</span></div><div class="wonders-grid">${game.wonders.map((wonder, index) => `<article class="wonder-card ${wonder.discovered ? '' : 'locked'}"><span class="wonder-symbol">${['⌒','✧','♜','☾','♨','◎','✦'][index]}</span><div><h3>${wonder.discovered ? wonder.name : '尚未抵达的奇遇'}</h3><p>${wonder.discovered ? wonder.description : `${ZONES.find(zone => zone.id === wonder.zone).name} · ${number(wonder.y)} 米附近，等待你的灯光。`}</p></div></article>`).join('')}</div>`;
  root.querySelectorAll('[data-specimen]').forEach(canvas => drawSpecimen(canvas, canvas.dataset.specimen));
  root.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; renderCodex(); }));
  root.querySelectorAll('[data-species]').forEach(button => button.addEventListener('click', () => showSpecimen(button.dataset.species)));
  $('collection-claim').addEventListener('click', () => { game.claimCollection(); renderCodex(); updateHUD(); });
}

function showSpecimen(id) {
  const species = game.getSpecies(id); const found = game.discoveries.includes(id); const zone = ZONES.find(item => item.id === species.zone);
  openModal(`<p class="modal-eyebrow">OCEAN ARCHIVE / ${pad(SPECIES.indexOf(species) + 1)}</p><h2 class="modal-title">${found ? species.name : '还未相识的生命'}</h2><div class="specimen-modal-art"><canvas width="230" height="150" id="modal-specimen" ${found ? '' : 'style="filter:brightness(.25)"'}></canvas></div><p class="modal-description">${found ? species.description : `在${zone.name}，有一个小小的秘密正等着你。将潜艇开近它，按 E 带回第一份样本。`}</p><div class="specimen-facts"><span>栖息海域<b>${zone.name}</b></span><span>采集负载<b>${found ? species.weight : '?'} kg</b></span><span>稀有程度<b>${found ? species.rarity : '未知'}</b></span></div>${found ? `<div class="help-note">${species.ability}<br>已采集 ${game.captureCounts[id] || 0} 份 · 每份 ${species.value} 信用点 / ${species.research} 科研点</div>` : `<div class="help-note">栖息深度 ${number(zone.min)} – ${number(zone.max)} 米。升级耐压艇壳，可以让探索更安全。</div>`}`, () => drawSpecimen($('modal-specimen'), id));
}

const controlKeys = new Set(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','shift','e','q','r','f',' ','escape']);
window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  const key = event.key.toLowerCase();
  if (!controlKeys.has(key)) return;
  if (modal.open) return;
  if (view !== 'explore') { if (key === 'escape') { event.preventDefault(); setView('explore'); } return; }
  event.preventDefault();
  keys.add(key); audio.resume();
  if (event.repeat) return;
  if (key === ' ' || key === 'escape') togglePause();
  if (game.paused || game.docked) return;
  if (key === 'e') game.capture();
  if (key === 'q') game.scan();
  if (key === 'r') game.returnToBase();
  if (key === 'f') game.deploySub();
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); touch.clear(); if (view === 'explore' && !game.docked && !modal.open) manuallyPaused = true; syncPause(); updateHUD(); });
document.addEventListener('visibilitychange', () => { keys.clear(); touch.clear(); syncPause(); if (document.hidden) game.save(); });
window.addEventListener('pagehide', () => game.save());
document.querySelectorAll('[data-direction]').forEach(button => {
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); touch.add(button.dataset.direction); audio.resume(); });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name, () => touch.delete(button.dataset.direction));
});
$('ocean').addEventListener('pointerdown', event => { if (event.pointerType === 'mouse') $('ocean').focus({ preventScroll: true }); audio.resume(); });

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, .1); lastFrame = now;
  const input = { x: Number(keys.has('d') || keys.has('arrowright') || touch.has('right')) - Number(keys.has('a') || keys.has('arrowleft') || touch.has('left')), y: Number(keys.has('s') || keys.has('arrowdown') || touch.has('down')) - Number(keys.has('w') || keys.has('arrowup') || touch.has('up')), boost: keys.has('shift') };
  game.update(dt, input);
  if (view === 'explore') renderer.render(game, now / 1000);
  hudElapsed += dt;
  if (hudElapsed >= .1) { hudElapsed = 0; updateHUD(); audio.setDepth(game.player.y); }
  requestAnimationFrame(frame);
}
updateHUD(); syncPause(); requestAnimationFrame(frame);
// A compact nudge keeps the first dive playable without a blocking tutorial.
setTimeout(() => { if (!game.docked && game.totalCaptures === 0) toast('潜航系统已就绪', 'WASD 驾驶 · E 捕获 / 采集 · Q 声呐 · R 安全返航'); }, 1200);
