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

// --- とりけし（Undo）。子どもは必ず誤操作するので、戻れることを最優先にする ---
let history = [];
const snapshot = () => JSON.stringify(state.placed.map(({ type, x, y, angle }) => ({ type, x, y, angle })));
function pushHistory() {
  history.push(snapshot());
  if (history.length > 40) history.shift();
}
function undo() {
  if (state.running || !history.length) return;
  state.placed = JSON.parse(history.pop()).map(p => ({ ...p, uid: state.uid++ }));
  state.selectedUid = null;
  state.drag = null;
  save();
  refreshPalette();
  coach.notify('undo');
}

// ---------- 保存 ----------
const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
function save() {
  saved[stage().id] = state.placed.map(({ type, x, y, angle }) => ({ type, x, y, angle }));
  localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
}

// ---------- 初期化 ----------
// マウスがある環境だけ盤面上のハンドルを出す。指では小さすぎて追えないので操作卓に任せる。
const FINE_POINTER = window.matchMedia('(pointer: fine)').matches;

// --- ブラウザの拡大を止める ---
// iOS Safari は viewport の user-scalable=no を無視するので、JS側で塞ぐしかない。
// パーツをドラッグ中に2本目の指が触れたり、素早い2連続タップで «勝手に拡大» するのを防ぐ。
function blockZoomGestures() {
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = performance.now();
    // ボタンやスライダーの連打は殺さない（↻ を続けて押せなくなるため）
    if (now - lastTouchEnd < 350 && !e.target.closest('button, input')) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
}

// それでも拡大されてしまった時の逃げ道。戻せなくなるのが一番困る。
function setupZoomEscape() {
  const vv = window.visualViewport;
  const chip = $('zoomReset');
  if (!vv || !chip) return;
  const meta = document.querySelector('meta[name=viewport]');
  const BASE = meta.getAttribute('content');
  const check = () => chip.classList.toggle('hidden', vv.scale <= 1.02);
  vv.addEventListener('resize', check);
  vv.addEventListener('scroll', check);
  chip.onclick = () => {
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0');
    window.scrollTo(0, 0);
    setTimeout(() => { meta.setAttribute('content', BASE); check(); }, 120);
  };
  check();
}

function setupCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = WORLD_W * dpr;
  cv.height = WORLD_H * dpr;
  cv.style.aspectRatio = `${WORLD_W} / ${WORLD_H}`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const selected = () => state.placed.find(p => p.uid === state.selectedUid) || null;
const TAU = Math.PI * 2;
const degOf = (rad) => Math.round((((rad % TAU) + TAU + Math.PI) % TAU - Math.PI) * 180 / Math.PI);

// 選択中パーツの操作卓を実際の角度に合わせる
function refreshSelBar() {
  const p = selected();
  const bar = $('selBar');
  const on = !!p && !state.running;
  bar.classList.toggle('active', on);
  $('selCtl').classList.toggle('hidden', !on);
  $('selHelp').style.display = on ? 'none' : '';
  // 選んでいないときは «そのステージの目的» を出す。スマホでは他に出す場所がない
  if (!on) { $('selHelp').textContent = stage().hint; return; }
  $('selName').textContent = PARTS[p.type].label;
  const deg = degOf(p.angle);
  $('selDeg').textContent = `${deg}°`;
  const slider = $('selAngle');
  if (document.activeElement !== slider) slider.value = String(deg);
}

function setAngle(p, deg) {
  p.angle = deg * Math.PI / 180;
  state.ghostAngle = p.angle;
  save();
  refreshSelBar();
  coach.notify('rotate');
}

