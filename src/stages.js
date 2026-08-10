// ステージ台本。固定物（walls）・玉の出発点・カゴ・使えるパーツ数だけを持つ。
// 盤面はスマホ縦持ち前提の縦長（2:3）。横画面では中央にレターボックス表示になる。
export const WORLD_W = 540;
export const WORLD_H = 810;

const FLOOR = { x: 270, y: 800, w: 620, h: 44 };
const SIDES = [
  { x: -14, y: 405, w: 40, h: 900 },
  { x: 554, y: 405, w: 40, h: 900 },
];

// カゴの上に置く «じょうご»。多少ズレても拾ってくれる形を作る
const funnel = (gx, gy) => ([
  { x: gx - 78, y: gy - 70, w: 110, h: 12, angle: 0.55, style: 'ledge' },
  { x: gx + 78, y: gy - 70, w: 110, h: 12, angle: -0.55, style: 'ledge' },
]);

export const STAGES = [
  {
    id: 'st1',
    name: '1 道をつくる',
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
    name: '2 ドミノ',
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
      { x: 400, y: 650, w: 110, h: 12, angle: 0.55, style: 'ledge' },
      { x: 545, y: 640, w: 110, h: 12, angle: -0.55, style: 'ledge' },
    ],
    props: [{ type: 'weight', x: 472, y: 267, angle: 0 }],
    inventory: { domino: 7, plate: 2 },
  },
  {
    id: 'st3',
    name: '3 風とジャンプ',
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
      { x: 412, y: 648, w: 100, h: 12, angle: 0.55, style: 'ledge' },
      { x: 527, y: 650, w: 60, h: 12, angle: -0.5, style: 'ledge' },
    ],
    inventory: { jump: 1, fan: 2, plate: 2, rail: 1 },
  },
  {
    id: 'st4',
    name: '4 トランポリン',
    hint: 'カゴが高い所にある。坂では上れない。トランポリンで «跳ね上げて» 届かせよう。',
    start: { x: 70, y: 58 },
    goal: { x: 430, y: 250, w: 104, h: 92 },
    walls: [
      FLOOR, ...SIDES,
      { x: 105, y: 150, w: 150, h: 14, angle: 0.32, style: 'ledge' },
      { x: 430, y: 320, w: 190, h: 24 },
      ...funnel(430, 250),
    ],
    inventory: { tramp: 1, plate: 2, rail: 1 },
  },
  {
    id: 'st5',
    name: '5 ベルコン',
    hint: 'カゴは玉より高い所にある。ベルコンで «坂を上げて» 運ぼう。',
    start: { x: 70, y: 58 },
    goal: { x: 430, y: 415, w: 104, h: 92 },
    walls: [
      FLOOR, ...SIDES,
      { x: 105, y: 150, w: 150, h: 14, angle: 0.32, style: 'ledge' },
      { x: 430, y: 470, w: 210, h: 18, style: 'ledge' },
      { x: 200, y: 700, w: 24, h: 160 },
    ],
    inventory: { belt: 3, plate: 2, rail: 1 },
  },
  {
    id: 'st6',
    name: '6 シーソー',
    hint: 'いたでは短くて谷を渡れない。シーソーを橋にして、玉の重みで傾かせよう。',
    start: { x: 70, y: 58 },
    goal: { x: 460, y: 730, w: 104, h: 92 },
    walls: [
      FLOOR, ...SIDES,
      { x: 105, y: 150, w: 150, h: 14, angle: 0.32, style: 'ledge' },
      { x: 130, y: 400, w: 220, h: 18, style: 'ledge' },
      { x: 430, y: 449, w: 100, h: 18, style: 'ledge' },
      // 谷に落ちたら左へ流されて終わり
      { x: 310, y: 540, w: 150, h: 12, angle: -0.5, style: 'ledge' },
      ...funnel(460, 730),
    ],
    inventory: { seesaw: 2, plate: 1 },
  },
  {
    id: 'st7',
    name: '7 ワープ',
    hint: '壁は端から端まで塞がっている。青い渦に入れれば、桃色の渦から出てくる。',
    start: { x: 70, y: 58 },
    goal: { x: 430, y: 730, w: 104, h: 92 },
    warps: [{ ax: 150, ay: 520, bx: 430, by: 250, r: 30 }],
    walls: [
      FLOOR, ...SIDES,
      { x: 105, y: 150, w: 150, h: 14, angle: 0.32, style: 'ledge' },
      // 上下すべて塞がっている。渦以外に向こう側へ行く手段はない
      { x: 300, y: 390, w: 30, h: 820 },
      ...funnel(430, 730),
    ],
    inventory: { rail: 2, plate: 2 },
  },
  {
    id: 'st8',
    name: '8 スイッチ',
    hint: 'とびらはスイッチを踏むまで閉じている。先にスイッチを通る道を作ろう。',
    start: { x: 70, y: 58 },
    goal: { x: 430, y: 730, w: 104, h: 92 },
    // スイッチは «勝手に通り道になる場所» から外す。運ぶ道を作るのが課題
    switches: [{ x: 355, y: 315, w: 90, h: 14, opens: 'd1' }],
    // 右の壁まで届くとびら。横をすり抜けられないようにする
    doors: [{ id: 'd1', x: 428, y: 560, w: 216, h: 22 }],
    walls: [
      FLOOR, ...SIDES,
      { x: 105, y: 150, w: 150, h: 14, angle: 0.32, style: 'ledge' },
      { x: 355, y: 330, w: 150, h: 18, style: 'ledge' },
      { x: 310, y: 660, w: 26, h: 250 },
      ...funnel(430, 730),
    ],
    inventory: { rail: 2, plate: 2 },
  },
  {
    id: 'st9',
    name: '9 ふりこ',
    hint: 'ふりこは «軸» を置く。ぶら下がった錘に当てて、右へ弾きとばそう。',
    start: { x: 70, y: 58 },
    goal: { x: 440, y: 730, w: 104, h: 92 },
    walls: [
      FLOOR, ...SIDES,
      { x: 105, y: 150, w: 150, h: 14, angle: 0.32, style: 'ledge' },
      { x: 310, y: 570, w: 30, h: 440 },
      ...funnel(440, 730),
    ],
    inventory: { pendulum: 1, plate: 2, rail: 1 },
  },
  {
    id: 'st10',
    name: '10 総合',
    hint: '仕上げ。使えるものは全部使っていい。',
    start: { x: 60, y: 58 },
    goal: { x: 450, y: 730, w: 104, h: 92 },
    warps: [{ ax: 120, ay: 470, bx: 420, by: 210, r: 30 }],
    switches: [{ x: 455, y: 320, w: 80, h: 14, opens: 'd1' }],
    doors: [{ id: 'd1', x: 420, y: 590, w: 250, h: 22 }],
    walls: [
      FLOOR, ...SIDES,
      { x: 95, y: 170, w: 160, h: 14, angle: 0.34, style: 'ledge' },
      // 天井から床まで。渦を通る以外に右へ行く道はない
      { x: 290, y: 390, w: 26, h: 800 },
      { x: 470, y: 335, w: 140, h: 18, style: 'ledge' },
      ...funnel(450, 730),
    ],
    inventory: { rail: 2, plate: 3, tramp: 1, belt: 1, jump: 1, fan: 1 },
  },
  {
    id: 'sandbox',
    name: 'すきに組む',
    hint: '全パーツ使い放題。ピタゴラ装置をどうぞ。',
    start: { x: 60, y: 58 },
    goal: { x: 450, y: 730, w: 104, h: 92 },
    walls: [
      FLOOR, ...SIDES,
      { x: 100, y: 150, w: 150, h: 14, angle: 0.28, style: 'ledge' },
    ],
    inventory: {
      plate: 20, rail: 20, domino: 20, weight: 10, jump: 10,
      fan: 10, belt: 10, seesaw: 10, tramp: 10, pendulum: 10,
    },
  },
];
