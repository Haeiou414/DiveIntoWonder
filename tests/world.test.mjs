import test from 'node:test';
import assert from 'node:assert/strict';
import { CAVES, getCaveAt, hasLineOfSight, isWater, moveWithCollision, worldCollision } from '../world.js';

test('every cave has a real narrow entrance and the main canyon stays traversable', () => {
  for (const cave of CAVES) {
    const sign = cave.side === 'left' ? -1 : 1;
    for (const vehicle of ['moth', 'ray', 'whale']) {
      assert.equal(worldCollision(500, cave.y - 60, vehicle), false);
      assert.equal(worldCollision(500, cave.y + 60, vehicle), false);
    }
    const player = { ...cave.entrance };
    moveWithCollision(player, sign * 80, 0, 'moth');
    assert.equal(getCaveAt(player.x, player.y)?.id, cave.id);
    const medium = { x: cave.side === 'left' ? 160 : 840, y: cave.y };
    moveWithCollision(medium, sign * 150, 0, 'ray');
    assert.equal(getCaveAt(medium.x, medium.y), null);
    const wrongEntry = { x: cave.side === 'left' ? 130 : 870, y: cave.y - 60 };
    moveWithCollision(wrongEntry, sign * 100, 0, 'moth');
    assert.equal(getCaveAt(wrongEntry.x, wrongEntry.y), null);
  }
});

test('substep collision cannot tunnel through cave roof, floor or back wall at high speeds', () => {
  const cave = CAVES[0];
  const player = { x: 42, y: cave.y };
  moveWithCollision(player, -1000, 0, 'moth');
  assert.ok(player.x >= cave.bounds.left + 8);
  player.x = 42;
  moveWithCollision(player, 0, -1000, 'moth');
  assert.ok(player.y >= cave.bounds.top + 8);
  player.y = cave.y;
  moveWithCollision(player, 0, 1000, 'moth');
  assert.ok(player.y <= cave.bounds.bottom - 8);
});

test('rock occludes rays while the open cave throat preserves line of sight', () => {
  const cave = CAVES[0];
  assert.equal(hasLineOfSight(140, cave.y, 42, cave.y), true);
  assert.equal(hasLineOfSight(140, cave.y - 60, 42, cave.y - 60), false);
  assert.equal(isWater(83, cave.y - 60), false);
  assert.equal(isWater(83, cave.y), true);
  assert.equal(isWater(42, cave.y, 'ray'), false);
  assert.equal(isWater(42, cave.y, 'moth'), true);
});
