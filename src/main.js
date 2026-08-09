// 画面まわり：パレット・設置エディタ・再生／リセット。
import { STAGES, WORLD_W, WORLD_H } from './stages.js';
import { PARTS } from './parts.js';
import { Game } from './game.js';
import { render, drawIcon, handlesOf } from './render.js';

const SAVE_KEY = 'pitagoran.proto.v1';
const $ = (id) => document.getElementById(id);

const cv = $('cv');
const ctx = cv.getContext('2d');
const game = new Game();

const state = {
  stageIndex: 0,
  placed: [],
  selectedType: null,
  selectedUid: null,
  hoverUid: null,
  ghost: null,
  ghostAngle: 0,
  drag: null,
  running: false,
  overlayShown: false,
  uid: 1,
};

const stage = () => STAGES[state.stageIndex];

// ---------- 保存 ----------
const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
function save() {
  saved[stage().id] = state.placed.map(({ type, x, y, angle }) => ({ type, x, y, angle }));
  localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
}

// ---------- 初期化 ----------
function setupCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = WORLD_W * dpr;
  cv.height = WORLD_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function loadStage(i) {
  state.stageIndex = i;
  state.placed = (saved[stage().id] || []).map(p => ({ ...p, uid: state.uid++ }));
  state.selectedType = null;
  state.selectedUid = null;
  state.ghost = null;
  state.ghostAngle = 0;
  state.running = false;
  hideOverlay();
  game.reset(stage(), state.placed);
  buildTabs();
  buildPalette();
  $('hint').textContent = stage().hint;
}

function buildTabs() {
  const nav = $('stageTabs');
  nav.innerHTML = '';
  STAGES.forEach((s, i) => {
    const b = document.createElement('button');
    b.textContent = s.name;
    if (i === state.stageIndex) b.className = 'on';
    b.onclick = () => loadStage(i);
    nav.appendChild(b);
  });
}

function remaining(type) {
  const max = stage().inventory[type] ?? 0;
  return max - state.placed.filter(p => p.type === type).length;
}

function buildPalette() {
  const list = $('paletteList');
  list.innerHTML = '';
  for (const type of Object.keys(stage().inventory)) {
    const spec = PARTS[type];
    const b = document.createElement('button');
    b.className = 'pitem';
    b.title = spec.hint;
    const icon = document.createElement('canvas');
    const text = document.createElement('div');
    text.innerHTML = `<div class="nm">${spec.label}</div><div class="ct">のこり ${remaining(type)}</div>`;
    b.append(icon, text);
    b.onclick = () => {
      if (state.running || remaining(type) <= 0) return;
      state.selectedType = state.selectedType === type ? null : type;
      state.selectedUid = null;
      refreshPalette();
    };
    list.appendChild(b);
    drawIcon(icon, type);
  }
  refreshPalette();
}

function refreshPalette() {
  const items = $('paletteList').children;
  Object.keys(stage().inventory).forEach((type, i) => {
    const el = items[i];
    if (!el) return;
    const left = remaining(type);
    el.querySelector('.ct').textContent = `のこり ${left}`;
    el.classList.toggle('on', state.selectedType === type);
    el.classList.toggle('empty', left <= 0);
  });
  $('btnPlay').disabled = state.running;
  $('btnReset').disabled = !state.running;
}

// ---------- 座標・判定 ----------
function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) / r.width * WORLD_W,
    y: (e.clientY - r.top) / r.height * WORLD_H,
  };
}

const snap = (v, on) => (on ? Math.round(v / 10) * 10 : v);

function localOf(px, py, x, y, angle) {
  const dx = px - x, dy = py - y;
  const c = Math.cos(-angle), s = Math.sin(-angle);
  return { lx: dx * c - dy * s, ly: dx * s + dy * c };
}

function hitTest(p, x, y) {
  const spec = PARTS[p.type];
  const { lx, ly } = localOf(x, y, p.x, p.y, p.angle);
  return Math.abs(lx) <= spec.w / 2 + 8 && Math.abs(ly) <= spec.h / 2 + 8;
}

function pickAt(x, y) {
  for (let i = state.placed.length - 1; i >= 0; i--) if (hitTest(state.placed[i], x, y)) return state.placed[i];
  return null;
}

