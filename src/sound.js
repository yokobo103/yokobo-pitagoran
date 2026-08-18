// 音。WebAudioでその場で合成する。
//
// 録った音を貼らないのは、物理ゲームでは «ぶつかった速さ» で音が変わることが
// 気持ちよさの大半だから。同じ音が繰り返されると一気に安っぽくなる。
// 副次的に、音源ファイルが0バイトで済む。

let ctx = null;
let master = null;
let noise = null;
let muted = localStorage.getItem('pitagoran.mute') === '1';

const now = () => ctx.currentTime;

function noiseBuffer() {
  if (noise) return noise;
  const n = ctx.sampleRate * 0.4;
  noise = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

// 最初のタップまで AudioContext は作れない（ブラウザの自動再生制限）
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
}

export function setMuted(v) {
  muted = v;
  localStorage.setItem('pitagoran.mute', v ? '1' : '0');
  if (master) master.gain.value = v ? 0 : 0.5;
}
export const isMuted = () => muted;
export const audioState = () => (ctx ? ctx.state : 'なし');

// ---- 音のもと ----
function burst({ dur = 0.06, freq = 1200, q = 6, gain = 0.3, type = 'bandpass', delay = 0 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  const t = now() + delay;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.03);
}

function tone({ freq, dur = 0.18, type = 'sine', gain = 0.2, to = null, delay = 0 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = now() + delay;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.03);
}

// 鳴りすぎ防止。ぶつかる音は連発するので間引く
const last = {};
function throttled(key, ms) {
  const t = performance.now();
  if (last[key] && t - last[key] < ms) return false;
  last[key] = t;
  return true;
}

const ready = () => ctx && !muted;

export const sfx = {
  // 玉や板がぶつかる音。«速さ» が音の高さと大きさになる
  hit(speed, kind) {
    if (!ready() || !throttled('hit', 45)) return;
    const v = Math.min(1, speed / 15);
    if (kind === 'domino') {
      burst({ dur: 0.05, freq: 900 + v * 700, q: 3, gain: 0.10 + v * 0.16 });
      tone({ freq: 260 + v * 90, dur: 0.05, type: 'triangle', gain: 0.05 + v * 0.06 });
    } else {
      burst({ dur: 0.035, freq: 1500 + v * 1800, q: 8, gain: 0.05 + v * 0.13 });
    }
  },

  boing(power = 1) {
    if (!ready() || !throttled('boing', 90)) return;
    tone({ freq: 180, to: 620 * power, dur: 0.22, type: 'triangle', gain: 0.24 });
    burst({ dur: 0.05, freq: 2200, q: 4, gain: 0.08 });
  },

  warp() {
    if (!ready() || !throttled('warp', 120)) return;
    tone({ freq: 320, to: 1500, dur: 0.28, type: 'sine', gain: 0.16 });
    burst({ dur: 0.3, freq: 2600, q: 1.2, gain: 0.06, type: 'highpass' });
  },

  click() {
    if (!ready() || !throttled('click', 120)) return;
    tone({ freq: 880, dur: 0.07, type: 'square', gain: 0.12 });
    tone({ freq: 1320, dur: 0.10, type: 'square', gain: 0.08, delay: 0.06 });
  },

  // UI: パーツを置く／消す
  pop() {
    if (!ready()) return;
    tone({ freq: 520, to: 780, dur: 0.09, type: 'sine', gain: 0.16 });
  },
  erase() {
    if (!ready()) return;
    tone({ freq: 520, to: 260, dur: 0.10, type: 'sine', gain: 0.14 });
  },

  // クリア。ここが一番の «ごほうび»
  fanfare(big = false) {
    if (!ready()) return;
    const notes = big
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5]     // ぜんぶクリア
      : [523.25, 659.25, 783.99, 1046.5];            // ふつうのクリア
    notes.forEach((f, i) => {
      tone({ freq: f, dur: 0.42, type: 'triangle', gain: 0.22, delay: i * 0.10 });
      tone({ freq: f * 2, dur: 0.26, type: 'sine', gain: 0.07, delay: i * 0.10 });
    });
    burst({ dur: 0.5, freq: 5200, q: 0.8, gain: 0.05, type: 'highpass', delay: 0.02 });
  },

  fail() {
    if (!ready()) return;
    tone({ freq: 392, dur: 0.20, type: 'triangle', gain: 0.18 });
    tone({ freq: 294, dur: 0.34, type: 'triangle', gain: 0.16, delay: 0.16 });
  },
};
