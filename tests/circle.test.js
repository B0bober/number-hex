import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, DIRECTIONS, triangleValid, generateRing, newRound, startRound, score, frontier, checkPlacement, playTile, refreshClock, timeLeft, chargeTime, swapHand, findMove, validateRound } from '../dist/engine.js';
const random = seed => () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
const round = (settings = {}) => startRound(newRound({ ...DEFAULT_SETTINGS, ...settings }, random(42)), 1000);
function legalMove(game) {
  const target = frontier(game.tiles).find(t => t.validDigits.length);
  assert.ok(target); return { ...target, digit: target.validDigits[0] };
}
function wrongMove(game) {
  const target = frontier(game.tiles).find(t => t.validDigits.length < 10);
  return { ...target, digit: Array.from({ length: 10 }, (_, i) => i).find(n => !target.validDigits.includes(n)) };
}

test('triangle addition is orientation independent and uses the ones digit', () => {
  for (const values of [[3, 4, 7], [7, 3, 4], [8, 7, 5], [0, 5, 5], [0, 0, 0]]) assert.equal(triangleValid(...values), true);
  assert.equal(triangleValid(3, 4, 8), false);
});
test('all ten centers get random rings with all six triangles valid, including closure', () => {
  const samples = new Set();
  for (let center = 0; center < 10; center++) for (let seed = 1; seed <= 80; seed++) {
    const ring = generateRing(center, random(seed));
    assert.equal(ring.length, 6);
    for (let i = 0; i < 6; i++) assert.ok(triangleValid(center, ring[i], ring[(i + 1) % 6]));
    if (center === 3) samples.add(ring.join(','));
  }
  assert.ok(samples.size > 10);
});
test('seven starting tiles, six hand tiles, zero score, and explicit start', () => {
  const ready = newRound();
  assert.equal(ready.tiles.length, 7); assert.equal(ready.hand.length, 6); assert.equal(score(ready), 0);
  assert.equal(timeLeft(ready, 90000), 180000);
  const result = playTile(ready, 2, -1, 0, random(4), 1000);
  assert.equal(result.ok, false); assert.equal(result.game.mistakes, 0); assert.equal(result.game.status, 'ready');
});
test('only spaces completing triangles appear; a single neighboring tile is insufficient', () => {
  const game = round();
  assert.equal(frontier(game.tiles).length, 6);
  assert.equal(checkPlacement(game.tiles, 2, 0, 4).ok, false);
  for (const t of frontier(game.tiles)) assert.ok(t.triangles.length >= 1);
});
test('a placement must satisfy every completed triangle, not just one', () => {
  const tiles = [3, 4, 5].map((value, i) => ({ q: DIRECTIONS[i][0], r: DIRECTIONS[i][1], value }));
  const invalid = checkPlacement(tiles, 0, 0, 7);
  assert.equal(invalid.ok, false); assert.equal(invalid.conflicts.length, 1);
  assert.equal(checkPlacement(tiles, 0, 0, 1).ok, true);
});
test('a successful move uses one hand slot, draws exactly one tile, and adds one point', () => {
  let game = round(); const target = legalMove(game); game.hand[2] = target.digit;
  const before = [...game.hand], result = playTile(game, target.q, target.r, 2, () => .99, 2000);
  assert.equal(result.ok, true); assert.equal(result.game.hand.length, 6); assert.equal(result.game.hand[2], 9);
  for (let i = 0; i < 6; i++) if (i !== 2) assert.equal(result.game.hand[i], before[i]);
  assert.equal(score(result.game), 1); assert.equal(game.tiles.length, 7); assert.equal(result.game.endsAt, 181000);
});
test('wrong tiles count as mistakes and leave both the board and hand intact', () => {
  const game = round(), target = wrongMove(game); game.hand[0] = target.digit;
  const result = playTile(game, target.q, target.r, 0, random(3), 2000);
  assert.equal(result.ok, false); assert.equal(result.game.mistakes, 1);
  assert.deepEqual(result.game.hand, game.hand); assert.deepEqual(result.game.tiles, game.tiles);
});
test('the third mistake ends a default round and prevents further moves', () => {
  let game = round(); const target = wrongMove(game); game.hand[0] = target.digit;
  for (let i = 0; i < 3; i++) game = playTile(game, target.q, target.r, 0, random(3), 2000).game;
  assert.equal(game.status, 'ended'); assert.equal(game.reason, 'mistakes'); assert.equal(game.mistakes, 3);
  assert.equal(playTile(game, target.q, target.r, 0, random(3), 3000).game.mistakes, 3);
});
test('absolute deadlines expire in background and cannot be bypassed by a late move or reload', () => {
  const game = round(), target = legalMove(game); game.hand[0] = target.digit;
  assert.equal(refreshClock(game, 180999).status, 'playing');
  assert.equal(refreshClock(game, 181000).status, 'ended');
  const restored = validateRound(JSON.parse(JSON.stringify(game)));
  const result = playTile(restored, target.q, target.r, 0, random(1), 181000);
  assert.equal(result.ok, false); assert.equal(result.game.reason, 'time'); assert.equal(score(result.game), 0);
});
test('hint and swap penalties deduct time; swaps keep six tiles; penalties can end a round', () => {
  const game = round(); assert.equal(chargeTime(game, 10, 2000).endsAt, 171000);
  const swap = swapHand(game, () => .99, 2000);
  assert.deepEqual(swap.hand, [9, 9, 9, 9, 9, 9]); assert.equal(swap.endsAt, 171000);
  const ended = swapHand(game, () => .99, 175000);
  assert.equal(ended.status, 'ended'); assert.equal(ended.reason, 'time'); assert.deepEqual(ended.hand, game.hand);
});
test('unlimited settings have no timer penalties and do not end on errors', () => {
  let game = round({ duration: 0, mistakeLimit: 0 }); const target = wrongMove(game); game.hand[0] = target.digit;
  for (let i = 0; i < 10; i++) game = playTile(game, target.q, target.r, 0, random(1), 100000000).game;
  assert.equal(game.status, 'playing'); assert.equal(timeLeft(game, 100000000), null);
  assert.equal(chargeTime(game, 10, 100000000).endsAt, null);
});
test('hints only return a tile actually in the hand that passes every triangle', () => {
  const game = round(), target = legalMove(game); game.hand[0] = target.digit;
  const move = findMove(game); assert.ok(move); assert.equal(move.value, game.hand[move.handIndex]);
  assert.equal(checkPlacement(game.tiles, move.q, move.r, move.value).ok, true);
});
test('saved rounds validate rings, hand sizes, duplicate cells, and arithmetic', () => {
  const game = round(); assert.deepEqual(validateRound(JSON.parse(JSON.stringify(game))), game);
  for (const change of [g => { g.hand.pop(); }, g => { g.hand[0] = 12; }, g => { g.tiles[1].q = 0; g.tiles[1].r = 0; }, g => { g.tiles[0].value = 7; }]) {
    const bad = structuredClone(game); change(bad); assert.equal(validateRound(bad), null);
  }
  const target = legalMove(game); game.hand[0] = target.digit;
  const played = playTile(game, target.q, target.r, 0, random(1), 2000).game;
  assert.ok(validateRound(played));
  played.tiles.at(-1).value = Array.from({length:10},(_,i)=>i).find(n => !target.validDigits.includes(n));
  assert.equal(validateRound(played), null);
});
test('the board can grow 150 scored tiles without a programmed boundary', () => {
  let game = round({ duration: 0, mistakeLimit: 0 });
  for (let i = 0; i < 150; i++) {
    const target = legalMove(game); game.hand[0] = target.digit;
    const result = playTile(game, target.q, target.r, 0, random(i + 1), 2000);
    assert.equal(result.ok, true); game = result.game;
  }
  assert.equal(score(game), 150); assert.ok(validateRound(game));
  const far = [{q:10000,r:-10000,value:3},{q:10000,r:-9999,value:4}];
  assert.equal(checkPlacement(far, 9999, -9999, 7).ok, true);
});
test('custom mistake limits work and the clock stops at the end of the round', () => {
  for (const mistakeLimit of [1, 5]) {
    let game = round({mistakeLimit}); const target = wrongMove(game); game.hand[0] = target.digit;
    for (let i = 0; i < mistakeLimit; i++) game = playTile(game, target.q, target.r, 0, random(5), 2000).game;
    assert.equal(game.status, 'ended'); assert.equal(game.mistakes, mistakeLimit);
    assert.equal(timeLeft(game, 3000), 179000); assert.equal(timeLeft(game, 1000000), 179000);
    assert.ok(validateRound(JSON.parse(JSON.stringify(game))));
  }
});
