import { MODES, key, nextValue, newGame, openNeighbors, placeTile, validateGame, hexToPixel, pixelToHex } from './classic-engine.js';

const $ = id => document.getElementById(id);
const STORAGE = 'number-hex-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE)) || {}; } catch { /* A blocked or damaged save starts a fresh game. */ }
let mode = MODES[saved.mode] ? saved.mode : 'sum2';
const games = Object.fromEntries(Object.keys(MODES).map(m => [m, validateGame(saved.games?.[m], m) || newGame(m)]));
const best = Object.fromEntries(Object.keys(MODES).map(m => [m, Math.max(games[m].tiles.length - MODES[m].count, Number.isSafeInteger(saved.best?.[m]) ? saved.best[m] : 0)]));
let game = games[mode], selected = null, revealed = false;
let zoom = 1, pan = { x: 0, y: 0 }, width = 0, height = 0, drag = null, suppressClick = false;
let toastTimeout, resizeFrame, drawFrame;
const board = $('board'), world = $('world');
const hexPoints = radius => Array.from({ length: 6 }, (_, i) => { const angle = Math.PI / 180 * (60 * i - 30); return `${(radius * Math.cos(angle)).toFixed(2)},${(radius * Math.sin(angle)).toFixed(2)}`; }).join(' ');
const points = hexPoints(33.5);