// 選択中パーツのハンドル（指でも押せるよう判定は広め）
function pickHandle(x, y) {
  const p = state.placed.find(q => q.uid === state.selectedUid);
  if (!p) return null;
  const h = handlesOf(p);
  for (const [name, c] of Object.entries(h)) {
    if (Math.hypot(x - c.x, y - c.y) <= c.r + 9) return { name, part: p };
  }
  return null;
}

function blocked(x, y) {
  if (x < 24 || x > WORLD_W - 24 || y < 24 || y > WORLD_H - 24) return true;
  const g = stage().goal;
  if (Math.abs(x - g.x) < g.w / 2 + 14 && Math.abs(y - g.y) < g.h / 2 + 14) return true;
  return stage().walls.some(w => {
    const { lx, ly } = localOf(x, y, w.x, w.y, w.angle || 0);
    return Math.abs(lx) < w.w / 2 + 6 && Math.abs(ly) < w.h / 2 + 6;
  });
}

// ---------- 編集操作 ----------
function place(x, y) {
  const type = state.selectedType;
  if (!type || remaining(type) <= 0 || blocked(x, y)) return;
  const p = { uid: state.uid++, type, x, y, angle: state.ghostAngle };
  state.placed.push(p);
  state.selectedUid = p.uid;
  if (remaining(type) <= 0) state.selectedType = null;
  save();
  refreshPalette();
}

// 回転の相手：カーソルの下 ＞ 選択中のパーツ ＞ これから置くゴースト
function rotate(dir = 1) {
  const step = (Math.PI / 12) * dir;
  const target = state.placed.find(p => p.uid === (state.hoverUid || state.selectedUid));
  if (target) {
    target.angle += step;
    state.ghostAngle = target.angle;
    save();
  } else {
    state.ghostAngle += step;
  }
  if (state.ghost) state.ghost.angle = state.ghostAngle;
}

function removeSelected() {
  const i = state.placed.findIndex(p => p.uid === state.selectedUid);
  if (i < 0) return;
  state.placed.splice(i, 1);
  state.selectedUid = null;
  save();
  refreshPalette();
}

// ---------- 再生 ----------
function play() {
  if (state.running) return;
  state.selectedType = null;
  state.ghost = null;
  game.reset(stage(), state.placed);
  game.start();
  state.running = true;
  hideOverlay();
  refreshPalette();
}

function back() {
  state.running = false;
  game.reset(stage(), state.placed);
  hideOverlay();
  refreshPalette();
}

function showOverlay(kind) {
  state.overlayShown = true;
  const cleared = kind === 'clear';
  $('ovTitle').textContent = cleared ? 'クリア！' : 'とどかなかった…';
  $('ovTitle').style.color = cleared ? 'var(--accent)' : '#ff8f8f';
  $('ovText').textContent = cleared
    ? `${(game.elapsed / 1000).toFixed(1)}秒でカゴに入りました`
    : 'パーツの角度と位置を直して、もう一度。';
  $('ovNext').style.display = cleared && state.stageIndex < STAGES.length - 1 ? '' : 'none';
  $('ovAgain').textContent = cleared ? 'もう一度' : 'なおす';
  $('overlay').classList.remove('hidden');
}

function hideOverlay() {
  state.overlayShown = false;
  $('overlay').classList.add('hidden');
}

// ---------- 入力 ----------
cv.addEventListener('pointerdown', (e) => {
  if (state.running) return;
  cv.setPointerCapture(e.pointerId);
  const { x, y } = toWorld(e);

  // まずハンドル（回す／消す）を拾う
  const handle = pickHandle(x, y);
  if (handle) {
    if (handle.name === 'del') { removeSelected(); return; }
    const p = handle.part;
    // 掴んだ位置を基準にした相対回転（触った瞬間に角度が飛ばないように）
    state.drag = {
      uid: p.uid, mode: 'rotate',
      grab: p.angle - (Math.atan2(y - p.y, x - p.x) + Math.PI / 2),
    };
    return;
  }

  const hit = pickAt(x, y);
  if (hit) {
    state.selectedUid = hit.uid;
    state.selectedType = null;
    state.ghost = null;
    state.drag = { uid: hit.uid, mode: 'move', dx: hit.x - x, dy: hit.y - y };
  } else if (state.selectedType) {
    place(snap(x, !e.shiftKey), snap(y, !e.shiftKey));
  } else {
    state.selectedUid = null;
  }
  refreshPalette();
});

