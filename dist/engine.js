export { hexToPixel, pixelToHex, adjacent, key, DIRECTIONS } from './classic-engine.js';
import { DIRECTIONS, key } from './classic-engine.js';
import { isDigit, generateRing, checkPlacement, frontier, largeTriangles } from './rules.js?v=3';
export { isDigit, generateRing, checkPlacement, frontier, largeTriangles, sideValid, SHAPES } from './rules.js?v=3';
export const DEFAULT_SETTINGS = { center: 5, duration: 180, mistakeLimit: 3 };
export const score = game => Math.max(0, game.tiles.length - 7);
function drawDigit(random) { return Math.floor(random() * 10); }
export function newRound(settings = DEFAULT_SETTINGS, random = Math.random) {
  settings = { ...DEFAULT_SETTINGS, ...settings };
  if (!isDigit(settings.center) || ![0, 60, 180, 300, 600].includes(settings.duration) || ![0, 1, 3, 5].includes(settings.mistakeLimit)) throw new Error('Choose valid round settings.');
  const ring = generateRing(settings.center, random);
  return { version: 3, settings, status: 'ready', tiles: [{ q: 0, r: 0, value: settings.center }, ...DIRECTIONS.map(([q, r], i) => ({ q, r, value: ring[i] }))], hand: Array.from({ length: 6 }, () => drawDigit(random)), mistakes: 0, endsAt: null, startedAt: null, finishedAt: null, reason: null };
}
export function startRound(game, now = Date.now()) {
  if (game.status !== 'ready') return game;
  return { ...game, status: 'playing', startedAt: now, endsAt: game.settings.duration ? now + game.settings.duration * 1000 : null };
}
export function timeLeft(game, now = Date.now()) {
  if (!game.settings.duration) return null;
  if (game.status === 'ready') return game.settings.duration * 1000;
  return Math.max(0, game.endsAt - (game.status === 'ended' && Number.isFinite(game.finishedAt) ? game.finishedAt : now));
}
export function refreshClock(game, now = Date.now()) {
  return game.status === 'playing' && timeLeft(game, now) === 0 ? { ...game, status: 'ended', finishedAt: game.endsAt, reason: 'time' } : game;
}
export function playTile(game, q, r, handIndex, random = Math.random, now = Date.now()) {
  game = refreshClock(game, now);
  if (game.status !== 'playing') return { ok: false, game, reason: game.status === 'ready' ? 'Start the round to play.' : 'The round is over. Start a new one.' };
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex > 5) return { ok: false, game, reason: 'Choose one of the six tiles in your hand.' };
  const value = game.hand[handIndex], check = checkPlacement(game.tiles, q, r, value);
  if (!check.ok) {
    const mistakes = game.mistakes + 1, ended = game.settings.mistakeLimit > 0 && mistakes >= game.settings.mistakeLimit;
    return { ...check, game: { ...game, mistakes, status: ended ? 'ended' : 'playing', finishedAt: ended ? now : null, reason: ended ? 'mistakes' : null } };
  }
  const hand = [...game.hand]; hand[handIndex] = drawDigit(random);
  return { ok: true, game: { ...game, hand, tiles: [...game.tiles, { q, r, value }] }, triangles: check.triangles, completedSides: check.completedSides };
}
export function chargeTime(game, seconds = 10, now = Date.now()) {
  game = refreshClock(game, now);
  if (game.status !== 'playing' || game.endsAt === null) return game;
  return refreshClock({ ...game, endsAt: Math.max(now, game.endsAt - seconds * 1000) }, now);
}
export function swapHand(game, random = Math.random, now = Date.now()) {
  game = refreshClock(game, now);
  if (game.status !== 'playing') return game;
  game = chargeTime(game, 10, now);
  if (game.status !== 'playing') return game;
  return { ...game, hand: Array.from({ length: 6 }, () => drawDigit(random)) };
}
export function findMove(game) {
  for (const target of frontier(game.tiles)) {
    const index = game.hand.findIndex(n => target.validDigits.includes(n));
    if (index !== -1) return { ...target, handIndex: index, value: game.hand[index] };
  }
  return null;
}
export function validateRound(raw) {
  if (!raw || raw.version !== 3 || !Array.isArray(raw.tiles) || raw.tiles.length < 7 || !Array.isArray(raw.hand) || raw.hand.length !== 6 || !raw.hand.every(isDigit) || !['ready', 'playing', 'ended'].includes(raw.status)) return null;
  const s = raw.settings;
  if (!s || !isDigit(s.center) || ![0, 60, 180, 300, 600].includes(s.duration) || ![0, 1, 3, 5].includes(s.mistakeLimit) || !Number.isSafeInteger(raw.mistakes) || raw.mistakes < 0) return null;
  const seen = new Set();
  for (let i = 0; i < raw.tiles.length; i++) {
    const t = raw.tiles[i];
    if (!t || !Number.isSafeInteger(t.q) || !Number.isSafeInteger(t.r) || !isDigit(t.value) || seen.has(key(t.q, t.r))) return null;
    if (i === 0 && (t.q !== 0 || t.r !== 0 || t.value !== s.center)) return null;
    if (i > 0 && i < 7 && (t.q !== DIRECTIONS[i - 1][0] || t.r !== DIRECTIONS[i - 1][1])) return null;
    if (i >= 7 && !checkPlacement(raw.tiles.slice(0, i), t.q, t.r, t.value).ok) return null;
    seen.add(key(t.q, t.r));
  }
  const ring=raw.tiles.slice(1,7).map(t=>t.value);
  if(ring.some((n,i)=>n!==ring[i%2])) return null;
  if(![ring[0],ring[1]].some(n=>n===0||n===5)) return null;
  if((ring[0]-ring[1]+10)%10!==s.center&&(ring[1]-ring[0]+10)%10!==s.center) return null;
  if(largeTriangles(raw.tiles).some(t=>!t.valid)) return null;
  if (raw.status === 'ready' && (raw.startedAt !== null || raw.endsAt !== null || raw.tiles.length !== 7 || raw.mistakes !== 0)) return null;
  if (raw.status !== 'ready' && (!Number.isFinite(raw.startedAt) || (s.duration ? !Number.isFinite(raw.endsAt) : raw.endsAt !== null))) return null;
  if (raw.status === 'playing' && s.mistakeLimit && raw.mistakes >= s.mistakeLimit) return null;
  if (raw.finishedAt !== null && !Number.isFinite(raw.finishedAt)) return null;
  return { version: 3, settings: { ...s }, status: raw.status, hand: [...raw.hand], tiles: raw.tiles.map(({ q, r, value }) => ({ q, r, value })), mistakes: raw.mistakes, startedAt: raw.startedAt, endsAt: raw.endsAt, finishedAt: raw.finishedAt, reason: ['time', 'mistakes', 'blocked'].includes(raw.reason) ? raw.reason : null };
}
