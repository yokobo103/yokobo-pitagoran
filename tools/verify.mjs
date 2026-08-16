// ヘッドレス検証。ブラウザペインが使えない環境でも
// 「起動するか・レイアウトが崩れていないか・全ステージ解けるか」を数で確認する。
//   node tools/verify.mjs           … 通常
//   node tools/verify.mjs --shot    … 盤面PNGも保存
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = 'dist';
const PORT = 8145;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

const server = http.createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  const file = join(ROOT, path === '/' ? 'index.html' : decodeURIComponent(path));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise(r => server.listen(PORT, r));

const browser = await puppeteer.launch({
  headless: true,
  timeout: 120000,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });

// --- 0. さわって進むチュートリアルが最後まで通るか ---
await new Promise(r => setTimeout(r, 500));
const coachSteps = [];
const coachOk = await page.evaluate(async () => {
  const log = [];
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const cv = document.getElementById('cv');
  const at = (wx, wy) => { const r = cv.getBoundingClientRect(); return { clientX: r.left + wx / 540 * r.width, clientY: r.top + wy / 810 * r.height }; };
  const ev = (t, wx, wy) => cv.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 1, pointerType: 'touch', ...at(wx, wy) }));
  const tap = (wx, wy) => { ev('pointerdown', wx, wy); ev('pointerup', wx, wy); };
  const drag = (wx, wy, tx, ty) => {
    ev('pointerdown', wx, wy);
    for (let i = 1; i <= 6; i++) ev('pointermove', wx + (tx - wx) * i / 6, wy + (ty - wy) * i / 6);
    ev('pointerup', tx, ty);
  };
  const snap = () => {
    const c = document.getElementById('coach');
    if (c.classList.contains('hidden')) return null;
    const h = document.getElementById('coachHole').getBoundingClientRect();
    return {
      step: document.getElementById('coachStep').textContent,
      text: document.getElementById('coachText').textContent,
      hole: [Math.round(h.width), Math.round(h.height)],
      // «変わる所» の2つ目の穴が出ているか
      hole2: !document.getElementById('coachHole2').classList.contains('hidden'),
    };
  };
  log.push(snap());                                        // 1 パレット
  document.querySelectorAll('.pitem')[0].click(); await wait(400);
  log.push(snap());                                        // 2 ばんめん
  tap(250, 300); await wait(400);
  log.push(snap());                                        // 3 ひっぱって うごかす
  drag(250, 300, 250, 380); await wait(400);
  log.push(snap());                                        // 4 スライダー
  // 実際のドラッグは input が何十回も飛ぶ。1回だけだと «進みすぎ» を見逃す
  const sl = document.getElementById('selAngle');
  for (const v of [15, 30, 45, 60, 45, 30, 15, 0, -15, -30, -45, -30, -15, 0, 15]) {
    sl.value = String(v); sl.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await wait(500);
  log.push(snap());                                        // 5 スタート
  document.getElementById('btnPlay').click(); await wait(3000);
  log.push(snap());                                        // 6 リセット（玉を見せてから）
  document.getElementById('btnReset').click(); await wait(400);
  log.push(snap());                                        // 7 とりけし
  document.getElementById('btnUndo').click(); await wait(400);
  log.push(snap());                                        // 終了 → null
  return log;
});
coachSteps.push(...coachOk);
await page.evaluate(() => { __pita.back(); __pita.load(0); __pita.clear(); localStorage.clear(); });
await page.reload({ waitUntil: 'networkidle0' });
await page.evaluate(() => { document.getElementById('coachSkip').click(); });

// --- 1. レイアウト ---
const layout = await page.evaluate(() => {
  document.getElementById('tutorial').classList.add('hidden');
  const r = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; };
  return {
    canvas: r('#cv'),
    side: r('.side'),
    paletteVisible: getComputedStyle(document.querySelector('.plist')).display !== 'none',
    selBarVisible: getComputedStyle(document.getElementById('selBar')).display !== 'none',
    playBtn: r('#btnPlay'),
    pageScroll: document.body.scrollHeight,
    viewport: [innerWidth, innerHeight],
    barLines: Math.round(document.querySelector('.bar').getBoundingClientRect().height),
  };
});

// --- 1.5 画面に漢字が出ていないか（5歳児が読めるように） ---
const kanji = await page.evaluate(() => {
  const K = /[一-鿿]/;
  const hits = new Set();
  const walk = (root) => {
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = it.nextNode())) {
      const t = n.textContent.trim();
      if (t && K.test(t)) hits.add(t.slice(0, 40));
    }
  };
  // 全ステージのタブ名・ヒント・パーツ名を一度ずつ表示させて調べる
  for (let i = 0; i < __pita.stages().length; i++) {
    __pita.load(i);
    walk(document.body);
    document.querySelectorAll('[title]').forEach(e => { if (K.test(e.title)) hits.add('title: ' + e.title); });
  }
  __pita.load(0);
  return [...hits];
});

