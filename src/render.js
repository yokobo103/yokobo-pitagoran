// 描画。編集中は配置データを、実行中は物理ボディの姿勢を見て同じ絵を描く。
import { PARTS } from './parts.js';
import { WORLD_W, WORLD_H, } from './stages.js';
import { BALL_R } from './game.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, editing, t) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, '#101a2c');
  g.addColorStop(0.55, '#152539');
  g.addColorStop(1, '#0d1622');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.save();
  ctx.globalAlpha = 0.5;
  const r = ctx.createRadialGradient(WORLD_W * 0.5, -120, 40, WORLD_W * 0.5, -120, 780);
  r.addColorStop(0, 'rgba(120,190,255,.30)');
  r.addColorStop(1, 'rgba(120,190,255,0)');
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.restore();

  if (editing) {
    ctx.fillStyle = 'rgba(160,200,255,.13)';
    for (let x = 20; x < WORLD_W; x += 20)
      for (let y = 20; y < WORLD_H; y += 20) ctx.fillRect(x - 1, y - 1, 2, 2);
  }
}

function drawWalls(ctx, stage) {
  for (const w of stage.walls) {
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.angle || 0);
    if (w.style === 'ledge') {
      const g = ctx.createLinearGradient(0, -w.h / 2, 0, w.h / 2);
      g.addColorStop(0, '#6f8199'); g.addColorStop(1, '#3f4c5e');
      ctx.fillStyle = g;
    } else {
      const g = ctx.createLinearGradient(-w.w / 2, 0, w.w / 2, 0);
      g.addColorStop(0, '#2b3546'); g.addColorStop(0.5, '#3a475c'); g.addColorStop(1, '#232c3b');
      ctx.fillStyle = g;
    }
    roundRect(ctx, -w.w / 2, -w.h / 2, w.w, w.h, Math.min(7, Math.min(w.w, w.h) / 2));
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,16,26,.7)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(190,215,245,.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-w.w / 2 + 6, -w.h / 2 + 2); ctx.lineTo(w.w / 2 - 6, -w.h / 2 + 2); ctx.stroke();
    ctx.restore();
  }
}

function drawGoal(ctx, g, t, cleared) {
  ctx.save();
  ctx.translate(g.x, g.y);
  if (cleared) {
    ctx.save();
    const r = ctx.createRadialGradient(0, 0, 6, 0, 0, 150);
    r.addColorStop(0, 'rgba(255,225,120,.55)'); r.addColorStop(1, 'rgba(255,225,120,0)');
    ctx.fillStyle = r; ctx.fillRect(-150, -150, 300, 300);
    ctx.restore();
  }
  const w = g.w, h = g.h;
  ctx.fillStyle = 'rgba(255,214,102,.10)';
  roundRect(ctx, -w / 2 + 12, -h / 2, w - 24, h, 6); ctx.fill();
  const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  grad.addColorStop(0, '#ffd166'); grad.addColorStop(1, '#e08a26');
  ctx.fillStyle = grad;
  roundRect(ctx, -w / 2, -h / 2, 13, h, 4); ctx.fill();
  roundRect(ctx, w / 2 - 13, -h / 2, 13, h, 4); ctx.fill();
  roundRect(ctx, -w / 2, h / 2 - 14, w, 14, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,180,.55)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(-w / 2 + 13, -h / 2 + i * (h / 4)); ctx.lineTo(w / 2 - 13, -h / 2 + i * (h / 4)); ctx.stroke();
  }
  const wave = Math.sin(t * 3) * 4;
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-w / 2 + 6, -h / 2); ctx.lineTo(-w / 2 + 6, -h / 2 - 46); ctx.stroke();
  ctx.fillStyle = '#ff6b6b';
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 6, -h / 2 - 46);
  ctx.quadraticCurveTo(-w / 2 + 30 + wave, -h / 2 - 38, -w / 2 + 52, -h / 2 - 44);
  ctx.lineTo(-w / 2 + 52, -h / 2 - 24);
  ctx.quadraticCurveTo(-w / 2 + 30 - wave, -h / 2 - 18, -w / 2 + 6, -h / 2 - 26);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawBall(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createRadialGradient(-5, -5, 2, 0, 0, BALL_R + 3);
  g.addColorStop(0, '#fff3b0'); g.addColorStop(0.45, '#ffcc3e'); g.addColorStop(1, '#d97f16');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(120,60,10,.7)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(120,60,10,.45)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-BALL_R + 3, 0); ctx.lineTo(BALL_R - 3, 0); ctx.stroke();
  ctx.restore();
}

