// ステージ台本。固定物（walls）・玉の出発点・カゴ・使えるパーツ数だけを持つ。
// 盤面はスマホ縦持ち前提の縦長（2:3）。横画面では中央にレターボックス表示になる。
export const WORLD_W = 540;
export const WORLD_H = 810;

const FLOOR = { x: 270, y: 800, w: 620, h: 44 };
const SIDES = [
  { x: -14, y: 405, w: 40, h: 900 },
  { x: 554, y: 405, w: 40, h: 900 },
];

export const STAGES = [
  {
    id: 'st1',
    name: '1. 道をつくる',
    hint: 'レールをつないで、かべの向こうのカゴまで玉を運ぼう。',
    start: { x: 70, y: 58 },
    goal: { x: 430, y: 730, w: 104, h: 92 },
    walls: [
      FLOOR, ...SIDES,
      { x: 105, y: 150, w: 150, h: 14, angle: 0.32, style: 'ledge' },
      { x: 250, y: 610, w: 30, h: 340 },
      // カゴの右半分にはフタ。まっすぐ落とすだけでは入らない
      { x: 505, y: 620, w: 130, h: 16 },
    ],
    inventory: { rail: 2, plate: 2 },
  },
  {
    id: 'st2',
    name: '2. ドミノで伝える',
    hint: '玉はミゾに落ちる。ドミノで向こう岸へ「伝えて」、てっきゅうをカゴに落とそう。',
    start: { x: 60, y: 58 },
    goal: { x: 482, y: 730, w: 104, h: 92 },
    walls: [
      FLOOR, ...SIDES,
      { x: 100, y: 200, w: 190, h: 14, angle: 0.4, style: 'ledge' },
      { x: 200, y: 330, w: 280, h: 18, style: 'ledge' },
      { x: 428, y: 330, w: 84, h: 18, style: 'ledge' },
      // てっきゅうの台。棚の端から張り出させて、落ちたら棚に戻らないようにする
      { x: 472, y: 305, w: 24, h: 32 },
      // 溝に落ちた玉は左へ逃がす
      { x: 363, y: 420, w: 80, h: 12, angle: -0.45, style: 'ledge' },
      // てっきゅう用の受け皿（じょうご）
      { x: 400, y: 650, w: 110, h: 12, angle: 0.55, style: 'ledge' },
      { x: 545, y: 640, w: 110, h: 12, angle: -0.55, style: 'ledge' },
    ],
    props: [{ type: 'weight', x: 472, y: 267, angle: 0 }],
    inventory: { domino: 7, plate: 2 },
  },
  {
    id: 'st3',
    name: '3. 風とジャンプ',
    hint: 'かべは高い。ジャンプ台で飛び越えて、届かない分は風で押そう。',
    start: { x: 60, y: 58 },
    goal: { x: 465, y: 730, w: 104, h: 92 },
    walls: [
      FLOOR, ...SIDES,
      { x: 120, y: 200, w: 180, h: 14, angle: 0.35, style: 'ledge' },
      { x: 180, y: 330, w: 190, h: 18, style: 'ledge' },
      { x: 350, y: 490, w: 30, h: 500 },
      // 天井。高く跳ぶだけでは越えられないので、横に押す力が要る
      { x: 430, y: 145, w: 280, h: 20 },
      // 着地を拾う受け皿
      { x: 412, y: 648, w: 100, h: 12, angle: 0.55, style: 'ledge' },
      { x: 527, y: 650, w: 60, h: 12, angle: -0.5, style: 'ledge' },
    ],
    inventory: { jump: 1, fan: 2, plate: 2, rail: 1 },
  },
  {
    id: 'sandbox',
    name: '4. すきに組む',
    hint: '全パーツ使い放題。ピタゴラ装置をどうぞ。',
    start: { x: 60, y: 58 },
    goal: { x: 450, y: 730, w: 104, h: 92 },
    walls: [
      FLOOR, ...SIDES,
      { x: 100, y: 150, w: 150, h: 14, angle: 0.28, style: 'ledge' },
    ],
    inventory: { plate: 20, rail: 20, domino: 20, weight: 10, jump: 10, fan: 10, belt: 10, seesaw: 10 },
  },
];