function loadStage(i) {
  state.stageIndex = i;
  // 過去に盤外へ出してしまった配置も、読み込み時に拾い直す
  state.placed = (saved[stage().id] || []).map(p => clampToBoard({ ...p, uid: state.uid++ }));
  state.selectedType = null;
  state.selectedUid = null;
  state.ghost = null;
  state.ghostAngle = 0;
  state.running = false;
  history = [];
  hideOverlay();
  game.reset(stage(), state.placed);
  buildTabs();
  buildPalette();
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
  // ステージが増えたのでタブは横スクロールする。現在地を見える位置へ寄せる
  const active = nav.querySelector('button.on');
  if (active) active.scrollIntoView({ inline: 'center', block: 'nearest' });
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
      if (state.selectedType) coach.notify('pick');
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
  $('btnUndo').disabled = state.running || !history.length;
  refreshSelBar();
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

// パーツまでの距離（中に入っていれば0）。指の «外し» を許すために使う
function distToPart(p, x, y) {
  const spec = PARTS[p.type];
  const { lx, ly } = localOf(x, y, p.x, p.y, p.angle);
  const dx = Math.max(0, Math.abs(lx) - spec.w / 2);
  const dy = Math.max(0, Math.abs(ly) - spec.h / 2);
  let d = Math.hypot(dx, dy);
  // ふりこのように «置く点» と «見た目の本体» が離れるパーツは本体側でも拾う
  if (spec.editPos) {
    const at = spec.editPos(p);
    d = Math.min(d, Math.max(0, Math.hypot(x - at.x, y - at.y) - Math.max(spec.w, spec.h) / 2));
  }
  return d;
}

// レールは画面上たった8px。ぴったり当てるのは指には無理なので、
// «一番近いパーツ» を拾う。置く途中（パレット選択中）は誤爆しないよう判定を狭める。
function pickAt(x, y) {
  const reach = state.selectedType ? 18 : 32;
  let best = null;
  let bestD = reach;
  for (const p of state.placed) {
    const d = distToPart(p, x, y);
    if (d <= bestD) { bestD = d; best = p; }
  }
  return best;
}

// 盤面の外へ持ち出せてしまうと «消えた» ように見えるので、必ず内側に留める
const EDGE = 22;
const clampToBoard = (p) => {
  p.x = Math.min(WORLD_W - EDGE, Math.max(EDGE, p.x));
  p.y = Math.min(WORLD_H - EDGE, Math.max(EDGE, p.y));
  return p;
};

// 盤面上のハンドル（マウス環境のみ。判定は広め）
function pickHandle(x, y) {
  if (!FINE_POINTER) return null;
  const p = selected();
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
  pushHistory();
  const p = { uid: state.uid++, type, x, y, angle: state.ghostAngle };
  state.placed.push(p);
  // 置いた直後は «選択しない»。パレットを出したまま連続で置けるようにする
  // （ドミノを何本も並べる時にここで詰まる）
  state.selectedUid = null;
  if (remaining(type) <= 0) state.selectedType = null;
  save();
  refreshPalette();
  coach.notify('place');
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
  refreshSelBar();
}

function removeSelected() {
  const i = state.placed.findIndex(p => p.uid === state.selectedUid);
  if (i < 0) return;
  pushHistory();
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
  coach.notify('play');
}

function back() {
  state.running = false;
  game.reset(stage(), state.placed);
  hideOverlay();
  refreshPalette();
  coach.notify('reset');
}

function showOverlay(kind) {
  state.overlayShown = true;
  const cleared = kind === 'clear';
  $('ovTitle').textContent = cleared ? 'クリア！' : 'とどかなかった…';
  $('ovTitle').style.color = cleared ? 'var(--accent)' : '#ff8f8f';
  $('ovText').textContent = cleared
    ? `${(game.elapsed / 1000).toFixed(1)}びょうで カゴに はいったよ`
    : 'パーツを うごかして もういちど';
  $('ovNext').style.display = cleared && state.stageIndex < STAGES.length - 1 ? '' : 'none';
  $('ovAgain').textContent = cleared ? 'もういちど' : 'なおす';
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
    pushHistory();
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
    pushHistory();
    state.drag = { uid: hit.uid, mode: 'move', dx: hit.x - x, dy: hit.y - y, moved: 0 };
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
      refreshSelBar();
    } else {
      const ox = p.x, oy = p.y;
      p.x = snap(x + state.drag.dx, !e.shiftKey);
      p.y = snap(y + state.drag.dy, !e.shiftKey);
      clampToBoard(p);
      state.drag.moved = (state.drag.moved || 0) + Math.hypot(p.x - ox, p.y - oy);
      if (state.drag.moved > 24) coach.notify('move');
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
// --- さわって進むチュートリアル ---
// 光った所を «実際に操作する» と次へ進む。読ませずに手で覚えてもらう。
const coach = {
  i: -1,
  active: false,
  steps: [
    {
      on: 'pick', text: 'まず したの パーツを えらぼう',
      target: () => document.querySelector('.pitem'),
    },
    {
      on: 'place', text: 'ばんめんを タップして おいてみよう',
      target: () => cv.getBoundingClientRect(),
    },
    {
      on: 'move', text: 'おいた パーツを ゆびで ひっぱって うごかしてみよう',
      target: () => partRect(),
    },
    {
      // «さわる所»（スライダー）と «変わる所»（パーツ）を同時に光らせる
      on: 'rotate', text: 'まるを よこに うごかすと パーツが かたむくよ',
      target: () => $('selAngle'),
      also: () => partRect(),
    },
    {
      on: 'play', text: 'できた！ ▶ スタート を おしてみよう',
      target: () => $('btnPlay'),
    },
    {
      // 玉が転がるのを少し見せてから
      on: 'reset', text: 'たまを もどすときは ⟲ リセット', wait: 2600,
      target: () => $('btnReset'),
    },
    {
      on: 'undo', text: 'まちがえたら ↩ とりけし。ひとつ もどせるよ',
      target: () => $('btnUndo'),
    },
  ],

  start() {
    loadStage(0);
    state.placed = [];
    history = [];
    save();
    refreshPalette();
    $('tutorial').classList.add('hidden');
    this.active = true;
    this.pending = false;
    this.i = -1;
    this.next();
  },

  next() {
    this.i++;
    if (this.i >= this.steps.length) return this.stop();
    const step = this.steps[this.i];
    const go = () => { $('coach').classList.remove('hidden'); this.show(); };
    if (step.wait) {
      // 待っている間に先へ進んでいたら、もう出さない
      const at = this.i;
      $('coach').classList.add('hidden');
      this.mark(null);
      setTimeout(() => { if (this.active && this.i === at) go(); }, step.wait);
    } else go();
  },

  // 光っている «当の要素» にも動きを付ける（枠だけでは気づきにくい）
  mark(el) {
    if (this.marked) this.marked.classList.remove('coach-target');
    this.marked = el instanceof Element ? el : null;
    if (this.marked) this.marked.classList.add('coach-target');
  },

  show() {
    const step = this.steps[this.i];
    if (!step) return;
    const t = step.target();
    const r = t instanceof Element ? t.getBoundingClientRect() : t;
    if (!r || !r.width) return this.stop();
    this.mark(t);

    const pad = 7;
    const hole = $('coachHole');
    // 小さいものには指を添える。盤面のような大きい枠には要らない
    hole.classList.toggle('withhand', r.width < 220);
    setBox(hole, r, pad);
    setMaskHole('coachHoleA', r, pad);

    // «変わる所» の穴（あれば）
    const r2 = step.also ? step.also() : null;
    const hole2 = $('coachHole2');
    hole2.classList.toggle('hidden', !r2);
    if (r2) { setBox(hole2, r2, pad); setMaskHole('coachHoleB', r2, pad); }
    else setMaskHole('coachHoleB', { left: -99, top: -99, width: 0, height: 0 }, 0);

    const bg = { width: window.innerWidth, height: window.innerHeight };
    for (const id of ['coachMaskBg', 'coachDim']) {
      const el = document.getElementById(id);
      el.setAttribute('width', bg.width);
      el.setAttribute('height', bg.height);
    }

    $('coachStep').textContent = `${this.i + 1} / ${this.steps.length}`;
    $('coachText').textContent = step.text;

    // 光っている所を隠さない側に吹き出しを出す
    const tip = $('coachTip');
    const h = tip.offsetHeight || 90;
    const above = r.top > h + 24;
    tip.style.top = `${above ? r.top - h - 16 : r.top + r.height + 16}px`;
    tip.style.left = `${Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
  },

  notify(ev) {
    // スライダーの input は動かす間に何十回も飛ぶ。
    // 予約を1つに絞らないと、その回数だけ先へ進んでしまう。
    if (!this.active || this.pending) return;
    const step = this.steps[this.i];
    if (!step || step.on !== ev) return;
    this.pending = true;
    setTimeout(() => { this.pending = false; this.next(); }, 260);
  },

  stop() {
    this.active = false;
    this.mark(null);
    $('coach').classList.add('hidden');
    localStorage.setItem(TUT_KEY, '1');
  },
};

const setBox = (el, r, pad) => {
  el.style.left = `${r.left - pad}px`;
  el.style.top = `${r.top - pad}px`;
  el.style.width = `${r.width + pad * 2}px`;
  el.style.height = `${r.height + pad * 2}px`;
};

const setMaskHole = (id, r, pad) => {
  const el = document.getElementById(id);
  el.setAttribute('x', r.left - pad);
  el.setAttribute('y', r.top - pad);
  el.setAttribute('width', Math.max(0, r.width + pad * 2));
  el.setAttribute('height', Math.max(0, r.height + pad * 2));
};

// 置いたパーツの «画面上» の位置（盤面はワールド座標なので変換する）
function partRect() {
  const p = selected() || state.placed[state.placed.length - 1];
  const r = cv.getBoundingClientRect();
  if (!p) return r;
  const sx = r.width / WORLD_W;
  const sy = r.height / WORLD_H;
  const spec = PARTS[p.type];
  const w = Math.max(spec.w, 70) * sx;
  const h = Math.max(spec.h, 70) * sy;
  return { left: r.left + p.x * sx - w / 2, top: r.top + p.y * sy - h / 2, width: w, height: h };
}

$('coachSkip').onclick = () => coach.stop();
window.addEventListener('resize', () => { if (coach.active) coach.show(); });

// --- あそびかた（初回だけ自動で出す） ---
const TUT_KEY = 'pitagoran.tutorial.seen';
const showTutorial = () => $('tutorial').classList.remove('hidden');
$('btnHelp').onclick = () => { coach.stop(); showTutorial(); };
$('tutClose').onclick = () => {
  $('tutorial').classList.add('hidden');
  localStorage.setItem(TUT_KEY, '1');
};
$('tutCoach').onclick = () => coach.start();

// --- 選択中パーツの操作卓 ---
$('selAngle').addEventListener('input', (e) => {
  const p = selected();
  if (p) setAngle(p, Number(e.target.value));
});
$('selRotL').onclick = () => { const p = selected(); if (p) { pushHistory(); setAngle(p, degOf(p.angle) - 15); } };
$('selRotR').onclick = () => { const p = selected(); if (p) { pushHistory(); setAngle(p, degOf(p.angle) + 15); } };
$('selDel').onclick = removeSelected;
// スライダーは連続で発火するので、掴んだ瞬間に1回だけ控える
$('selAngle').addEventListener('pointerdown', () => { if (selected()) pushHistory(); });

$('btnUndo').onclick = undo;

// 「ぜんぶ消す」は誤爆すると全部消えるので2段階にする
let clearArmed = null;
$('btnClear').onclick = () => {
  const b = $('btnClear');
  if (!clearArmed) {
    b.textContent = 'ほんとに?';
    b.classList.add('armed');
    clearArmed = setTimeout(() => {
      b.textContent = '🗑'; b.classList.remove('armed'); clearArmed = null;
    }, 2500);
    return;
  }
  clearTimeout(clearArmed); clearArmed = null;
  b.textContent = '🗑'; b.classList.remove('armed');
  pushHistory();
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
    running: state.running, t: now / 1000, showHandles: FINE_POINTER,
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
window.coachStart = () => coach.start();

blockZoomGestures();
setupZoomEscape();
setupCanvas();
loadStage(0);
requestAnimationFrame(loop);

// はじめて来た人は、読ませずに «さわって覚える» 方へ案内する
if (!localStorage.getItem(TUT_KEY)) setTimeout(() => coach.start(), 250);
