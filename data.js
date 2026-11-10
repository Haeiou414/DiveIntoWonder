export const ZONES = [
  { id: 'sun', name: '日光带', min: 0, max: 200, color: '#123e52', accent: '#a3e6d5', description: '最后一缕日光，在珊瑚之间摇曳。' },
  { id: 'twilight', name: '暮光带', min: 200, max: 1000, color: '#102a43', accent: '#68cce5', description: '光线逐渐退场，另一种生命开始发亮。' },
  { id: 'midnight', name: '午夜带', min: 1000, max: 4000, color: '#101a35', accent: '#ae9afa', description: '永夜之中，每一次闪光都是一个秘密。' },
  { id: 'abyss', name: '深渊带', min: 4000, max: 6000, color: '#12172c', accent: '#ef9c8e', description: '大地的热息，为黑暗中的生命供能。' },
  { id: 'hadal', name: '冥渊带', min: 6000, max: 11000, color: '#0c1021', accent: '#e7c985', description: '抵达海洋的尽头，听见星球的心跳。' },
];

export const SPECIES = [
  { id: 'glassfish', name: '玻璃鳍鱼', zone: 'sun', color: '#81d7de', accent: '#e4fff4', kind: 'fish', size: 14, rarity: '常见', weight: 1, value: 32, research: 8, xp: 24, description: '透明鳞片折射出海面的碎光。它们总是好奇地靠近探照灯。', ability: '透明鳞片可用于研究低耗推进。' },
  { id: 'emberfin', name: '绯霞尾鱼', zone: 'sun', color: '#ffad78', accent: '#ffe2a4', kind: 'fish', size: 17, rarity: '常见', weight: 1, value: 42, research: 10, xp: 28, description: '尾鳍如同一小片尚未落下的晚霞。', ability: '高效肌束能提高推进速度。' },
  { id: 'moonjelly', name: '月光水母', zone: 'sun', color: '#d2a4ef', accent: '#f8d9ff', kind: 'jelly', size: 23, rarity: '稀有', weight: 2, value: 75, research: 18, xp: 42, description: '伞缘闪着淡紫色的光，像浮游的月亮。', ability: '发光蛋白可扩展探照视野。' },
  { id: 'ribbon_eel', name: '蓝缎海鳗', zone: 'twilight', color: '#69bee7', accent: '#f4dd86', kind: 'eel', size: 27, rarity: '常见', weight: 2, value: 68, research: 16, xp: 38, description: '身体像一条随水流摆动的蓝色丝带。', ability: '独特的肌肉结构可降低航行耗电。' },
  { id: 'lanternfish', name: '星灯鱼', zone: 'twilight', color: '#e7c36b', accent: '#fff0ab', kind: 'fish', size: 17, rarity: '常见', weight: 2, value: 80, research: 20, xp: 44, description: '腹部的光点组成了从未被命名的星座。', ability: '发光器能让探照灯看得更远。' },
  { id: 'umbrella_octopus', name: '绒伞章鱼', zone: 'twilight', color: '#f598ac', accent: '#ffd0bf', kind: 'octopus', size: 25, rarity: '稀有', weight: 3, value: 125, research: 28, xp: 58, description: '张开腕膜，像一把在海中缓缓降落的小伞。', ability: '柔韧腕膜能扩展样本舱容量。' },
  { id: 'ghost_shrimp', name: '幽蓝磷虾', zone: 'midnight', color: '#7fcaef', accent: '#d3faff', kind: 'shrimp', size: 15, rarity: '常见', weight: 2, value: 110, research: 22, xp: 52, description: '游动时洒落的荧光，在黑暗里留下转瞬即逝的轨迹。', ability: '外骨骼是轻质耐压材料的灵感。' },
  { id: 'crystal_jelly', name: '晶冠水母', zone: 'midnight', color: '#b4abff', accent: '#eff2ff', kind: 'jelly', size: 30, rarity: '稀有', weight: 3, value: 165, research: 35, xp: 70, description: '八条发光棱线在透明的伞体中缓慢脉动。', ability: '神经网络可以缩短声呐冷却。' },
  { id: 'vampire_squid', name: '赤幕幽灵蛸', zone: 'midnight', color: '#d96b88', accent: '#ffc4a4', kind: 'squid', size: 30, rarity: '稀有', weight: 4, value: 195, research: 42, xp: 82, description: '猩红的腕膜只是保护色。面对灯光，它会羞怯地收拢身体。', ability: '其耐压蛋白能增强艇壳。' },
  { id: 'gulper_eel', name: '巨口鳗', zone: 'midnight', color: '#92a2d8', accent: '#d4e1fb', kind: 'eel', size: 34, rarity: '珍奇', weight: 4, value: 220, research: 45, xp: 94, description: '看起来装得下整片海的嘴，实际只用来捕捉小虾。', ability: '可伸缩组织提升样本收纳效率。' },
  { id: 'abyss_ray', name: '深蓝蝶鳐', zone: 'abyss', color: '#8097e7', accent: '#b4f0eb', kind: 'ray', size: 42, rarity: '稀有', weight: 5, value: 280, research: 55, xp: 110, description: '宽阔的鳍像翅膀，无声掠过海底。', ability: '仿生鳍能让载具轻快滑行。' },
  { id: 'siphonophore', name: '银河管水母', zone: 'abyss', color: '#b2d9ec', accent: '#efffc4', kind: 'jelly', size: 46, rarity: '珍奇', weight: 5, value: 330, research: 65, xp: 130, description: '许多微小生命共同组成的发光长链，如同一段银河。', ability: '协同神经改善声呐效率。' },
  { id: 'yeti_crab', name: '雪绒雪人蟹', zone: 'abyss', color: '#e5d6ba', accent: '#fff5dc', kind: 'crab', size: 28, rarity: '常见', weight: 4, value: 245, research: 48, xp: 100, description: '它在热泉旁挥动毛茸茸的螯，培育自己的细菌花园。', ability: '热泉共生菌能回收少量电能。' },
  { id: 'dumbo', name: '小飞象章鱼', zone: 'hadal', color: '#e9b4bd', accent: '#ffe0c9', kind: 'octopus', size: 28, rarity: '稀有', weight: 5, value: 390, research: 70, xp: 145, description: '两片耳朵般的鳍轻轻扇动，竟然如此自在地生活在深渊。', ability: '深海酶赋予载具更强的耐压能力。' },
  { id: 'ghost_whale', name: '幽星鲸', zone: 'hadal', color: '#7d99c5', accent: '#d8edee', kind: 'whale', size: 64, rarity: '传说', weight: 9, value: 720, research: 120, xp: 230, description: '这是一枚自然脱落的活性组织样本。庞大的身影仍在远方游弋。', ability: '温和巨物的组织蕴含极强的修复能力。' },
  { id: 'hadal_snailfish', name: '冥渊狮子鱼', zone: 'hadal', color: '#e5c7d0', accent: '#ffede3', kind: 'fish', size: 24, rarity: '常见', weight: 4, value: 350, research: 65, xp: 130, description: '柔软、半透明，没有坚硬的鳞片，却能承受海洋最深处的压力。', ability: '细胞稳态机制能修复艇壳。' },
  { id: 'crown_jelly', name: '冥海王冠', zone: 'hadal', color: '#c491e3', accent: '#fbe1ad', kind: 'jelly', size: 40, rarity: '珍奇', weight: 6, value: 520, research: 95, xp: 185, description: '金色光点沿伞缘依次点亮，像一顶无人佩戴的王冠。', ability: '复合发光器揭示最远处的生命。' },
  { id: 'leviathan', name: '星渊巨鱿', zone: 'hadal', color: '#b695b3', accent: '#ecdbff', kind: 'squid', size: 70, rarity: '传说', weight: 10, value: 900, research: 150, xp: 300, description: '从触腕上收集到的非侵入式样本。它的眼睛倒映着你的整艘潜艇。', ability: '它是深海科研图鉴的最后一块拼图。' },
];

