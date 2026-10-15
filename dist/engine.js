export { hexToPixel, pixelToHex, adjacent, key, DIRECTIONS } from './classic-engine.js';
import { key, DIRECTIONS } from './classic-engine.js';
export const DEFAULT_SETTINGS = { center: 5, duration: 180, mistakeLimit: 3 };
export const isDigit = n => Number.isInteger(n) && n >= 0 && n <= 9;
export const score = game => Math.max(0, game.tiles.length - 7);
export function triangleValid(a, b, c) {
  return (a + b) % 10 === c || (b + c) % 10 === a || (c + a) % 10 === b;
}
function shuffled(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
const digits = Array.from({ length: 10 }, (_, i) => i);
export function generateRing(center, random = Math.random) {
  if (!isDigit(center)) throw new Error('Choose a center digit from 0 to 9.');
  // Randomize search order; accept only rings whose closing triangle also fits.
  function search(path) {
    if (path.length === 6) return triangleValid(center, path[5], path[0]) ? path : null;
    for (const digit of shuffled(digits, random)) {
      if (path.length && !triangleValid(center, path.at(-1), digit)) continue;
      const result = search([...path, digit]);
      if (result) return result;
    }
    return null;
  }
  return search([]);
}
export function trianglesAt(tiles, q, r) {
  const occupied = new Map(tiles.map(t => [key(t.q, t.r), t])), triangles = [];
  for (let i = 0; i < 6; i++) {
    const a = DIRECTIONS[i], b = DIRECTIONS[(i + 1) % 6];
    const first = occupied.get(key(q + a[0], r + a[1]));
    const second = occupied.get(key(q + b[0], r + b[1]));
    if (first && second) triangles.push([first, second]);
  }
  return triangles;
}
export function checkPlacement(tiles, q, r, digit) {
  if (!Number.isSafeInteger(q) || !Number.isSafeInteger(r) || !isDigit(digit)) return { ok: false, reason: 'Choose a tile from your hand.' };
  if (tiles.some(t => t.q === q && t.r === r)) return { ok: false, reason: 'That hex is already occupied.' };
  const triangles = trianglesAt(tiles, q, r);
  if (!triangles.length) return { ok: false, reason: 'Complete a triangle with two touching tiles.' };
  const conflicts = triangles.filter(([a, b]) => !triangleValid(a.value, b.value, digit));
  if (conflicts.length) return { ok: false, reason: `Digit ${digit} conflicts with ${conflicts.length === 1 ? 'a triangle' : `${conflicts.length} triangles`}. Try another tile or space.`, conflicts };
  return { ok: true, triangles };
}
export function frontier(tiles) {
  const occupied = new Set(tiles.map(t => key(t.q, t.r))), candidates = new Map();
  for (const t of tiles) for (const [dq, dr] of DIRECTIONS) {
    const q = t.q + dq, r = t.r + dr, cell = key(q, r);
    if (!occupied.has(cell)) candidates.set(cell, { q, r });
  }
  const result = [];
  for (const target of candidates.values()) {
    const triangles = trianglesAt(tiles, target.q, target.r);
    if (triangles.length) result.push({ ...target, triangles, validDigits: digits.filter(n => triangles.every(([a, b]) => triangleValid(a.value, b.value, n))) });
  }
  return result;
}
function drawDigit(random) { return Math.floor(random() * 10); }
export function newRound(settings = DEFAULT_SETTINGS, random = Math.random) {
  settings = { ...DEFAULT_SETTINGS, ...settings };
  if (!isDigit(settings.center) || ![0, 60, 180, 300, 600].includes(settings.duration) || ![0, 1, 3, 5].includes(settings.mistakeLimit)) throw new Error('Choose valid round settings.');
  const ring = generateRing(settings.center, random);
  return { version: 2, settings, status: 'ready', tiles: [{ q: 0, r: 0, value: settings.center }, ...DIRECTIONS.map(([q, r], i) => ({ q, r, value: ring[i] }))], hand: Array.from({ length: 6 }, () => drawDigit(random)), mistakes: 0, endsAt: null, startedAt: null, finishedAt: null, reason: null };
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
  return { ok: true, game: { ...game, hand, tiles: [...game.tiles, { q, r, value }] }, triangles: check.triangles };
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
export function equationFor(a, b, c) {
  for (const [x, y, z] of [[a, b, c], [a, c, b], [b, c, a]]) if ((x + y) % 10 === z) return { a: x, b: y, result: z, total: x + y };
  return null;
}
export function validateRound(raw) {
  if (!raw || raw.version !== 2 || !Array.isArray(raw.tiles) || raw.tiles.length < 7 || !Array.isArray(raw.hand) || raw.hand.length !== 6 || !raw.hand.every(isDigit) || !['ready', 'playing', 'ended'].includes(raw.status)) return null;
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
  for (let i = 1; i <= 6; i++) if (!triangleValid(s.center, raw.tiles[i].value, raw.tiles[i === 6 ? 1 : i + 1].value)) return null;
  if (raw.status === 'ready' && (raw.startedAt !== null || raw.endsAt !== null || raw.tiles.length !== 7 || raw.mistakes !== 0)) return null;
  if (raw.status !== 'ready' && (!Number.isFinite(raw.startedAt) || (s.duration ? !Number.isFinite(raw.endsAt) : raw.endsAt !== null))) return null;
  if (raw.status === 'playing' && s.mistakeLimit && raw.mistakes >= s.mistakeLimit) return null;
  if (raw.finishedAt !== null && !Number.isFinite(raw.finishedAt)) return null;
  return { version: 2, settings: { ...s }, status: raw.status, hand: [...raw.hand], tiles: raw.tiles.map(({ q, r, value }) => ({ q, r, value })), mistakes: raw.mistakes, startedAt: raw.startedAt, endsAt: raw.endsAt, finishedAt: raw.finishedAt, reason: ['time', 'mistakes', 'blocked'].includes(raw.reason) ? raw.reason : null };
}
