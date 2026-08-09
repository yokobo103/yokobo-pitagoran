// ステージ台本。固定物（walls）・玉の出発点・カゴ・使えるパーツ数だけを持つ。
export const WORLD_W = 960;
export const WORLD_H = 620;

const FLOOR = { x: 480, y: 612, w: 1000, h: 44 };
const SIDES = [
  { x: -14, y: 310, w: 40, h: 700 },
  { x: 974, y: 310, w: 40, h: 700 },
];

export const STAGES = [
  {
    id: 'st1',
    name: '1. まずは道をつくる',
    hint: 'レールをつないで、かべの向こうのカゴまで玉を運ぼう。',
    start: { x: 95, y: 58 },
    goal: { x: 840, y: 545, w: 104, h: 92 },
    walls: [
      FLOOR, ...SIDES,
      { x: 150, y: 170, w: 160, h: 14, angle: 0.3, style: 'ledge' },
      { x: 430, y: 492, w: 34, h: 236 },
    ],
    inventory: { rail: 2, plate: 2 },
  },
  {
    id: 'st2',
    name: '2. ドミノで伝える',
    hint: '玉はミゾに落ちる。ドミノで向こう岸へ「伝えて」、てっきゅうをカゴに落とそう。',
    start: { x: 80, y: 58 },
    goal: { x: 658, y: 545, w: 104, h: 92 },
    walls: [
      FLOOR, ...SIDES,
      { x: 180, y: 205, w: 270, h: 14, angle: 0.42, style: 'ledge' },
      { x: 375, y: 322, w: 194, h: 18, style: 'ledge' },
      { x: 585, y: 322, w: 134, h: 18, style: 'ledge' },
      { x: 658, y: 302, w: 26, h: 42 },
      // 溝に落ちた玉は左へ逃がす
      { x: 495, y: 405, w: 90, h: 12, angle: -0.45, style: 'ledge' },
      // てっきゅう用の受け皿（じょうご）
      { x: 585, y: 470, w: 120, h: 12, angle: 0.55, style: 'ledge' },
      { x: 772, y: 455, w: 200, h: 12, angle: -0.5, style: 'ledge' },
    ],
    props: [{ type: 'weight', x: 658, y: 264, angle: 0 }],
    inventory: { domino: 6, plate: 2 },
  },
  {
    id: 'st3',
    name: '3. 風とジャンプ',
    hint: 'かべは高い。ジャンプ台で飛び越えて、届かない分は風で押そう。',
    start: { x: 80, y: 58 },
    goal: { x: 845, y: 545, w: 104, h: 92 },
    walls: [
      FLOOR, ...SIDES,
      { x: 170, y: 235, w: 250, h: 14, angle: 0.35, style: 'ledge' },
      { x: 320, y: 362, w: 230, h: 18, style: 'ledge' },
      { x: 600, y: 400, w: 36, h: 430 },
      // 着地を拾う受け皿
      { x: 745, y: 462, w: 170, h: 12, angle: 0.5, style: 'ledge' },
      { x: 920, y: 470, w: 90, h: 12, angle: -0.5, style: 'ledge' },
    ],
    inventory: { jump: 1, fan: 2, plate: 2, rail: 1 },
  },
  {
    id: 'sandbox',
    name: '4. すきに組む（サンドボックス）',
    hint: '全パーツ使い放題。ピタゴラ装置をどうぞ。',
    start: { x: 80, y: 58 },
    goal: { x: 845, y: 545, w: 104, h: 92 },
    walls: [
      FLOOR, ...SIDES,
      { x: 130, y: 160, w: 170, h: 14, angle: 0.28, style: 'ledge' },
    ],
    inventory: { plate: 20, rail: 20, domino: 20, weight: 10, jump: 10, fan: 10, belt: 10, seesaw: 10 },
  },
];