cv.addEventListener('pointermove', (e) => {
  if (state.running) return;
  const { x, y } = toWorld(e);
  if (state.drag) {
    const p = state.placed.find(q => q.uid === state.drag.uid);
    if (!p) return;
    if (state.drag.mode === 'rotate') {
      const raw = Math.atan2(y - p.y, x - p.x) + Math.PI / 2 + state.drag.grab;
      const step = Math.PI / 12;
      p.angle = e.shiftKey ? raw : Math.round(raw / step) * step;
      state.ghostAngle = p.angle;
    } else {
      p.x = snap(x + state.drag.dx, !e.shiftKey);
      p.y = snap(y + state.drag.dy, !e.shiftKey);
    }
    return;
  }
  const hit = pickAt(x, y);
  state.hoverUid = hit ? hit.uid : null;
  cv.style.cursor = hit ? 'grab' : state.selectedType ? 'copy' : 'default';
  state.ghost = state.selectedType && !hit
    ? { type: state.selectedType, x: snap(x, !e.shiftKey), y: snap(y, !e.shiftKey), angle: state.ghostAngle }
    : null;
});

cv.addEventListener('pointerup', () => { if (state.drag) { state.drag = null; save(); } });
cv.addEventListener('pointerleave', () => { state.ghost = null; state.hoverUid = null; });

cv.addEventListener('wheel', (e) => {
  if (state.running) return;
  e.preventDefault();
  rotate(e.deltaY > 0 ? 1 : -1);
}, { passive: false });

cv.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (state.running) return;
  const { x, y } = toWorld(e);
  const hit = pickAt(x, y);
  if (hit) { state.selectedUid = hit.uid; removeSelected(); }
});

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); state.running ? back() : play(); }
  if (state.running) return;
  if (e.key === 'r' || e.key === 'R') rotate(e.shiftKey ? -1 : 1);
  if (e.key === 'Delete' || e.key === 'Backspace') removeSelected();
  if (e.key === 'Escape') { state.selectedType = null; state.selectedUid = null; state.ghost = null; refreshPalette(); }
});

$('btnPlay').onclick = play;
$('btnReset').onclick = back;
$('rhDismiss').onclick = () => $('rotateHint').classList.add('dismissed');
$('btnClear').onclick = () => {
  state.placed = [];
  state.selectedUid = null;
  save();
  refreshPalette();
};
$('ovAgain').onclick = back;
$('ovNext').onclick = () => loadStage(Math.min(STAGES.length - 1, state.stageIndex + 1));

// ---------- ループ ----------
let last = performance.now();
function drawFrame(now) {
  render(ctx, {
    game, stage: stage(), placed: state.placed,
    ghost: state.ghost, selectedUid: state.selectedUid,
    running: state.running, t: now / 1000,
  });
}
function loop(now) {
  const dt = Math.min(50, now - last);
  last = now;
  game.update(state.running ? 16.6667 : dt);
  if (state.running && game.result && !state.overlayShown) showOverlay(game.result);
  drawFrame(now);
  requestAnimationFrame(loop);
}

// ---------- デバッグ口（自動検証用。rAFが止まる環境でもコマ送りできる） ----------
window.__pita = {
  state, game,
  stages: () => STAGES.map(s => s.id),
  load: (i) => loadStage(i),
  put: (type, x, y, angle = 0) => {
    state.placed.push({ uid: state.uid++, type, x, y, angle });
    save(); refreshPalette();
  },
  clear: () => { state.placed = []; save(); refreshPalette(); },
  play,
  back,
  // 指定フレーム進めて結果を返す
  step: (frames = 60) => {
    for (let i = 0; i < frames && !game.result; i++) game.update(16.6667);
    if (state.running && game.result && !state.overlayShown) showOverlay(game.result);
    return { result: game.result, t: +(game.elapsed / 1000).toFixed(2), ball: game.ball && { x: Math.round(game.ball.position.x), y: Math.round(game.ball.position.y) } };
  },
  draw: (t = 0) => drawFrame(t * 1000),
};

setupCanvas();
loadStage(0);
requestAnimationFrame(loop);
