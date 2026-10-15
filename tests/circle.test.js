import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, DIRECTIONS, sideValid, largeTriangles, SHAPES, generateRing, newRound, startRound, score, frontier, checkPlacement, playTile, refreshClock, timeLeft, chargeTime, swapHand, findMove, validateRound } from '../dist/engine.js';
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

test('the user examples use equal ends and the sum of the two interior digits', () => {
  for(const side of [[1,4,7,1],[5,1,4,5],[0,5,5,0],[0,0,0,0]])assert.equal(sideValid(side),true);
  for(const side of [[1,4,7,3],[1,4,8,1],[3,4,7],[7,3,5,7]])assert.equal(sideValid(side),false);
});
test('each large triangle has three corners, four hexes on each side, and nine boundary hexes', () => {
  for(const shape of SHAPES){assert.equal(shape.corners.length,3);assert.equal(shape.boundary.length,9);for(const side of shape.sides)assert.equal(side.length,4);}
});
test('all ten centers have consistent constrained starting circles', () => {
  const samples=new Set();
  for(let center=0;center<10;center++)for(let seed=1;seed<=40;seed++){
    const game=newRound({center},random(seed*982451653));
    const ring=game.tiles.slice(1).map(t=>t.value),triangles=largeTriangles(game.tiles);
    assert.equal(game.hand.length,6);assert.equal(ring.length,6);assert.equal(triangles.length,2);
    for(let i=0;i<6;i++)assert.equal(ring[i],ring[i%2]);
    for(const t of triangles){assert.equal(t.valid,true);assert.equal(t.requiredDigit,(ring[0]+ring[1])%10);}
    if(center===3)samples.add(ring.join(','));
  }
  assert.ok(samples.size>=2);
});
test('the previously shown random circle has conflicting larger triangles', () => {
  const ring=[7,4,9,4,1,4];
  const tiles=[{q:0,r:0,value:3},...DIRECTIONS.map(([q,r],i)=>({q,r,value:ring[i]}))];
  const central=largeTriangles(tiles).filter(t=>t.q===0&&t.r===0);
  assert.equal(central.length,2);assert.ok(central.every(t=>!t.valid));
});
test('all three corners are the same digit and completed sides are checked', () => {
  const ring=[4,7,4,7,4,7];
  const tiles=[{q:0,r:0,value:3},...DIRECTIONS.map(([q,r],i)=>({q,r,value:ring[i]}))];
  for(const [q,r]of SHAPES[0].corners){
    assert.equal(checkPlacement(tiles,q,r,2).ok,false);
    assert.equal(checkPlacement(tiles,q,r,1).ok,true);tiles.push({q,r,value:1});
  }
  const up=largeTriangles(tiles).find(t=>t.q===0&&t.r===0&&t.orientation===0);
  assert.equal(up.complete,true);assert.equal(up.cornersFilled,3);assert.equal(up.requiredDigit,1);
});
test('successive placements can extend a side without closing a small three-hex triangle', () => {
  const tiles=[{q:0,r:0,value:0},{q:1,r:0,value:5}];
  for(let q=2;q<20;q++){
    const value=(tiles.at(-1).value+tiles.at(-2).value)%10;
    assert.equal(checkPlacement(tiles,q,0,value).ok,true);tiles.push({q,r:0,value});
  }
});
test('a missing interior tile uses the side equation rather than summing a corner again', () => {
  const tiles=[{q:0,r:0,value:1},{q:2,r:0,value:7},{q:3,r:0,value:1}];
  assert.equal(checkPlacement(tiles,1,0,4).ok,true);assert.equal(checkPlacement(tiles,1,0,8).ok,false);
});
test('seven starting tiles score zero and the round needs an explicit start', () => {
  const ready=newRound();assert.equal(ready.tiles.length,7);assert.equal(score(ready),0);assert.equal(timeLeft(ready,90000),180000);
  const result=playTile(ready,2,-1,0,random(4),1000);assert.equal(result.ok,false);assert.equal(result.game.mistakes,0);assert.equal(result.game.status,'ready');
});
test('open spaces include side extensions with two straight predecessors', () => {
  const tiles=[{q:0,r:0,value:4},{q:1,r:0,value:7}];
  assert.ok(frontier(tiles).some(t=>t.q===2&&t.r===0&&t.validDigits.includes(1)));
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
  const far = [{q:10000,r:-10000,value:4},{q:10001,r:-10000,value:7}];
  assert.equal(checkPlacement(far, 10002, -10000, 1).ok, true);
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

test('every center supports forty consecutive scored moves and retains legal continuations', () => {
  for(let center=0;center<10;center++){
    let game=round({center,duration:0,mistakeLimit:0});
    for(let i=0;i<40;i++){
      const target=legalMove(game);game.hand[0]=target.digit;
      const result=playTile(game,target.q,target.r,0,random(i+center),2000);
      assert.equal(result.ok,true);assert.equal(result.game.status,'playing');game=result.game;
    }
    assert.equal(score(game),40);assert.ok(frontier(game.tiles).length);assert.ok(validateRound(game));
  }
});
test('saves from the old small-triangle rule are not loaded into the new rules', () => {
  const game=round();game.version=2;assert.equal(validateRound(game),null);
});
