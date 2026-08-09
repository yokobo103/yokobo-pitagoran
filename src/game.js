// 物理世界。エディタのデータ（type/x/y/angle の配列）から毎回まっさらに組み直す。
import Matter from 'matter-js';
import { PARTS, buildPart } from './parts.js';
import { WORLD_W, WORLD_H } from './stages.js';

const { Engine, Composite, Bodies, Body, Events, Vector } = Matter;

export const BALL_R = 14;

export class Game {
  constructor() {
    this.engine = Engine.create({ gravity: { x: 0, y: 1 } });
    this.engine.positionIterations = 12;
    this.engine.velocityIterations = 10;
    this.engine.constraintIterations = 4;
    this.world = this.engine.world;
    this.reset(null, []);
  }

  // ---- 組み立て ----
  build(stage, placed) {
    Composite.clear(this.world, false, true);
    Events.off(this.engine);

    this.stage = stage;
    this.instances = [];
    this.fans = [];
    this.belts = [];
    this.jumps = [];
    this.seesaws = [];
    this.sparks = [];
    this.elapsed = 0;
    this.idle = 0;
    this.result = null;
    this.launchCooldown = new Map();
    if (!stage) return;

    const statics = [];
    for (const w of stage.walls) {
      statics.push(Bodies.rectangle(w.x, w.y, w.w, w.h, {
        isStatic: true, angle: w.angle || 0, friction: 0.4, restitution: 0.1, label: 'wall',
      }));
    }

    // カゴは「上からしか入らない」入れ物にする（床を転がって入るのは不可）
    const g = stage.goal;
    const rim = 13;
    statics.push(
      Bodies.rectangle(g.x - g.w / 2 + rim / 2, g.y, rim, g.h, { isStatic: true, label: 'goal-rim', friction: 0.3 }),
      Bodies.rectangle(g.x + g.w / 2 - rim / 2, g.y, rim, g.h, { isStatic: true, label: 'goal-rim', friction: 0.3 }),
      Bodies.rectangle(g.x, g.y + g.h / 2 - 7, g.w, 14, { isStatic: true, label: 'goal-rim', friction: 0.9 }),
    );
    this.goalSensor = Bodies.rectangle(g.x, g.y + 8, g.w - rim * 2 - 4, g.h - 26, {
      isStatic: true, isSensor: true, label: 'goal',
    });
    statics.push(this.goalSensor);
    Composite.add(this.world, statics);

    for (const p of [...(stage.props || []).map(o => ({ ...o, locked: true })), ...placed]) {
      const spec = PARTS[p.type];
      const { body, constraints } = buildPart(p.type, p);
      const inst = { type: p.type, x: p.x, y: p.y, angle: p.angle, body, locked: p.locked };
      Composite.add(this.world, [body, ...constraints]);
      this.instances.push(inst);
      if (spec.kind === 'fan') this.fans.push(inst);
      if (spec.kind === 'belt') this.belts.push(inst);
      if (spec.kind === 'jump') this.jumps.push(inst);
      if (spec.kind === 'seesaw') this.seesaws.push(inst);
    }

    this.ball = Bodies.circle(stage.start.x, stage.start.y, BALL_R, {
      friction: 0.03, frictionAir: 0.004, restitution: 0.34, density: 0.0032, label: 'ball-main',
    });
    Body.setStatic(this.ball, true); // スタートを押すまで空中で待機
    Composite.add(this.world, this.ball);

    Events.on(this.engine, 'collisionStart', (e) => this.onCollisionStart(e));
    Events.on(this.engine, 'collisionActive', (e) => this.onCollisionActive(e));
  }

  reset(stage, placed) { this.running = false; this.build(stage, placed); }

  start() {
    if (!this.stage) return;
    Body.setStatic(this.ball, false);
    this.running = true;
  }

  // ---- 仕掛け ----
  onCollisionStart(e) {
    for (const pair of e.pairs) {
      const { bodyA, bodyB } = pair;
      this.checkGoal(bodyA, bodyB) || this.checkGoal(bodyB, bodyA);
      this.tryLaunch(bodyA, bodyB) || this.tryLaunch(bodyB, bodyA);
      const speed = Vector.magnitude(Vector.sub(bodyA.velocity, bodyB.velocity));
      const contacts = pair.contacts || pair.activeContacts || [];
      const c = contacts[0] && (contacts[0].vertex || contacts[0]);
      if (speed > 5.5 && c) this.spark(c.x, c.y, Math.min(1, speed / 16));
    }
  }

  checkGoal(sensor, other) {
    if (sensor !== this.goalSensor) return false;
    if (!other.label.startsWith('ball')) return false;
    if (this.running && !this.result) this.result = 'clear';
    return true;
  }