function save() {
  games[mode] = game;
  best[mode] = Math.max(best[mode], game.tiles.length - MODES[mode].count);
  try {
    localStorage.setItem(STORAGE, JSON.stringify({ mode, games, best }));
    $('save-status').textContent = 'Your path is saved automatically';
  } catch { $('save-status').textContent = 'Storage unavailable · keep this tab open'; }
}
function toast(message) {
  clearTimeout(toastTimeout);
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 3500);
}
function scheduleDraw() {
  if (drawFrame) return;
  drawFrame = requestAnimationFrame(() => { drawFrame = null; drawBoard(); });
}
function worldPoint(q, r) { return hexToPixel(q, r); }
function screenPoint(q, r) { const p = worldPoint(q, r); return { x: width / 2 + pan.x + p.x * zoom, y: height / 2 + pan.y + p.y * zoom }; }
function center() {
  const last = worldPoint(game.tiles.at(-1).q, game.tiles.at(-1).r);
  // Leave a little space in front of the latest tile for its next neighbors.
  pan = { x: -last.x * zoom + (width > 500 ? 35 : 0), y: -last.y * zoom - 4 };
  drawBoard();
}
function setZoom(value, anchor = { x: width / 2, y: height / 2 }) {
  const next = Math.min(2, Math.max(.35, value));
  const ax = anchor.x - width / 2, ay = anchor.y - height / 2;
  pan = { x: ax - (ax - pan.x) * next / zoom, y: ay - (ay - pan.y) * next / zoom };
  zoom = next;
  drawBoard();
}
function drawBoard() {
  if (!width || !height) return;
  const focused = document.activeElement?.getAttribute('data-cell');
  board.setAttribute('viewBox', `0 0 ${width} ${height}`);
  world.setAttribute('transform', `translate(${width / 2 + pan.x} ${height / 2 + pan.y}) scale(${zoom})`);
  const left = (-width / 2 - pan.x) / zoom, right = (width / 2 - pan.x) / zoom;
  const top = (-height / 2 - pan.y) / zoom, bottom = (height / 2 - pan.y) / zoom;
  let background = '';
  for (let r = Math.floor(top / 54) - 1; r <= Math.ceil(bottom / 54) + 1; r++) {
    const start = Math.floor(left / (36 * Math.sqrt(3)) - r / 2) - 1;
    const end = Math.ceil(right / (36 * Math.sqrt(3)) - r / 2) + 1;
    for (let q = start; q <= end; q++) {
      const p = worldPoint(q, r);
      background += `<polygon class="hex-cell" points="${points}" transform="translate(${p.x} ${p.y})"/>`;
    }
  }
  const recentStart = game.tiles.length - MODES[mode].count;
  let tiles = '', line = '';
  game.tiles.forEach((t, i) => {
    const p = worldPoint(t.q, t.r);
    line += `${i ? 'L' : 'M'}${p.x} ${p.y} `;
    if (p.x < left - 50 || p.x > right + 50 || p.y < top - 50 || p.y > bottom + 50) return;
    const latest = i === game.tiles.length - 1;
    tiles += `<g class="tile${latest ? ' latest' : ''}${i >= recentStart ? ' recent' : ''}" transform="translate(${p.x} ${p.y})" role="img" aria-label="Tile ${i + 1}: ${t.value}${latest ? ', latest tile' : ''}">${latest ? `<polygon class="tile-ring" points="${hexPoints(38.5)}"/>` : ''}<polygon class="tile-shape" points="${points}"/><text y="-2">${t.value}</text><text class="index" y="19">${String(i + 1).padStart(2, '0')}</text></g>`;
  });
  const open = openNeighbors(game.tiles);
  const targets = open.map(t => {
    const p = worldPoint(t.q, t.r);
    return `<g class="open-hex${selected !== null ? ' has-digit' : ''}" transform="translate(${p.x} ${p.y})" role="button" tabindex="0" data-cell="${key(t.q, t.r)}" aria-label="${selected === null ? 'Choose a digit, then place' : `Place ${selected}`} at hex ${t.q}, ${t.r}"><polygon points="${points}"/><text>${selected ?? '+'}</text></g>`;
  }).join('');
  world.innerHTML = `<g aria-hidden="true">${background}<path class="path-line" d="${line}"/></g>${tiles}${targets}`;
  if (focused) world.querySelector(`[data-cell="${focused}"]`)?.focus({ preventScroll: true });
  $('zoom-label').textContent = `${Math.round(zoom * 100)}%`;
  $('zoom-in').disabled = zoom >= 2;
  $('zoom-out').disabled = zoom <= .35;
}
function update() {
  const rule = MODES[mode], next = nextValue(game.tiles, mode);
  const title = mode === 'product' ? 'Multiply the last two.' : mode === 'sum3' ? 'Add the last three.' : 'Add the last two.';
  $('rule-title').textContent = title;
  $('rule-copy').innerHTML = `Keep the last digit of their ${mode === 'product' ? 'product' : 'sum'}.<br>That’s your next tile.`;
  $('rule-badge').textContent = mode === 'product' ? '×2' : `+${rule.count}`;
  const parts = next.values.map((n, i) => `${i ? `<span class="formula-symbol">${rule.operator}</span>` : ''}<span class="mini-hex">${n}</span>`).join('');
  $('formula').innerHTML = `${parts}<span class="formula-arrow">→</span><span class="mini-hex answer">${revealed ? next.digit : '?'}</span>`;
  $('formula').classList.toggle('three', rule.count === 3);
  $('formula').setAttribute('aria-label', `${next.values.join(` ${rule.operator} `)}; keep the last digit${revealed ? `: ${next.digit}` : ''}`);
  $('hint-explanation').hidden = !revealed;
  $('hint-explanation').textContent = `${next.values.join(` ${rule.operator} `)} = ${next.total} → place ${next.digit}`;
  $('hint-button').disabled = revealed;
  $('undo-button').disabled = game.tiles.length <= rule.count;
  $('placed-stat').textContent = game.tiles.length - rule.count;
  $('best-stat').textContent = best[mode];
  $('placement-instruction').textContent = selected === null ? 'Then tap an outlined hex to place it.' : `Digit ${selected} selected. Tap an outlined hex.`;
  document.querySelectorAll('.digit').forEach(el => el.setAttribute('aria-pressed', String(Number(el.dataset.digit) === selected)));
  document.querySelectorAll('[data-mode]').forEach(el => {
    el.setAttribute('aria-selected', String(el.dataset.mode === mode));
    el.tabIndex = el.dataset.mode === mode ? 0 : -1;
  });
  $('game-content').setAttribute('aria-labelledby', `tab-${mode}`);
  const blocked = !openNeighbors(game.tiles).length;
  $('board-message').classList.toggle('error', blocked);
  $('board-message').textContent = blocked ? 'Your path is surrounded. Undo a tile to find a new direction.' : game.tiles.length === rule.count ? 'Every path starts with a little curiosity.' : game.tiles.length - rule.count < 5 ? 'A little arithmetic. A path all your own.' : '';
  drawBoard();
}
function chooseDigit(n) { selected = n; update(); }
function attemptPlace(cell) {
  if (suppressClick) return;
  if (selected === null) { toast('Choose a digit below, or press 0–9 first.'); return; }
  const [q, r] = cell.split(',').map(Number);
  const result = placeTile(game, q, r, selected);
  if (!result.ok) {
    toast(result.reason);
    const digit = document.querySelector(`.digit[data-digit="${selected}"]`);
    digit.classList.remove('shake');
    requestAnimationFrame(() => digit.classList.add('shake'));
    return;
  }
  game = result.game;
  selected = null; revealed = false;
  save(); update();
  const point = screenPoint(q, r);
  if (point.x < 100 || point.x > width - 100 || point.y < 85 || point.y > height - 100) center();
  const count = game.tiles.length - MODES[mode].count;
  if ([10, 25, 50, 100, 250, 500, 1000].includes(count)) toast(`${count} tiles. Look how far a little math can take you.`);
  else $('toast').classList.remove('visible');
}
function undo() {
  if (game.tiles.length <= MODES[mode].count) return;
  game = { ...game, tiles: game.tiles.slice(0, -1) };
  selected = null; revealed = false; save(); update(); center();
  toast('One step back. A new direction ahead.');
}
function hint() {
  if (revealed) return;
  revealed = true; game = { ...game, hints: game.hints + 1 }; save(); update();
  toast(`The next digit is ${nextValue(game.tiles, mode).digit}.`);
}
function switchMode(next) {
  if (!MODES[next] || next === mode) return;
  games[mode] = game; mode = next; game = games[mode]; selected = null; revealed = false; zoom = 1;
  save(); update(); center();
}