// --- 1.7 キャラ画像がちゃんと読めているか ---
// 隠れた要素の img.decode() は解決しないことがあるので、素直に読み直して確かめる
const images = await page.evaluate(async () => {
  const inDom = [...document.querySelectorAll('img')].map(i => i.getAttribute('src'));
  // 失敗時だけ差し替わる画像はDOMに出ていないので足す
  const oops = inDom.find(s => s.includes('chara-nyabbit'))?.replace('chara-nyabbit', 'chara-nyabbit-oops');
  const srcs = [...new Set([...inDom, oops].filter(Boolean))];
  const out = {};
  await Promise.all(srcs.map(src => new Promise((res) => {
    const probe = new Image();
    probe.onload = () => { out[src] = `ok ${probe.naturalWidth}x${probe.naturalHeight}`; res(); };
    probe.onerror = () => { out[src] = 'よみこめない'; res(); };
    probe.src = src;
  })));
  return out;
});

// --- 2. 指で触れるか（合成タッチで置く→掴む→回す→消す） ---
const touch = await page.evaluate(() => {
  const cv = document.getElementById('cv');
  const at = (wx, wy) => { const r = cv.getBoundingClientRect(); return { clientX: r.left + wx / 540 * r.width, clientY: r.top + wy / 810 * r.height }; };
  const pe = (t, wx, wy) => cv.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 1, pointerType: 'touch', ...at(wx, wy) }));
  const paletteShown = () => getComputedStyle(document.querySelector('.plist')).display !== 'none';
  const out = {};
  __pita.back(); __pita.load(0); __pita.clear();

  document.querySelectorAll('.pitem')[0].click();
  pe('pointerdown', 250, 300); pe('pointerup', 250, 300);
  out.placed = __pita.state.placed.length;
  out.paletteStaysAfterPlace = paletteShown();

  // わざと 22px ずらして掴めるか（指の «外し» の再現）
  document.querySelectorAll('.pitem')[0].click();  // 置くモード解除
  pe('pointerdown', 250, 322); pe('pointerup', 250, 322);
  out.grabbedWhenOff22 = !!__pita.state.selectedUid;
  out.paletteStillShownWhileSelected = paletteShown();

  // 盤外へドラッグしても消えないか
  pe('pointerdown', 250, 300);
  pe('pointermove', 900, 1200);
  pe('pointerup', 900, 1200);
  const p = __pita.state.placed[0];
  out.afterDragOffBoard = [Math.round(p.x), Math.round(p.y)];
  out.stillOnBoard = p.x > 0 && p.x < 540 && p.y > 0 && p.y < 810;

  // スライダーで回る
  const sl = document.getElementById('selAngle');
  sl.value = '45'; sl.dispatchEvent(new Event('input', { bubbles: true }));
  out.angleAfterSlider = document.getElementById('selDeg').textContent;

  document.getElementById('selDel').click();
  out.afterDelete = __pita.state.placed.length;

  // とりけしで戻るか
  document.getElementById('btnUndo').click();
  out.afterUndo = __pita.state.placed.length;

  // ぜんぶ消すは2段階か（1回目では消えない）
  document.getElementById('btnClear').click();
  out.clearNeedsConfirm = __pita.state.placed.length > 0;
  document.getElementById('btnClear').click();
  out.afterConfirmedClear = __pita.state.placed.length;
  document.getElementById('btnUndo').click();
  out.undoAfterClear = __pita.state.placed.length;
  return out;
});

// --- 3. 全ステージが解けるか ---
const stages = await page.evaluate(() => {
  const SOL = {
    0: [['rail', 200, 250, 0.25], ['rail', 300, 570, 0.35]],
    1: [270, 325, 405, 440].map(x => ['domino', x, 279, 0]),
    2: [['jump', 235, 300, 0.3]],
    3: [['tramp', 240, 420, 0.15]],
    4: [['rail', 468, 679, 0.18], ['rail', 372, 587, 0.57], ['belt', 272, 322, 0.22]],
    5: [['seesaw', 310, 400, 0]],
    6: [['plate', 205, 406, -0.13], ['plate', 191, 665, 0.86]],
    7: [['rail', 219, 269, 0.8]],
    8: [['plate', 219, 269, 0.8]],
    9: [['tramp', 254, 370, 0.4]],
    10: [['rail', 177, 371, 0.84], ['plate', 236, 403, 0.64], ['rail', 126, 345, -0.25]],
    11: [['domino', 438, 223, 0.04]],
    12: [['fan', 177, 371, 0.84], ['plate', 236, 403, 0.64], ['fan', 126, 345, -0.25]],
    13: [['jump', 166, 249, 0.33], ['jump', 180, 326, -0.16]],
    14: [['rail', 278, 651, 0.22], ['rail', 329, 517, -0.2], ['plate', 348, 327, 0.59]],
    15: [['rail', 240, 230, 0.15]],
    16: [['rail', 342, 520, 0.49], ['rail', 278, 197, 0.07]],
    17: [['rail', 278, 651, 0.22], ['rail', 329, 517, -0.2], ['plate', 348, 327, 0.59]],
    18: [['plate', 219, 269, 0.8]],
    19: [['plate', 177, 371, 0.84], ['tramp', 236, 403, 0.64], ['rail', 126, 345, -0.25]],
  };
  const names = __pita.stages();
  const out = {};
  for (const k of Object.keys(SOL)) {
    __pita.back(); __pita.load(+k); __pita.clear();
    SOL[k].forEach(p => __pita.put(...p));
    __pita.play();
    for (let i = 0; i < 1200 && !__pita.game.result; i++) __pita.game.update(16.6667);
    out[names[k]] = __pita.game.result === 'clear' ? +(__pita.game.elapsed / 1000).toFixed(1) : 'FAIL';
  }
  return out;
});

