// 記事用の画像を作る。
//   node tools/shots.mjs
// 出力: screenshots/article/
//
// 物理をコマ送りできるので «狙った瞬間» を確実に撮れる。
// ドミノの比較は «補助だけ外した» 対照実験（他の条件は全部同じ）。
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = 'dist', PORT = 8146, OUT = 'screenshots/article';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  const f = join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  try {
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(await readFile(f));
  } catch { res.writeHead(404).end('x'); }
});
await new Promise(r => server.listen(PORT, r));
await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true, timeout: 120000,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
page.setDefaultNavigationTimeout(120000);
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 900));
await page.evaluate(() => { localStorage.clear(); });
await page.reload({ waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 400));
await page.evaluate(() => { document.getElementById('coachSkip').click(); document.getElementById('tutorial').classList.add('hidden'); });

const board = async (name) => {
  const el = await page.$('#cv');
  await writeFile(join(OUT, name), await el.screenshot());
  console.log('  ' + name);
};

// 盤面のワールド座標で切り出す（小さいパーツを見せたいとき）
const boardCrop = async (name, wx, wy, ww, wh) => {
  const clip = await page.evaluate((a) => {
    const r = document.getElementById('cv').getBoundingClientRect();
    const sx = r.width / 540, sy = r.height / 810;
    return { x: r.left + a.wx * sx, y: r.top + a.wy * sy, width: a.ww * sx, height: a.wh * sy };
  }, { wx, wy, ww, wh });
  await writeFile(join(OUT, name), await page.screenshot({ clip }));
  console.log('  ' + name);
};
const full = async (name) => {
  await writeFile(join(OUT, name), await page.screenshot());
  console.log('  ' + name);
};

// 1. どんなゲームか（ステージ1・部品なし）
await page.evaluate(() => { __pita.back(); __pita.load(0); __pita.clear(); __pita.draw(0.5); });
await board('01-board.png');

// 2-3. ドミノ：補助あり／なし（他の条件は同じ）
const dominoRun = (assist) => page.evaluate((on) => {
  __pita.back(); __pita.load(1); __pita.clear();
  [270, 325, 405, 440].forEach(x => __pita.put('domino', x, 279, 0));
  __pita.play();
  const g = __pita.game;
  if (!on) g.assistDominoes = () => {};          // 補助«だけ» 外す
  else delete g.assistDominoes;
  for (let i = 0; i < 420 && !g.result; i++) g.update(16.6667);
  g.confetti = [];                                              // 紙ふぶきで盤面を隠さない
  __pita.state.overlayShown = true;                             // rAFループに出させない
  document.getElementById('overlay').classList.add('hidden');   // 盤面を隠さない
  __pita.draw(0.5);
  return g.instances.slice(1).map(o => Math.round(o.body.angle * 57));
}, assist);

console.log('  ドミノ 補助なし:', await dominoRun(false));
await boardCrop('02-domino-off.png', 170, 195, 360, 200);
console.log('  ドミノ 補助あり:', await dominoRun(true));
await boardCrop('03-domino-on.png', 170, 195, 360, 200);

// 4. 実機の画面まるごと（縦持ち）
await page.evaluate(() => {
  __pita.back(); __pita.load(0); __pita.clear();
  [['rail', 200, 250, 0.25], ['rail', 300, 570, 0.35]].forEach(p => __pita.put(...p));
});
await full('04-phone.png');

// 5. さわって進むチュートリアル（さわる所と変わる所が同時に光る）
await page.evaluate(async () => {
  const cv = document.getElementById('cv');
  const r = cv.getBoundingClientRect();
  const ev = (t, wx, wy) => cv.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: r.left + wx / 540 * r.width, clientY: r.top + wy / 810 * r.height }));
  const wait = (ms) => new Promise(res => setTimeout(res, ms));
  coachStart(); await wait(400);
  document.querySelectorAll('.pitem')[0].click(); await wait(400);
  ev('pointerdown', 250, 300); ev('pointerup', 250, 300); await wait(400);
  ev('pointerdown', 250, 300);
  for (let i = 1; i <= 6; i++) ev('pointermove', 250, 300 + i * 14);
  ev('pointerup', 250, 384); await wait(500);
});
await full('05-coach.png');

// 6. クリアの瞬間
await page.evaluate(() => {
  document.getElementById('coachSkip').click();
  __pita.back(); __pita.load(0); __pita.clear();
  [['rail', 200, 250, 0.25], ['rail', 300, 570, 0.35]].forEach(p => __pita.put(...p));
  __pita.play();
  for (let i = 0; i < 900 && !__pita.game.result; i++) __pita.game.update(16.6667);
  __pita.step(1);
});
await new Promise(r => setTimeout(r, 500));
await full('06-clear.png');

await browser.close();
server.close();
console.log('→ ' + OUT);