function drawInstance(ctx, type, x, y, angle, t, opts = {}) {
  const spec = PARTS[type];
  if (opts.ghost) ctx.globalAlpha = 0.55;
  if (spec.drawBase && opts.base) {
    ctx.save(); ctx.translate(opts.base.x, opts.base.y); ctx.rotate(opts.base.angle);
    spec.drawBase(ctx); ctx.restore();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (opts.selected) {
    ctx.save();
    ctx.strokeStyle = '#7ee0ff'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]);
    roundRect(ctx, -spec.w / 2 - 7, -spec.h / 2 - 7, spec.w + 14, spec.h + 14, 8);
    ctx.stroke();
    ctx.restore();
  }
  spec.draw(ctx, t);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// 選択中のパーツに付く操作ハンドル。指で回す／消すための的。
export function handlesOf(p) {
  const spec = PARTS[p.type];
  const c = Math.cos(p.angle), s = Math.sin(p.angle);
  const up = Math.max(spec.h / 2 + 30, 46);   // パーツの「上」方向
  const side = spec.w / 2 + 26;               // パーツの「右」方向
  return {
    rot: { x: p.x + s * up, y: p.y - c * up, r: 17 },
    del: { x: p.x + c * side, y: p.y + s * side, r: 15 },
  };
}

function drawHandles(ctx, p) {
  const h = handlesOf(p);
  ctx.save();
  ctx.strokeStyle = 'rgba(126,224,255,.45)';
  ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(h.rot.x, h.rot.y); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#7ee0ff';
  ctx.beginPath(); ctx.arc(h.rot.x, h.rot.y, h.rot.r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#0b1220'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(h.rot.x, h.rot.y, 8, -2.4, 1.4); ctx.stroke();
  ctx.fillStyle = '#0b1220';
  ctx.beginPath();
  ctx.moveTo(h.rot.x + 3, h.rot.y - 12); ctx.lineTo(h.rot.x + 11, h.rot.y - 9);
  ctx.lineTo(h.rot.x + 4, h.rot.y - 3); ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#ff7b7b';
  ctx.beginPath(); ctx.arc(h.del.x, h.del.y, h.del.r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2a0d0d'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(h.del.x - 5, h.del.y - 5); ctx.lineTo(h.del.x + 5, h.del.y + 5);
  ctx.moveTo(h.del.x + 5, h.del.y - 5); ctx.lineTo(h.del.x - 5, h.del.y + 5);
  ctx.stroke();
  ctx.restore();
}

export function render(ctx, view) {
  const { game, stage, placed, ghost, selectedUid, running, t, showHandles } = view;
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  drawBackground(ctx, !running, t);
  drawWalls(ctx, stage);
  drawGoal(ctx, stage.goal, t, game.result === 'clear');

  if (running) {
    for (const inst of game.instances) {
      const spec = PARTS[inst.type];
      drawInstance(ctx, inst.type, inst.body.position.x, inst.body.position.y, inst.body.angle, t, {
        base: spec.drawBase ? { x: inst.x, y: inst.y, angle: inst.angle } : null,
      });
    }
    drawBall(ctx, game.ball.position.x, game.ball.position.y, game.ball.angle);
    for (const p of game.sparks) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  } else {
    // スタート位置の目印
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(255,220,120,.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(stage.start.x, stage.start.y, BALL_R + 9, 0, 7); ctx.stroke();
    ctx.restore();
    for (const p of stage.props || []) drawInstance(ctx, p.type, p.x, p.y, p.angle, t, {
      base: PARTS[p.type].drawBase ? { x: p.x, y: p.y, angle: p.angle } : null,
    });
    for (const p of placed) drawInstance(ctx, p.type, p.x, p.y, p.angle, t, {
      selected: p.uid === selectedUid,
      base: PARTS[p.type].drawBase ? { x: p.x, y: p.y, angle: p.angle } : null,
    });
    drawBall(ctx, stage.start.x, stage.start.y, 0);
    const sel = showHandles && placed.find(p => p.uid === selectedUid);
    if (sel) drawHandles(ctx, sel);
    if (ghost) drawInstance(ctx, ghost.type, ghost.x, ghost.y, ghost.angle, t, {
      ghost: true,
      base: PARTS[ghost.type].drawBase ? { x: ghost.x, y: ghost.y, angle: ghost.angle } : null,
    });
  }
}

export function drawIcon(canvas, type) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 56 * dpr; canvas.height = 44 * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, 56, 44);
  ctx.save();
  ctx.translate(28, 22);
  PARTS[type].icon(ctx);
  ctx.restore();
}
