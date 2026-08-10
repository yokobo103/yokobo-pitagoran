// パーツ図鑑。1パーツ = 1つの主ボディ（+おまけの拘束）という約束にして、
// エディタ表示と物理実行の両方をここの draw / create で賄う。
import Matter from 'matter-js';

const { Bodies, Body, Constraint } = Matter;

// ---------- 描画ヘルパ ----------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wood(ctx, w, h) {
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, '#c98b52');
  g.addColorStop(0.5, '#a96c39');
  g.addColorStop(1, '#8a552b');
  ctx.fillStyle = g;
  roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(6, h / 2));
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,32,12,.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,225,190,.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 8, -h / 6);
  ctx.lineTo(w / 2 - 8, -h / 6);
  ctx.stroke();
}

// ---------- パーツ定義 ----------
// w/h（または r）は当たり判定＆エディタの掴み枠にも使う。
export const PARTS = {
  plate: {
    label: 'いた（短）',
    hint: '短い足場。ちょい足しの角度調整に。',
    w: 92, h: 12, tint: '#a96c39',
    create(p) {
      return Bodies.rectangle(p.x, p.y, 92, 12, {
        isStatic: true, angle: p.angle, friction: 0.35, restitution: 0.15, label: 'plate',
      });
    },
    draw(ctx) { wood(ctx, 92, 12); },
    icon(ctx) { ctx.rotate(-0.25); wood(ctx, 40, 7); },
  },

  rail: {
    label: 'レール（長）',
    hint: '長いすべり台。まずはこれで道を作る。',
    w: 190, h: 12, tint: '#a96c39',
    create(p) {
      return Bodies.rectangle(p.x, p.y, 190, 12, {
        isStatic: true, angle: p.angle, friction: 0.25, restitution: 0.15, label: 'rail',
      });
    },
    draw(ctx) {
      wood(ctx, 190, 12);
      ctx.fillStyle = '#6b7a8d';
      for (const s of [-1, 1]) { roundRect(ctx, s * 88 - 5, -8, 10, 16, 3); ctx.fill(); }
    },
    icon(ctx) { ctx.rotate(-0.2); wood(ctx, 52, 7); },
  },

  domino: {
    label: 'ドミノ',
    hint: '倒れて次へ伝える。並べると連鎖する。',
    w: 13, h: 84, dynamic: true, tint: '#e8eef6',
    create(p) {
      return Bodies.rectangle(p.x, p.y, 13, 84, {
        angle: p.angle, friction: 0.28, frictionStatic: 0.4, frictionAir: 0.002,
        density: 0.0009, restitution: 0.02, label: 'domino',
      });
    },
    draw(ctx) {
      const g = ctx.createLinearGradient(-6.5, 0, 6.5, 0);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c3ceda');
      ctx.fillStyle = g;
      roundRect(ctx, -6.5, -42, 13, 84, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(60,80,100,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#7d8ea1';
      ctx.beginPath(); ctx.arc(0, -18, 2.4, 0, 7); ctx.arc(0, 18, 2.4, 0, 7); ctx.fill();
    },
    icon(ctx) {
      ctx.fillStyle = '#f2f6fa';
      roundRect(ctx, -13, -16, 9, 32, 2); ctx.fill();
      ctx.save(); ctx.translate(6, 0); ctx.rotate(0.45);
      roundRect(ctx, -4.5, -16, 9, 32, 2); ctx.fill(); ctx.restore();
    },
  },

  weight: {
    label: 'てっきゅう',
    hint: '重い球。押す・落とす担当。ゴールにも入る。',
    // ドミノに «乗り越えられない» 高さが要るので、玉より一回り大きい
    r: 22, w: 44, h: 44, dynamic: true, tint: '#8894a6',
    create(p) {
      return Bodies.circle(p.x, p.y, 22, {
        friction: 0.07, frictionAir: 0.003, density: 0.0014, restitution: 0.12, label: 'ball-weight',
      });
    },
    draw(ctx) {
      const g = ctx.createRadialGradient(-8, -8, 2, 0, 0, 24);
      g.addColorStop(0, '#cfd8e3'); g.addColorStop(0.5, '#7d8a9c'); g.addColorStop(1, '#415061');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(30,40,55,.6)'; ctx.lineWidth = 2; ctx.stroke();
    },
    icon(ctx) { ctx.scale(0.8, 0.8); PARTS.weight.draw(ctx); },
  },

  jump: {
    label: 'ジャンプ台',
    hint: '触れたものを板の向きへ打ち上げる。',
    w: 78, h: 26, kind: 'jump', power: 10.5, tint: '#f0a03c',
    create(p) {
      return Bodies.rectangle(p.x, p.y, 78, 14, {
        isStatic: true, angle: p.angle, friction: 0.2, label: 'jump',
      });
    },
    draw(ctx) {
      ctx.fillStyle = '#5c6675';
      roundRect(ctx, -39, 4, 78, 9, 3); ctx.fill();
      ctx.strokeStyle = '#c9d3e0'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) ctx.lineTo(-27 + i * 9, i % 2 ? 2 : -4);
      ctx.stroke();
      const g = ctx.createLinearGradient(0, -12, 0, -2);
      g.addColorStop(0, '#ffc165'); g.addColorStop(1, '#e2861f');
      ctx.fillStyle = g;
      roundRect(ctx, -39, -13, 78, 11, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(-7, -14); ctx.lineTo(7, -14); ctx.closePath(); ctx.fill();
    },
    icon(ctx) { ctx.scale(0.62, 0.62); PARTS.jump.draw(ctx); },
  },

  fan: {
    label: 'せんぷうき',
    hint: '前方にずっと風を送る。軽いものがよく飛ぶ。',
    w: 52, h: 52, kind: 'fan', reach: 230, force: 0.0012, tint: '#5ec8e5',
    create(p) {
      return Bodies.rectangle(p.x, p.y, 46, 46, {
        isStatic: true, angle: p.angle, friction: 0.4, label: 'fan',
      });
    },
    draw(ctx, t = 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#7fdcf5'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const d = 44 + i * 46 + ((t * 90 + i * 20) % 46);
        ctx.globalAlpha = 0.45 * (1 - i / 3.2);
        ctx.beginPath(); ctx.arc(0, 0, d, -0.5, 0.5); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = '#33465c';
      roundRect(ctx, -23, -23, 46, 46, 8); ctx.fill();
      ctx.strokeStyle = '#8fa3ba'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save();
      ctx.rotate(t * 9);
      ctx.fillStyle = '#9fe6fb';
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath(); ctx.ellipse(0, -9, 5, 9, 0, 0, 7); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = '#e6f6ff';
      ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 7); ctx.fill();
    },
    icon(ctx) { ctx.scale(0.62, 0.62); PARTS.fan.draw(ctx, 0.3); },
  },

  belt: {
    label: 'ベルコン',
    hint: '乗ったものを矢印の向きへ運ぶ。',
    w: 132, h: 20, kind: 'belt', speed: 5.4, tint: '#7bd88f',
    create(p) {
      return Bodies.rectangle(p.x, p.y, 132, 16, {
        isStatic: true, angle: p.angle, friction: 0.9, frictionStatic: 1.2, label: 'belt',
      });
    },
    draw(ctx, t = 0) {
      ctx.fillStyle = '#2f3d4e';
      roundRect(ctx, -66, -8, 132, 16, 8); ctx.fill();
      ctx.fillStyle = '#96a7bb';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 58, 0, 6, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#7bd88f';
      for (let i = 0; i < 6; i++) {
        const x = -56 + ((i * 20 + t * 130) % 116);
        ctx.beginPath(); ctx.moveTo(x - 4, -5); ctx.lineTo(x + 4, 0); ctx.lineTo(x - 4, 5); ctx.closePath(); ctx.fill();
      }
    },
    icon(ctx) { ctx.scale(0.55, 0.55); PARTS.belt.draw(ctx, 0.2); },
  },

  seesaw: {
    label: 'シーソー',
    hint: '真ん中の軸で傾く板。重さで道が変わる。',
    w: 154, h: 14, kind: 'seesaw', dynamic: true, tint: '#e0729a',
    create(p) {
      const plank = Bodies.rectangle(p.x, p.y, 154, 14, {
        angle: p.angle, friction: 0.4, frictionAir: 0.02, density: 0.0016,
        restitution: 0.1, label: 'seesaw',
      });
      const pivot = Constraint.create({
        pointA: { x: p.x, y: p.y }, bodyB: plank, pointB: { x: 0, y: 0 },
        length: 0, stiffness: 1, damping: 0.1, render: { visible: false },
      });
      return { body: plank, constraints: [pivot] };
    },
    draw(ctx) {
      const g = ctx.createLinearGradient(0, -7, 0, 7);
      g.addColorStop(0, '#f58fb0'); g.addColorStop(1, '#c9527a');
      ctx.fillStyle = g;
      roundRect(ctx, -77, -7, 154, 14, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(90,20,45,.5)'; ctx.lineWidth = 2; ctx.stroke();
    },
    drawBase(ctx) {
      ctx.fillStyle = '#4a5769';
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-16, 30); ctx.lineTo(16, 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#28313d';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
    },
    icon(ctx) {
      ctx.scale(0.55, 0.55); ctx.translate(0, -6);
      PARTS.seesaw.drawBase(ctx); ctx.rotate(-0.22); PARTS.seesaw.draw(ctx);
    },
  },
};

export function partSize(type) {
  const s = PARTS[type];
  return { w: s.w, h: s.h };
}

// 主ボディと拘束をまとめて返す（create が生ボディを返す場合も吸収）
export function buildPart(type, p) {
  const made = PARTS[type].create(p);
  if (made.body) return { body: made.body, constraints: made.constraints || [] };
  return { body: made, constraints: [] };
}

export { Body };
