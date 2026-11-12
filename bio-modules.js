export const BIO_MODULES = [
  { id: 'lumen', name: '折光膜', color: '#a4e6de', description: '模拟生物光学结构，使探照灯照亮更远处。', levels: ['探照视野 +25%', '探照视野 +35%', '探照视野 +45%'], effects: [{ visionMultiplier: 1.25 }, { visionMultiplier: 1.35 }, { visionMultiplier: 1.45 }] },
  { id: 'flow', name: '喷流肌束', color: '#f0b58d', description: '将脉冲推进转化为持续的航行效率。', levels: ['航行速度 +12%', '航行速度 +18%', '航行速度 +24%'], effects: [{ speedMultiplier: 1.12 }, { speedMultiplier: 1.18 }, { speedMultiplier: 1.24 }] },
  { id: 'shell', name: '等压骨架', color: '#c2b2e9', description: '仿生层状结构分散深水压力。', levels: ['安全深度 +400 米', '安全深度 +650 米', '安全深度 +900 米'], effects: [{ depthBonus: 400 }, { depthBonus: 650 }, { depthBonus: 900 }] },
  { id: 'echo', name: '回声心核', color: '#99cbee', description: '延长声呐回波留存，缩短下一次探测的间隔。', levels: ['声呐 +2 秒 · 冷却 −15%', '声呐 +3 秒 · 冷却 −20%', '声呐 +4 秒 · 冷却 −25%'], effects: [{ sonarDuration: 2, sonarCooldownMultiplier: 0.85 }, { sonarDuration: 3, sonarCooldownMultiplier: 0.8 }, { sonarDuration: 4, sonarCooldownMultiplier: 0.75 }] },
  { id: 'repair', name: '自愈纤维', color: '#b6d897', description: '处于安全深度时，生物纤维缓慢修复艇壳。', levels: ['每秒修复 0.35% 艇壳', '每秒修复 0.60% 艇壳', '每秒修复 0.85% 艇壳'], effects: [{ repairRate: 0.35 }, { repairRate: 0.6 }, { repairRate: 0.85 }] },
];

export function getBioModuleEffect(id, level) {
  const module = BIO_MODULES.find(item => item.id === id);
  if (!module || !Number.isFinite(level) || level < 1) return {};
  return module.effects[Math.min(3, Math.floor(level)) - 1];
}
