export const MODES = {
  sum2: { name: 'Two-number sum', short: 'Sum of 2', count: 2, operator: '+', seeds: [3, 4] },
  sum3: { name: 'Three-number sum', short: 'Sum of 3', count: 3, operator: '+', seeds: [2, 3, 4] },
  product: { name: 'Two-number product', short: 'Multiply', count: 2, operator: '×', seeds: [3, 7] },
};
export const DIRECTIONS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
export const key = (q, r) => `${q},${r}`;
export function adjacent(a, b) {
  const dq = a.q - b.q, dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) === 1;
}
export function nextValue(tiles, mode) {
  const rule = MODES[mode];
  if (!rule || tiles.length < rule.count) throw new Error('Not enough starting digits.');
  const values = tiles.slice(-rule.count).map(tile => tile.value);
  const total = mode === 'product' ? values.reduce((a, b) => a * b, 1) : values.reduce((a, b) => a + b, 0);
  return { values, total, digit: total % 10 };
}
export function newGame(mode = 'sum2', seeds = MODES[mode]?.seeds) {
  if (!MODES[mode] || !Array.isArray(seeds) || seeds.length !== MODES[mode].count || seeds.some(n => !Number.isInteger(n) || n < 0 || n > 9)) {
    throw new Error('Choose one digit from 0 to 9 for each starting tile.');
  }
  return { mode, tiles: seeds.map((value, i) => ({ q: i, r: 0, value })), hints: 0 };
}
export function openNeighbors(tiles) {
  const last = tiles.at(-1), occupied = new Set(tiles.map(t => key(t.q, t.r)));
  return DIRECTIONS.map(([q, r]) => ({ q: last.q + q, r: last.r + r })).filter(t => !occupied.has(key(t.q, t.r)));
}
export function placeTile(game, q, r, value) {
  if (!Number.isSafeInteger(q) || !Number.isSafeInteger(r) || !Number.isInteger(value) || value < 0 || value > 9) return { ok: false, reason: 'Choose a digit from 0 to 9.' };
  if (game.tiles.some(t => t.q === q && t.r === r)) return { ok: false, reason: 'That hex already has a tile.' };
  if (!adjacent(game.tiles.at(-1), { q, r })) return { ok: false, reason: 'Place beside the latest tile.' };
  if (nextValue(game.tiles, game.mode).digit !== value) return { ok: false, reason: 'Try another digit. Keep only the last digit of the result.' };
  return { ok: true, game: { ...game, tiles: [...game.tiles, { q, r, value }] } };
}
export function validateGame(raw, mode) {
  if (!raw || raw.mode !== mode || !MODES[mode] || !Array.isArray(raw.tiles) || raw.tiles.length < MODES[mode].count) return null;
  const seen = new Set();
  for (let i = 0; i < raw.tiles.length; i++) {
    const t = raw.tiles[i];
    if (!t || !Number.isSafeInteger(t.q) || !Number.isSafeInteger(t.r) || !Number.isInteger(t.value) || t.value < 0 || t.value > 9 || seen.has(key(t.q, t.r))) return null;
    if (i === 0 && (t.q !== 0 || t.r !== 0)) return null;
    if (i > 0 && !adjacent(raw.tiles[i - 1], t)) return null;
    if (i >= MODES[mode].count && nextValue(raw.tiles.slice(i - MODES[mode].count, i), mode).digit !== t.value) return null;
    seen.add(key(t.q, t.r));
  }
  return { mode, tiles: raw.tiles.map(({ q, r, value }) => ({ q, r, value })), hints: Math.max(0, Number.isSafeInteger(raw.hints) ? raw.hints : 0) };
}
export function hexToPixel(q, r, radius = 36) {
  return { x: radius * Math.sqrt(3) * (q + r / 2), y: radius * 1.5 * r };
}
export function pixelToHex(x, y, radius = 36) {
  const q = (Math.sqrt(3) / 3 * x - y / 3) / radius, r = y * 2 / 3 / radius;
  let x1 = Math.round(q), z1 = Math.round(r), y1 = Math.round(-q - r);
  const dx = Math.abs(x1 - q), dy = Math.abs(y1 + q + r), dz = Math.abs(z1 - r);
  if (dx > dy && dx > dz) x1 = -y1 - z1;
  else if (dy > dz) y1 = -x1 - z1;
  else z1 = -x1 - y1;
  return { q: x1 || 0, r: z1 || 0 };
}
