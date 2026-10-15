import { DEFAULT_SETTINGS, newRound, startRound, refreshClock, timeLeft, playTile, swapHand, chargeTime, findMove, frontier, largeTriangles, score, validateRound, hexToPixel, key } from './engine.js?v=3.1';
const $ = id => document.getElementById(id), STORAGE = 'number-hex-large-triangles-v3';
let stored = {};
try { stored = JSON.parse(localStorage.getItem(STORAGE)) || {}; } catch {}
let game = validateRound(stored.game) || newRound();
let best = stored.best && typeof stored.best === 'object' ? stored.best : {};
let selected = null, setupCenter = game.settings.center, hintTarget = null, conflict = null;
let zoom = 1, pan = { x: 0, y: 0 }, width = 0, height = 0, drag = null, suppressClick = false;
let toastTimeout, conflictTimeout, drawFrame, cachedTiles, targets = [], tracked = [], lastSide = null;
let showGuides = true;
const board = $('board'), world = $('world');
const bestKey = () => `${game.settings.duration}-${game.settings.mistakeLimit}`;
const bestScore = () => Number.isSafeInteger(best[bestKey()]) && best[bestKey()] > 0 ? best[bestKey()] : 0;
const hexPoints = radius => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 30); return `${radius * Math.cos(a)},${radius * Math.sin(a)}`; }).join(' ');
const points = hexPoints(33.5);
function save() {
  if (game.status === 'ended') best[bestKey()] = Math.max(bestScore(), score(game));
  try { localStorage.setItem(STORAGE, JSON.stringify({ game, best })); $('save-status').textContent = game.status === 'playing' ? game.settings.duration ? 'Round saved · the clock keeps running' : 'Round saved · untimed practice' : 'Your round and best score are saved'; }
  catch { $('save-status').textContent = 'Storage unavailable · keep this tab open'; }
}
function toast(text) {
  clearTimeout(toastTimeout); $('toast').textContent = text; $('toast').classList.add('visible');
  toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 3600);
}
function getTargets() {
  if (cachedTiles !== game.tiles) {
    cachedTiles = game.tiles; targets = frontier(game.tiles); tracked = largeTriangles(game.tiles);
    const last = game.tiles.at(-1); lastSide = null;
    if (score(game)) for (const triangle of tracked) for (const side of triangle.sides) {
      if (!side.some(p=>p.q===last.q&&p.r===last.r)) continue;
      const values=side.map(p=>game.tiles.find(t=>t.q===p.q&&t.r===p.r)?.value);
      if(values.every(n=>n!==undefined))lastSide=values;
    }
  }
  return targets;
}
function scheduleDraw() {
  if (!drawFrame) drawFrame = requestAnimationFrame(() => { drawFrame = null; drawBoard(); });
}
function centerOn(tile = score(game) ? game.tiles.at(-1) : { q: 0, r: 0 }) {
  const p = hexToPixel(tile.q, tile.r); pan = { x: -p.x * zoom, y: -p.y * zoom - 5 }; drawBoard();
}
function setZoom(value, anchor = { x: width / 2, y: height / 2 }) {
  const next = Math.max(.35, Math.min(2, value)), ax = anchor.x - width / 2, ay = anchor.y - height / 2;
  pan = { x: ax - (ax - pan.x) * next / zoom, y: ay - (ay - pan.y) * next / zoom }; zoom = next; drawBoard();
}
function triangleShape(triangle, className = '') {
  const center=hexToPixel(triangle.q,triangle.r);
  const points=triangle.corners.map(p=>{const a=hexToPixel(p.q,p.r);return `${center.x+(a.x-center.x)*1.34},${center.y+(a.y-center.y)*1.34}`;}).join(' ');
  return `<polygon class="large-triangle ${triangle.complete?'complete':''} ${className}" points="${points}"/>`;
}
function drawBoard() {
  if (!width || !height) return;
  const available = getTargets();
  const focused = document.activeElement?.getAttribute('data-cell');
  board.setAttribute('viewBox', `0 0 ${width} ${height}`);
  world.setAttribute('transform', `translate(${width / 2 + pan.x} ${height / 2 + pan.y}) scale(${zoom})`);
  const left = (-width / 2 - pan.x) / zoom, right = (width / 2 - pan.x) / zoom;
  const top = (-height / 2 - pan.y) / zoom, bottom = (height / 2 - pan.y) / zoom;
  let bg = '', tiles = '', triangles = '';
  for (let r = Math.floor(top / 54) - 1; r <= Math.ceil(bottom / 54) + 1; r++) {
    for (let q = Math.floor(left / (36 * Math.sqrt(3)) - r / 2) - 1; q <= Math.ceil(right / (36 * Math.sqrt(3)) - r / 2) + 1; q++) {
      const p = hexToPixel(q, r); bg += `<polygon class="hex-cell" points="${points}" transform="translate(${p.x} ${p.y})"/>`;
    }
  }
  if (showGuides) {
    const last=game.tiles.at(-1);
    const nearby=[...tracked].sort((a,b)=>(a.q-last.q)**2+(a.r-last.r)**2-(b.q-last.q)**2-(b.r-last.r)**2).slice(0,36);
    for(const triangle of nearby) triangles += triangleShape(triangle);
    if(hintTarget) for(const triangle of hintTarget.triangles) triangles += triangleShape(triangle,'hinted');
    if(conflict) for(const triangle of conflict.triangles) triangles += triangleShape(triangle,'bad');
  }
  game.tiles.forEach((t, i) => {
    const p = hexToPixel(t.q, t.r);
    if (p.x < left - 45 || p.x > right + 45 || p.y < top - 45 || p.y > bottom + 45) return;
    const latest = i >= 7 && i === game.tiles.length - 1;
    tiles += `<g class="tile ${i === 0 ? 'center' : i < 7 ? 'seed' : 'player'}${latest ? ' latest' : ''}" transform="translate(${p.x} ${p.y})" role="img" aria-label="${i === 0 ? 'Center' : i < 7 ? 'Starting tile' : 'Placed tile'} ${t.value}${latest ? ', latest' : ''}">${latest ? `<polygon class="tile-ring" points="${hexPoints(38.5)}"/>` : ''}<polygon class="tile-shape" points="${points}"/><text y="-2">${t.value}</text><text class="index" y="19">${i === 0 ? 'CENTER' : i < 7 ? 'SEED' : String(i - 6).padStart(2, '0')}</text></g>`;
  });
  const open = available.map(t => {
    const p = hexToPixel(t.q, t.r), hinted = hintTarget?.q === t.q && hintTarget?.r === t.r;
    const digit = selected === null ? null : game.hand[selected];
    return `<g class="open-hex${digit !== null ? ' has-digit' : ''}${hinted ? ' hinted' : ''}${game.status === 'ended' ? ' disabled' : ''}" transform="translate(${p.x} ${p.y})" role="button" tabindex="${game.status === 'ended' ? '-1' : '0'}" data-cell="${key(t.q, t.r)}" aria-disabled="${game.status === 'ended'}" aria-label="${digit === null ? 'Choose a hand tile, then place' : `Place digit ${digit}`} at hex ${t.q}, ${t.r}"><polygon points="${points}"/><text>${digit ?? '+'}</text></g>`;
  }).join('');
  world.innerHTML = `<g aria-hidden="true">${bg}</g>${tiles}${open}<g aria-hidden="true" class="triangle-guides">${triangles}</g>`;
  if (focused) world.querySelector(`[data-cell="${focused}"]`)?.focus({ preventScroll: true });
  $('zoom-label').textContent = `${Math.round(zoom * 100)}%`; $('zoom-in').disabled = zoom >= 2; $('zoom-out').disabled = zoom <= .35;
}
function paintClock() {
  const left = timeLeft(game), seconds = left === null ? null : Math.ceil(left / 1000);
  $('time-left').textContent = seconds === null ? '∞' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  $('time-left').classList.toggle('urgent', seconds !== null && seconds <= 20 && game.status === 'playing');
  $('time-left').setAttribute('aria-label', seconds === null ? 'No time limit' : `${seconds} seconds remaining`);
}
function update() {
  const active = game.status === 'playing';
  getTargets();
  const side=lastSide||[1,4,7,1];
  $('side-label').textContent=lastSide?'LAST COMPLETED SIDE':'FOUR HEXES ALONG A SIDE';
  $('side-example').innerHTML=side.map((n,i)=>`${i?'<span class="side-dash">–</span>':''}<span class="mini-hex ${i===0||i===3?'answer':''}">${n}</span>`).join('');
  $('side-example').setAttribute('aria-label',`Side ${side.join(', ')}`);
  $('side-equation').textContent=`${side[1]} + ${side[2]} = ${side[1]+side[2]}${side[1]+side[2]>9?` → ${side[0]}`:''} · equal ends`;
  const complete=tracked.filter(t=>t.complete).length;
  $('triangle-status').textContent=`${complete} complete · ${tracked.length-complete} forming`;
  $('round-status').textContent=active?`MOVE ${score(game)+1}`:game.status==='ready'?'READY WHEN YOU ARE':'ROUND COMPLETE';

  $('hand').innerHTML = game.hand.map((value, i) => `<button class="hand-tile" data-slot="${i}" aria-label="Hand tile ${i + 1}, digit ${value}" aria-pressed="${selected === i}" ${active ? '' : 'disabled'}>${value}<small>${i + 1}</small></button>`).join('');
  $('placed-stat').textContent = score(game); $('best-stat').textContent = bestScore();
  $('placement-instruction').textContent = active ? selected === null ? 'Select a tile, then an outlined hex.' : `Find a place for ${game.hand[selected]}. Check the sides and matching corners.` : game.status === 'ready' ? 'Choose your center and limits to begin.' : 'Round complete. Explore the board or play again.';
  $('start-button').hidden = game.status !== 'ready';
  $('hint-button').disabled = !active; $('swap-button').disabled = !active;
  $('hint-button').innerHTML = `Hint${game.settings.duration ? ' <small>−10s</small>' : ''}`;
  $('swap-button').innerHTML = `Swap hand${game.settings.duration ? ' <small>−10s</small>' : ''}`;
  $('hint-explanation').hidden = !hintTarget;
  if (hintTarget) {
    $('hint-explanation').textContent = hintTarget.explanation;
  }
  const limit = game.settings.mistakeLimit;
  $('mistake-lights').innerHTML = limit ? Array.from({ length: limit }, (_, i) => `<span class="mistake-dot${i < game.mistakes ? ' used' : ''}"></span>`).join('') : `${game.mistakes} / ∞`;
  $('mistake-lights').setAttribute('aria-label', `${game.mistakes} mistake${game.mistakes === 1 ? '' : 's'} used${limit ? ` of ${limit}` : ', no limit'}`);
  $('limits-label').textContent = `${game.settings.duration ? `${game.settings.duration / 60} MINUTES` : 'NO TIME LIMIT'} · ${limit ? `${limit} MISTAKES` : 'NO MISTAKE LIMIT'}`;
  $('board-message').textContent = game.status === 'ready' ? 'A small circle. A world of possibilities.' : game.status === 'ended' ? `${score(game)} hexes placed. Another circle awaits.` : `Move ${score(game)+1}. Choose a tile and keep building.`;
  paintClock(); drawBoard();
}
function showResults() {
  for (const id of ['setup-dialog', 'help-dialog']) if ($(id).open) $(id).close();
  $('result-title').textContent = game.reason === 'mistakes' ? 'Mistake limit reached.' : game.reason === 'blocked' ? 'A circle complete.' : 'Time’s up.';
  $('result-score').textContent = score(game);
  $('result-detail').textContent = `${game.mistakes} mistake${game.mistakes === 1 ? '' : 's'} · Best at these limits: ${bestScore()} hexes. Your starting circle isn’t included in the score.`;
  if (!$('result-dialog').open) $('result-dialog').showModal();
}
function adopt(next, showResult = true) {
  const ended = next.status === 'ended' && game.status !== 'ended'; game = next; save(); update();
  if (ended && showResult) showResults();
}
function chooseSlot(index) {
  if (game.status !== 'playing') { if (game.status === 'ready') openSetup(); return; }
  selected = index; hintTarget = null; update();
}
function attempt(cell) {
  if (suppressClick) return;
  if (game.status !== 'playing') { if (game.status === 'ready') openSetup(); else toast('Start a new round to play.'); return; }
  if (selected === null) { toast('Choose one of your six hand tiles first.'); return; }
  const [q, r] = cell.split(',').map(Number), usedSlot = selected;
  const result = playTile(game, q, r, selected);
  if (!result.ok) {
    conflict = { triangles: result.conflicts || tracked.filter(t=>t.boundary.some(p=>p.q===q&&p.r===r)) }; clearTimeout(conflictTimeout); conflictTimeout = setTimeout(() => { conflict = null; drawBoard(); }, 1800);
    adopt(result.game); toast(result.reason); return;
  }
  selected = null; hintTarget = null; conflict = null; adopt(result.game);
  $('hand').querySelector(`[data-slot="${usedSlot}"]`)?.classList.add('dealt');
  const p = hexToPixel(q, r), x = width / 2 + pan.x + p.x * zoom, y = height / 2 + pan.y + p.y * zoom;
  if (x < 90 || x > width - 90 || y < 80 || y > height - 90) centerOn({ q, r });
  toast(`Good fit. ${score(game)} ${score(game) === 1 ? 'hex' : 'hexes'} placed. A new tile is in your hand.`);
  if (getTargets().every(t => t.validDigits.length === 0)) adopt({ ...game, status: 'ended', finishedAt: Date.now(), reason: 'blocked' });
}
function requestHint() {
  const current = refreshClock(game); if (current.status !== 'playing') { adopt(current); return; }
  const move = findMove(game);
  if (!move) { toast('No tile in your hand fits. Try a hand swap. No hint time was charged.'); return; }
  const next = chargeTime(game, 10);
  if (next.status !== 'playing') { adopt(next); return; }
  selected = move.handIndex; hintTarget = move; adopt(next); centerOn(move);
  toast(game.settings.duration ? 'One possible move is highlighted. Hint: −10 seconds.' : 'One possible move is highlighted.');
}
function requestSwap() {
  if (game.status !== 'playing') return;
  selected = null; hintTarget = null; adopt(swapHand(game));
  if (game.status === 'playing') toast(game.settings.duration ? 'Six new tiles. Hand swap: −10 seconds.' : 'Six new tiles.');
}
function paintCenterChoices() {
  $('center-choices').innerHTML = Array.from({ length: 10 }, (_, i) => `<button type="button" class="center-choice" data-center="${i}" aria-label="Center digit ${i}" aria-pressed="${setupCenter === i}">${i}</button>`).join('');
}
function openSetup() {
  if ($('result-dialog').open) $('result-dialog').close();
  setupCenter = game.settings.center; paintCenterChoices();
  $('duration').value = game.settings.duration; $('mistake-limit').value = game.settings.mistakeLimit;
  $('replace-note').hidden = game.status !== 'playing';
  if (!$('setup-dialog').open) $('setup-dialog').showModal();
}
function deal(settings) {
  selected = null; hintTarget = null; conflict = null; zoom = 1;
  if ($('result-dialog').open) $('result-dialog').close(); if ($('setup-dialog').open) $('setup-dialog').close();
  adopt(startRound(newRound(settings))); centerOn(); toast('Your circle is ready. The round has begun.');
}
$('hand').addEventListener('click', e => { const el = e.target.closest('[data-slot]'); if (el) chooseSlot(Number(el.dataset.slot)); });
$('center-choices').addEventListener('click', e => { const el = e.target.closest('[data-center]'); if (el) { setupCenter = Number(el.dataset.center); paintCenterChoices(); } });
$('setup-form').addEventListener('submit', e => { e.preventDefault(); deal({ center: setupCenter, duration: Number($('duration').value), mistakeLimit: Number($('mistake-limit').value) }); });
$('start-button').addEventListener('click', openSetup); $('new-button').addEventListener('click', openSetup);
$('again-button').addEventListener('click', () => deal(game.settings)); $('result-settings').addEventListener('click', openSetup);
$('hint-button').addEventListener('click', requestHint); $('swap-button').addEventListener('click', requestSwap);
$('help-button').addEventListener('click', () => $('help-dialog').showModal());
for (const el of document.querySelectorAll('[data-close]')) el.addEventListener('click', () => $(el.dataset.close).close());
board.addEventListener('click', e => { const el = e.target.closest('[data-cell]'); if (el) attempt(el.dataset.cell); });
board.addEventListener('keydown', e => { const el = e.target.closest('[data-cell]'); if (el && ['Enter', ' '].includes(e.key)) { e.preventDefault(); attempt(el.dataset.cell); } });
board.addEventListener('pointerdown', e => { if (e.button === 0 && e.isPrimary) { drag = { id: e.pointerId, x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y, moved: false }; suppressClick = false; } });
board.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId) return;
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
board.addEventListener('pointerup', endDrag); board.addEventListener('pointercancel', endDrag);
board.addEventListener('pointerleave', e => { if (drag && !drag.moved) endDrag(e); });
board.addEventListener('wheel', e => { e.preventDefault(); const b = board.getBoundingClientRect(); setZoom(zoom * Math.exp(-e.deltaY * .0015), { x: e.clientX - b.left, y: e.clientY - b.top }); }, { passive: false });
$('triangle-toggle').addEventListener('change', e=>{showGuides=e.target.checked;drawBoard();});
$('zoom-in').addEventListener('click', () => setZoom(zoom + .15)); $('zoom-out').addEventListener('click', () => setZoom(zoom - .15)); $('center-button').addEventListener('click', () => centerOn());
document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[1-6]$/.test(e.key)) { e.preventDefault(); chooseSlot(Number(e.key) - 1); }
  else if (e.key.toLowerCase() === 'h') { e.preventDefault(); requestHint(); }
  else if (e.key.toLowerCase() === 'r') { e.preventDefault(); requestSwap(); }
  else if (e.key.toLowerCase() === 'c') { e.preventDefault(); centerOn(); }
  else if (['+', '='].includes(e.key)) { e.preventDefault(); setZoom(zoom + .15); }
  else if (e.key === '-') { e.preventDefault(); setZoom(zoom - .15); }
  else if (e.key.startsWith('Arrow')) { const d = { ArrowLeft: [45, 0], ArrowRight: [-45, 0], ArrowUp: [0, 45], ArrowDown: [0, -45] }[e.key]; if (d) { e.preventDefault(); pan.x += d[0]; pan.y += d[1]; drawBoard(); } }
});
new ResizeObserver(() => { const first = !width, rect = board.getBoundingClientRect(); width = rect.width; height = rect.height; if (first) centerOn(); else scheduleDraw(); }).observe(board);
setInterval(() => { const next = refreshClock(game); if (next !== game) adopt(next); else paintClock(); }, 250);
document.addEventListener('visibilitychange', () => { const next = refreshClock(game); if (next !== game) adopt(next); else paintClock(); });
game = refreshClock(game); save(); update();
if (game.status === 'ready') openSetup(); else if (game.status === 'ended') showResults();