  tryLaunch(pad, other) {
    if (pad.label !== 'jump' || other.isStatic || other.isSensor) return false;
    const last = this.launchCooldown.get(other.id) || -1e9;
    if (this.elapsed - last < 260) return true;
    this.launchCooldown.set(other.id, this.elapsed);
    const a = pad.angle;
    const n = { x: Math.sin(a), y: -Math.cos(a) };
    const p = PARTS.jump.power;
    const t = { x: -n.y, y: n.x };
    const along = other.velocity.x * t.x + other.velocity.y * t.y;
    Body.setVelocity(other, { x: n.x * p + t.x * along * 0.6, y: n.y * p + t.y * along * 0.6 });
    this.spark(other.position.x, other.position.y, 1);
    return true;
  }

  onCollisionActive(e) {
    for (const pair of e.pairs) {
      this.tryBelt(pair.bodyA, pair.bodyB) || this.tryBelt(pair.bodyB, pair.bodyA);
    }
  }

  tryBelt(belt, other) {
    if (belt.label !== 'belt' || other.isStatic || other.isSensor) return false;
    const a = belt.angle;
    const ax = Math.cos(a), ay = Math.sin(a);
    const along = other.velocity.x * ax + other.velocity.y * ay;
    const d = (PARTS.belt.speed - along) * 0.22;
    Body.setVelocity(other, { x: other.velocity.x + ax * d, y: other.velocity.y + ay * d });
    return true;
  }

  applyFans() {
    const spec = PARTS.fan;
    for (const f of this.fans) {
      const a = f.body.angle;
      const dx = Math.cos(a), dy = Math.sin(a);
      for (const b of Composite.allBodies(this.world)) {
        if (b.isStatic || b.isSensor) continue;
        const rx = b.position.x - f.body.position.x;
        const ry = b.position.y - f.body.position.y;
        const lx = rx * dx + ry * dy;
        const ly = -rx * dy + ry * dx;
        if (lx < 18 || lx > spec.reach || Math.abs(ly) > 48) continue;
        const fall = 1 - (lx / spec.reach) * 0.55;
        const m = spec.force * b.mass * fall;
        Body.applyForce(b, b.position, { x: dx * m, y: dy * m });
      }
    }
  }

  // シーソーは軸が自由回転なので、傾きすぎたら「ストッパーに当たった」ことにして止める
  limitSeesaws() {
    const LIMIT = 0.5;
    for (const s of this.seesaws) {
      const b = s.body;
      if (Math.abs(b.angle) <= LIMIT) continue;
      Body.setAngle(b, Math.sign(b.angle) * LIMIT);
      Body.setAngularVelocity(b, 0);
    }
  }

  // ドミノは物理エンジンだけだと互いに寄りかかって固まりやすい。
  // 「傾いたら最後まで倒れる」分だけ回転を足して、連鎖が必ず伝わるようにする。
  assistDominoes() {
    const TAU = Math.PI * 2;
    for (const inst of this.instances) {
      if (inst.type !== 'domino') continue;
      const b = inst.body;
      const a = ((b.angle % TAU) + TAU + Math.PI) % TAU - Math.PI;
      const lean = Math.abs(a);
      if (lean > 0.2 && lean < 1.45 && Math.abs(b.angularVelocity) < 0.16) {
        Body.setAngularVelocity(b, b.angularVelocity + Math.sign(a) * 0.013);
      }
    }
  }

  spark(x, y, s) {
    for (let i = 0; i < 3 + s * 4; i++) {
      this.sparks.push({
        x, y, life: 1,
        vx: (Math.random() - 0.5) * 6 * s, vy: (Math.random() - 0.5) * 6 * s - 1,
      });
    }
    if (this.sparks.length > 260) this.sparks.splice(0, this.sparks.length - 260);
  }

  // ---- 毎フレーム ----
  update(dt) {
    for (const p of this.sparks) { p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life -= 0.045; }
    this.sparks = this.sparks.filter(p => p.life > 0);
    if (!this.running || this.result) return;

    this.elapsed += dt;
    this.applyFans();
    this.assistDominoes();
    Engine.update(this.engine, dt / 2);
    this.limitSeesaws();
    Engine.update(this.engine, dt / 2);
    this.limitSeesaws();

    let fastest = 0;
    for (const b of Composite.allBodies(this.world)) {
      if (b.isStatic || b.isSensor) continue;
      fastest = Math.max(fastest, b.speed);
      if (b.position.y > WORLD_H + 250 || b.position.y < -420 || b.position.x < -220 || b.position.x > WORLD_W + 220) {
        if (b === this.ball) { this.result = 'fail'; return; }
        Body.setPosition(b, { x: -600, y: -600 });
        Body.setVelocity(b, { x: 0, y: 0 });
      }
    }
    this.idle = fastest < 0.42 ? this.idle + dt : 0;
    if (this.idle > 3600 || this.elapsed > 45000) this.result = 'fail';
  }
}
