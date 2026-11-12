import { WONDERS } from './data.js';

// All collision, occlusion and rendering use this same metre-based geometry.
export const CANYON = { left: 90, right: 910, top: 12, bottom: 10980 };
export const VEHICLE_RADII = { moth: 8, ray: 22, whale: 34 };
export const CAVES = [
  { id: 'coral_hollow', name: '珊瑚密室', side: 'left', y: 440, entrance: { x: 110, y: 440 }, bounds: { left: 8, right: 76, top: 360, bottom: 520 }, throat: { left: 76, right: 120, top: 418, bottom: 462 }, rewardSkin: 'coral' },
  { id: 'echo_vault', name: '回声晶窟', side: 'right', y: 2400, entrance: { x: 890, y: 2400 }, bounds: { left: 924, right: 992, top: 2320, bottom: 2480 }, throat: { left: 880, right: 924, top: 2378, bottom: 2422 } },
  { id: 'ember_cleft', name: '熔光裂隙', side: 'left', y: 5300, entrance: { x: 110, y: 5300 }, bounds: { left: 8, right: 76, top: 5220, bottom: 5380 }, throat: { left: 76, right: 120, top: 5278, bottom: 5322 } },
];

export const HOTSPOTS = [
  ...WONDERS.map(wonder => ({ id: wonder.id, name: wonder.name, x: wonder.x, y: wonder.y, type: 'wonder' })),
  ...CAVES.map(cave => ({ id: cave.id, name: cave.name, ...cave.entrance, type: 'cave' })),
];

export const wallX = side => side === 'left' ? CANYON.left : CANYON.right;
export const insideRect = (x, y, rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
export const getCaveAt = (x, y) => CAVES.find(cave => insideRect(x, y, cave.bounds)) ?? null;

export function isWater(x, y, vehicleId = 'moth') {
  if (!Number.isFinite(x) || !Number.isFinite(y) || y < CANYON.top || y > CANYON.bottom) return false;
  if (x >= CANYON.left && x <= CANYON.right) return true;
  if (vehicleId !== 'moth') return false;
  return CAVES.some(cave => insideRect(x, y, cave.bounds) || insideRect(x, y, cave.throat));
}

export function worldCollision(x, y, vehicleId = 'moth') {
  const radius = VEHICLE_RADII[vehicleId] ?? VEHICLE_RADII.moth;
  if (!isWater(x, y, vehicleId)) return true;
  // Enough perimeter samples to reject squeezing diagonally around rock corners.
  for (let index = 0; index < 16; index++) {
    const angle = index * Math.PI / 8;
    if (!isWater(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, vehicleId)) return true;
  }
  return false;
}

export function hasLineOfSight(x1, y1, x2, y2) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6);
  for (let step = 0; step <= steps; step++) {
    const t = steps ? step / steps : 0;
    if (!isWater(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
  }
  return true;
}

export function moveWithCollision(player, dx, dy, vehicleId) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
  for (let step = 0; step < steps; step++) {
    if (!worldCollision(player.x + dx / steps, player.y, vehicleId)) player.x += dx / steps;
    if (!worldCollision(player.x, player.y + dy / steps, vehicleId)) player.y += dy / steps;
  }
  return player;
}
