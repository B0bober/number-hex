import test from 'node:test';
import assert from 'node:assert/strict';
import { MODES, newGame, nextValue, openNeighbors, placeTile, validateGame, hexToPixel, pixelToHex } from '../dist/engine.js';

test('sum of two uses the ones digit, including wraparound and zero', () => {
  let game = newGame('sum2', [8, 7]);
  assert.equal(nextValue(game.tiles, game.mode).digit, 5);
  game = placeTile(game, 2, 0, 5).game;
  assert.equal(nextValue(game.tiles, game.mode).digit, 2);
  assert.equal(nextValue(newGame('sum2', [3, 7]).tiles, 'sum2').digit, 0);
});
test('sum of three uses all three most recent digits', () => {
  const game = newGame('sum3', [9, 8, 7]);
  assert.deepEqual(nextValue(game.tiles, game.mode), { values: [9, 8, 7], total: 24, digit: 4 });
  const result = placeTile(game, 3, 0, 4);
  assert.equal(result.ok, true);
  assert.equal(nextValue(result.game.tiles, 'sum3').digit, 9);
});
test('multiplication uses the final digit and allows an all-zero continuation', () => {
  let game = newGame('product', [7, 8]);
  assert.equal(nextValue(game.tiles, 'product').digit, 6);
  game = newGame('product', [5, 2]);
  game = placeTile(game, 2, 0, 0).game;
  game = placeTile(game, 3, 0, 0).game;
  assert.equal(nextValue(game.tiles, 'product').digit, 0);
});
test('rejects wrong arithmetic, occupied cells, disconnected cells, and invalid digits', () => {
  const game = newGame();
  for (const [q, r, v] of [[2, 0, 8], [0, 0, 7], [5, 0, 7], [2, 0, -1], [2.2, 0, 7], [2, 0, NaN]]) assert.equal(placeTile(game, q, r, v).ok, false);
  assert.equal(game.tiles.length, 2);
});
test('turns can touch other tiles without changing the chronological rule', () => {
  let game = newGame();
  game = placeTile(game, 1, -1, 7).game;
  assert.ok(game);
  assert.equal(nextValue(game.tiles, 'sum2').digit, 1);
  assert.equal(placeTile(game, 0, -1, 1).ok, true);
});
test('all six directions work and occupied neighbors are excluded', () => {
  const game = newGame();
  const neighbors = openNeighbors(game.tiles);
  assert.equal(neighbors.length, 5);
  for (const t of neighbors) assert.equal(placeTile(game, t.q, t.r, 7).ok, true);
});
test('a path can grow beyond a fixed board and survive a save round trip', () => {
  for (const mode of Object.keys(MODES)) {
    let game = newGame(mode);
    for (let i = 0; i < 1200; i++) {
      const result = placeTile(game, game.tiles.at(-1).q + 1, 0, nextValue(game.tiles, mode).digit);
      assert.equal(result.ok, true); game = result.game;
    }
    assert.ok(game.tiles.at(-1).q > 1200);
    assert.deepEqual(validateGame(JSON.parse(JSON.stringify(game)), mode), game);
  }
});
test('saved data is checked for arithmetic, duplicate cells, origin, and adjacency', () => {
  const valid = placeTile(newGame(), 2, 0, 7).game;
  assert.ok(validateGame(valid, 'sum2'));
  for (const mutate of [g => { g.tiles[2].value = 9; }, g => { g.tiles[2].q = 0; }, g => { g.tiles[2].q = 5; }, g => { g.tiles[0].q = -1; }]) {
    const bad = structuredClone(valid); mutate(bad); assert.equal(validateGame(bad, 'sum2'), null);
  }
  assert.equal(validateGame({ mode: 'sum2', tiles: null }, 'sum2'), null);
});
test('hex coordinates round trip in every direction at large distances', () => {
  for (const [q, r] of [[0, 0], [1, -1], [-15, 4], [12000, -6001], [-40000, -9000]]) {
    const p = hexToPixel(q, r);
    assert.deepEqual(pixelToHex(p.x, p.y), { q, r });
  }
});
test('custom seeds require exactly the right number of single digits', () => {
  for (const [mode, seeds] of [['sum2', [3]], ['sum3', [3, 4]], ['product', [2, 10]], ['sum2', [NaN, 3]], ['nope', [3, 4]]]) assert.throws(() => newGame(mode, seeds));
});