$('digit-tray').innerHTML = Array.from({ length: 10 }, (_, n) => `<button class="digit" data-digit="${n}" aria-label="Select digit ${n}" aria-pressed="false">${n}</button>`).join('');
$('digit-tray').addEventListener('click', e => { const button = e.target.closest('[data-digit]'); if (button) chooseDigit(Number(button.dataset.digit)); });
document.querySelectorAll('[data-mode]').forEach(el => {
  el.addEventListener('click', () => switchMode(el.dataset.mode));
  el.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault(); const modes = Object.keys(MODES), i = modes.indexOf(mode);
    const next = e.key === 'Home' ? modes[0] : e.key === 'End' ? modes.at(-1) : modes[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
    switchMode(next); $(`tab-${next}`).focus();
  });
});
board.addEventListener('click', e => { const cell = e.target.closest('[data-cell]'); if (cell) attemptPlace(cell.dataset.cell); });
board.addEventListener('keydown', e => {
  const cell = e.target.closest('[data-cell]');
  if (cell && ['Enter', ' '].includes(e.key)) { e.preventDefault(); attemptPlace(cell.dataset.cell); }
});
board.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !e.isPrimary) return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y, moved: false };
  suppressClick = false;
});
board.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; board.setPointerCapture(e.pointerId); board.classList.add('dragging'); }
  if (drag.moved) { pan = { x: drag.panX + dx, y: drag.panY + dy }; scheduleDraw(); }
});
function endDrag(e) {
  if (!drag || drag.id !== e.pointerId) return;
  suppressClick = drag.moved; drag = null; board.classList.remove('dragging');
  if (board.hasPointerCapture(e.pointerId)) board.releasePointerCapture(e.pointerId);
  setTimeout(() => { suppressClick = false; }, 0);
}
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', endDrag);
board.addEventListener('pointerleave', e => { if (drag && !drag.moved) endDrag(e); });
board.addEventListener('wheel', e => {
  e.preventDefault();
  const bounds = board.getBoundingClientRect();
  setZoom(zoom * Math.exp(-e.deltaY * .0015), { x: e.clientX - bounds.left, y: e.clientY - bounds.top });
}, { passive: false });
$('zoom-in').addEventListener('click', () => setZoom(zoom + .15));
$('zoom-out').addEventListener('click', () => setZoom(zoom - .15));
$('center-button').addEventListener('click', center);
$('undo-button').addEventListener('click', undo);
$('hint-button').addEventListener('click', hint);
$('help-button').addEventListener('click', () => $('help-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => $(el.dataset.close).close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', e => { if (e.target === dialog) { const b = dialog.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) dialog.close(); } }));
$('new-button').addEventListener('click', () => {
  const rule = MODES[mode];
  $('seed-rule-label').textContent = rule.name;
  $('seed-inputs').innerHTML = rule.seeds.map((n, i) => `<label>Tile ${i + 1}<input type="number" min="0" max="9" step="1" value="${n}" inputmode="numeric" required aria-label="Starting digit ${i + 1}"></label>`).join('');
  $('new-dialog').showModal();
});
$('new-form').addEventListener('submit', e => {
  e.preventDefault();
  const seeds = [...$('seed-inputs').querySelectorAll('input')].map(el => Number(el.value));
  try { game = newGame(mode, seeds); } catch (error) { toast(error.message); return; }
  selected = null; revealed = false; zoom = 1; save(); update(); center(); $('new-dialog').close();
  toast('A fresh path. Where will this one go?');
});
document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); chooseDigit(Number(e.key)); }
  else if (e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  else if (e.key.toLowerCase() === 'h') { e.preventDefault(); hint(); }
  else if (e.key.toLowerCase() === 'c') { e.preventDefault(); center(); }
  else if (['+', '='].includes(e.key)) { e.preventDefault(); setZoom(zoom + .15); }
  else if (e.key === '-') { e.preventDefault(); setZoom(zoom - .15); }
  else if (e.key.startsWith('Arrow') && !e.target.closest('[role="tablist"]')) {
    e.preventDefault();
    const d = { ArrowLeft: [45, 0], ArrowRight: [-45, 0], ArrowUp: [0, 45], ArrowDown: [0, -45] }[e.key];
    if (d) { pan.x += d[0]; pan.y += d[1]; drawBoard(); }
  }
});
new ResizeObserver(() => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    const first = !width; const rect = board.getBoundingClientRect(); width = rect.width; height = rect.height;
    if (first) center(); else drawBoard();
  });
}).observe(board);
save(); update();