export const VEHICLES = {
  moth: { id: 'moth', name: '萤蛾号', tag: '轻型探索艇', description: '小巧灵活的第一位伙伴。轻快推进，适合精细采集；可搭载于鲸落号。', cost: { credits: 0, alloy: 0 }, maxDepth: 650, battery: 210, cargo: 16, speed: 125, vision: 235, captureRange: 120, color: '#eccb8a' },
  ray: { id: 'ray', name: '蝠鲼号', tag: '科研巡航艇', description: '更宽的声呐视野、更大的样本舱。捕捉范围增加，声呐耗电减半。', cost: { credits: 650, alloy: 10 }, maxDepth: 2600, battery: 300, cargo: 28, speed: 155, vision: 285, captureRange: 155, color: '#9acfd2' },
  whale: { id: 'whale', name: '鲸落号', tag: '深海母舰', description: '厚重而可靠的移动基地。可释放萤蛾号，母舰提供耐压保护与共享样本舱。', cost: { credits: 2200, alloy: 32 }, maxDepth: 6500, battery: 440, cargo: 54, speed: 100, vision: 260, captureRange: 145, color: '#a7accd' },
};

export const GENES = [
  { id: 'lumen', name: '生物荧光', speciesId: 'moonjelly', description: '将月光水母的荧光蛋白融入探照系统。视野增加 30%。', cost: 30, effect: '+30% 探照视野' },
  { id: 'streamline', name: '流线肌束', speciesId: 'emberfin', description: '仿生推进薄膜提升滑行效率。航行速度增加 15%。', cost: 25, effect: '+15% 航行速度' },
  { id: 'metabolism', name: '低耗代谢', speciesId: 'ribbon_eel', description: '研究海鳗的能量传递方式。持续耗电降低 25%。', cost: 55, effect: '−25% 持续耗电' },
  { id: 'elastic', name: '柔性收纳', speciesId: 'umbrella_octopus', description: '以柔韧腕膜构造样本舱。载重上限增加 10。', cost: 65, effect: '+10 样本载重' },
  { id: 'echo', name: '共振神经', speciesId: 'crystal_jelly', description: '让声呐像水母的神经一样灵敏。冷却减半，捕捉范围增加 25%。', cost: 95, effect: '声呐冷却减半 · +25% 捕捉范围' },
  { id: 'repair', name: '深海自愈', speciesId: 'hadal_snailfish', description: '稳定的细胞结构构成自愈涂层。在安全深度每秒修复 1% 艇壳。', cost: 150, effect: '安全深度自动修复' },
];