if (process.argv.includes('--shot')) {
  await mkdir('screenshots', { recursive: true });
  await page.evaluate(() => { __pita.back(); __pita.load(0); __pita.clear(); });
  await writeFile('screenshots/verify_page.png', await page.screenshot());
  await page.evaluate(() => document.getElementById('btnHelp').click());
  await writeFile('screenshots/verify_help.png', await page.screenshot());
  // クリア画面（キャラつき）
  await page.evaluate(() => {
    document.getElementById('tutorial').classList.add('hidden');
    __pita.back(); __pita.load(0); __pita.clear();
    [['rail', 200, 250, 0.25], ['rail', 300, 570, 0.35]].forEach(p => __pita.put(...p));
    __pita.play();
    for (let i = 0; i < 900 && !__pita.game.result; i++) __pita.game.update(16.6667);
  });
  await new Promise(r => setTimeout(r, 600));
  await writeFile('screenshots/verify_clear.png', await page.screenshot());
  // コーチの各ステップも撮る
  await page.evaluate(() => { document.getElementById('tutorial').classList.add('hidden'); coachStart(); });
  const acts = [
    () => document.querySelectorAll('.pitem')[0].click(),
    'tap', 'tap',
    () => { const s = document.getElementById('selAngle'); s.value = '30'; s.dispatchEvent(new Event('input', { bubbles: true })); },
    () => document.getElementById('btnPlay').click(),
    () => document.getElementById('btnReset').click(),
  ];
  for (let i = 0; i < acts.length; i++) {
    await new Promise(r => setTimeout(r, i === 5 ? 3000 : 500));
    await writeFile(`screenshots/verify_coach${i + 1}.png`, await page.screenshot());
    await page.evaluate((n) => {
      const cv = document.getElementById('cv');
      const r = cv.getBoundingClientRect();
      const ev = (t, wx, wy) => cv.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: r.left + wx / 540 * r.width, clientY: r.top + wy / 810 * r.height }));
      const fns = [
        () => document.querySelectorAll('.pitem')[0].click(),
        () => { ev('pointerdown', 250, 300); ev('pointerup', 250, 300); },
        () => {
          ev('pointerdown', 250, 300);
          for (let i = 1; i <= 6; i++) ev('pointermove', 250, 300 + i * 14);
          ev('pointerup', 250, 384);
        },
        () => {
          const s = document.getElementById('selAngle');
          for (const v of [15, 30, 45, 30, 15]) { s.value = String(v); s.dispatchEvent(new Event('input', { bubbles: true })); }
        },
        () => document.getElementById('btnPlay').click(),
        () => document.getElementById('btnReset').click(),
      ];
      fns[n]();
    }, i);
  }
  await new Promise(r => setTimeout(r, 500));
  await writeFile('screenshots/verify_coach7.png', await page.screenshot());
}

await browser.close();
server.close();

const failed = Object.entries(stages).filter(([, v]) => v === 'FAIL').map(([k]) => k);
// 各スナップが «期待どおりの番号» を出しているかまで見る（進みすぎの検出）
const expect = ['1 / 7', '2 / 7', '3 / 7', '4 / 7', '5 / 7', '6 / 7', '7 / 7'];
const seen = coachSteps.slice(0, 7).map(s => (s ? s.step : 'なし'));
// 4歩目（かたむき）では «変わる所» の穴も出ていること
const twoHoles = coachSteps[3] && coachSteps[3].hole2 === true;
const coachDone = coachSteps.length === 8 && coachSteps[7] === null
  && expect.every((e, i) => seen[i] === e) && twoHoles;
console.log('--- errors ---', errors.length ? errors : 'none');
console.log('--- coach  ---', coachDone
  ? '7ステップを順に通過→自動で終了（かたむきは穴2つ）'
  : { expect, seen, twoHoles });
console.log('--- layout ---', layout);
console.log('--- kanji  ---', kanji.length ? kanji : 'none (all kana)');
console.log('--- images ---', images);
console.log('--- touch  ---', touch);
console.log('--- stages ---', failed.length ? `FAILED: ${failed.join(', ')}` : `all ${Object.keys(stages).length} clear`);
const badImg = Object.values(images).filter(v => v !== 'ok' && !v.startsWith('ok'));
process.exit(errors.length || failed.length || kanji.length || !coachDone || badImg.length ? 1 : 0);