export const UPGRADES = [
  { id: 'hull', name: '耐压艇壳', description: '每级增加 900 米安全深度，所有载具共享。', maxLevel: 5, baseCost: { credits: 150, alloy: 4 } },
  { id: 'battery', name: '高密度电池', description: '每级增加 65 电量，探索更从容。', maxLevel: 4, baseCost: { credits: 120, alloy: 3 } },
  { id: 'cargo', name: '模块样本舱', description: '每级增加 8 载重，带回更多发现。', maxLevel: 4, baseCost: { credits: 100, alloy: 3 } },
  { id: 'thruster', name: '矢量推进器', description: '每级增加 15% 航行速度。', maxLevel: 4, baseCost: { credits: 130, alloy: 3 } },
];

export const WONDERS = [
  { id: 'coral_gate', name: '珊瑚之门', zone: 'sun', x: 720, y: 165, description: '千年珊瑚织成一道拱门，日光只在这里多停留一会儿。', color: '#df9ca8', reward: 80 },
  { id: 'moon_garden', name: '月光花园', zone: 'twilight', x: 290, y: 680, description: '成千上万只水母同时亮起。海洋在黑暗中，为自己点了一片星空。', color: '#c2a0f0', reward: 150 },
  { id: 'lost_station', name: '沉眠观测站', zone: 'midnight', x: 690, y: 1900, description: '生锈的天线依旧指向海面。一扇小窗里，有新的生命在发光。', color: '#91c6cf', reward: 240 },
  { id: 'whale_fall', name: '鲸落星河', zone: 'midnight', x: 350, y: 3600, description: '巨大的骨骼静静托起一整个生态。一个生命的终点，也是万千生命的开始。', color: '#b8d9d7', reward: 320 },
  { id: 'black_smoker', name: '深渊烟囱', zone: 'abyss', x: 710, y: 5100, description: '滚烫的矿物与冰冷海水相遇，生命从岩石的裂隙里生长。', color: '#ebaa7c', reward: 450 },
  { id: 'ancient_ring', name: '静默之环', zone: 'hadal', x: 380, y: 7600, description: '一座无法解释的巨大圆环，静止在海沟深处。你的灯光照不见它的另一端。', color: '#b2b8e9', reward: 650 },
  { id: 'last_light', name: '世界尽头的光', zone: 'hadal', x: 560, y: 10300, description: '地壳裂缝里涌出的蓝色微光，照亮了从未有日光抵达的地方。你来到这里。', color: '#91f3de', reward: 1000 },
];
