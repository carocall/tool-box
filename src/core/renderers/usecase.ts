/**
 * 用例图：每次只画一个角色。
 *
 * 两种形态（数据里有没有 `includes` 决定）：
 * - **单列**：角色 → 一列用例（老形态，输出必须与冻结基线保持逐字符一致）；
 * - **两级**：角色 → 一列一级用例 → 右列二级功能，二级功能用带 `<<include>>` 的虚线连过来。
 */
import { tw, uid } from '../base';
import { paintSvg } from '../paint-svg';
import type { UsecaseData, Diagram } from '../types';
import type { SceneItem, ScenePage } from '../scene';

interface UcRow { name: string; includes: string[] }
interface Lane { top: number; h: number; cy: number; childH: number }

const FS = 16;          // 用例椭圆字号
const FS_INC = 13;      // <<include>> 标签字号
const INCLUDE_TEXT = '<<include>>';

/** 兼容 `"用例名"` 与 `{ name, includes }` 两种写法 */
export function normUsecases(json: UsecaseData): UcRow[] {
  return (json.usecases || []).filter(Boolean).map((u: any) => ({
    name: typeof u === 'string' ? u : String(u.name ?? ''),
    includes: (u && typeof u === 'object' && Array.isArray(u.includes))
      ? u.includes.map((x: any) => String(x)).filter(Boolean)
      : []
  })).filter(u => u.name);
}

export function layoutUsecase(json: UsecaseData): ScenePage[] {
  const actor = json.actor || '用户';
  const list = normUsecases(json);
  if (!list.length) throw new Error('用例图至少需要一个用例（usecases）');
  const name = (json.title || '') || (actor + '用例图');
  const scene = list.some(u => u.includes.length) ? twoLevel(list, actor) : flat(list, actor);
  return [{ name, scene }];
}

/* ------------------------------------------------------------------ *
 * 单列（老形态）—— 数值一个都不要动，与 baseline 逐字符对比靠它
 * ------------------------------------------------------------------ */
function flat(list: UcRow[], actor: string) {
  const ucs = list.map(u => u.name);
  const widths = ucs.map(t => Math.max(120, Math.round(tw(t, FS) + 42)));
  const hBox = 80, gap = 26;
  const colH = ucs.length * hBox + (ucs.length - 1) * gap;
  const actorCx = 78, ucLeft = 252;
  const maxW = Math.max.apply(null, widths);
  const H = colH + 120;
  const W = ucLeft + maxW + 60;

  const actorCy = 60 + colH / 2;
  const ucX = ucs.map((t, i) => ({ cx: ucLeft + widths[i] / 2, cy: 60 + i * (hBox + gap) + hBox / 2, w: widths[i], h: hBox, t: t }));

  const items: SceneItem[] = [];
  // 角色固定在左上角，连线从火柴人右侧出发
  ucX.forEach((u, i) => {
    items.push({
      k: 'line', x1: actorCx + 15, y1: actorCy, x2: u.cx - u.w / 2, y2: u.cy, sw: 1,
      link: ['ACTOR', 'U' + i],
      // 所有连线都从火柴人右侧中点出发（与预览里完全一致，且拖动时不会跳端口）
      ports: { exit: [1, 0.5], entry: [0, 0.5] }
    });
  });
  ucX.forEach((u, i) => {
    items.push({ k: 'ellipse', cx: u.cx, cy: u.cy, rx: u.w / 2, ry: u.h / 2, fill: '#FFFFFF', stroke: '#000000', sw: 1, text: u.t, fs: FS, id: 'U' + i });
  });
  items.push({
    k: 'actor', cx: actorCx, top: actorCy - 62, scale: 1.05, id: 'ACTOR',
    label: actor, labelFs: 17, labelY: actorCy + 16, labelWeight: '600'
  });
  return { w: W, h: H, items };
}

/* ------------------------------------------------------------------ *
 * 两级：一列一级用例 + 右列二级功能（虚线 <<include>>）
 * ------------------------------------------------------------------ */
function twoLevel(list: UcRow[], actor: string) {
  const h1 = 80, h2 = 56;         // 一级 / 二级椭圆高度
  const gap2 = 18;                // 同一组内二级功能间距
  const gapGroup = 46;            // 组与组之间
  const M = 60;                   // 上下留白
  const actorCx = 78;
  const l1Left = 252;             // 一级用例左边界
  const gapCol = 96;              // 一级与二级之间（放 <<include>> 标签）
  const LABEL_T = 0.55;           // 标签落在线上的比例：太靠起点会挤成一团

  const w1 = list.map(u => Math.max(120, Math.round(tw(u.name, FS) + 42)));
  const all2 = list.flatMap(u => u.includes);
  const W1 = Math.max.apply(null, w1);
  const w2Of = (t: string) => Math.max(130, Math.round(tw(t, FS) + 48));
  const W2 = all2.length ? Math.max.apply(null, all2.map(w2Of)) : 0;

  const l2Left = l1Left + W1 + gapCol;
  const W = l2Left + W2 + M;

  // 每组占一条"泳道"，高度取「一级椭圆」与「二级功能总高」的较大者
  let y = M;
  const lanes: Lane[] = list.map(u => {
    const n = u.includes.length;
    const childH = n ? n * h2 + (n - 1) * gap2 : 0;
    const h = Math.max(h1, childH);
    const lane = { top: y, h, cy: y + h / 2, childH };
    y += h + gapGroup;
    return lane;
  });
  const contentBottom = y - gapGroup;
  const H = contentBottom + M;
  const actorCy = (M + contentBottom) / 2;

  const items: SceneItem[] = [];

  // 角色 → 一级用例（从火柴人右侧中点出发）
  list.forEach((u, i) => {
    items.push({
      k: 'line', x1: actorCx + 15, y1: actorCy, x2: l1Left, y2: lanes[i].cy, sw: 1,
      link: ['ACTOR', 'U' + i],
      ports: { exit: [1, 0.5], entry: [0, 0.5] }
    });
  });

  // 一级 → 二级：虚线 + 空心箭头 + <<include>>
  list.forEach((u, i) => {
    const startX = l1Left + w1[i];       // 一级椭圆的右顶点
    const startY = lanes[i].cy;
    const base = lanes[i].top + (lanes[i].h - lanes[i].childH) / 2;
    u.includes.forEach((t, k) => {
      const cy = base + k * (h2 + gap2) + h2 / 2;
      const endX = l2Left;               // 二级椭圆的左顶点
      const id = 'INC' + i + '_' + k;
      items.push({
        k: 'path', pts: [[startX, startY], [endX, cy]], sw: 1, dash: '5 4', arrow: 'open', id,
        link: ['U' + i, 'C' + i + '_' + k],
        ports: { exit: [1, 0.5], entry: [0, 0.5] }
      });
      // 标签放在线的中后段（扇形展开后彼此有足够间距），并抬到线的上方
      const lx = startX + (endX - startX) * LABEL_T;
      const ly = startY + (cy - startY) * LABEL_T - 9;
      items.push({ k: 'label', x: lx, y: ly, text: INCLUDE_TEXT, fs: FS_INC, owner: id, ownerX: 2 * LABEL_T - 1, ownerY: 9 });
    });
  });

  // 图形
  list.forEach((u, i) => {
    items.push({ k: 'ellipse', cx: l1Left + w1[i] / 2, cy: lanes[i].cy, rx: w1[i] / 2, ry: h1 / 2, fill: '#FFFFFF', stroke: '#000000', sw: 1, text: u.name, fs: FS, id: 'U' + i });
    const base = lanes[i].top + (lanes[i].h - lanes[i].childH) / 2;
    u.includes.forEach((t, k) => {
      const w = w2Of(t);
      const cy = base + k * (h2 + gap2) + h2 / 2;
      items.push({ k: 'ellipse', cx: l2Left + w / 2, cy, rx: w / 2, ry: h2 / 2, fill: '#FFFFFF', stroke: '#000000', sw: 1, text: t, fs: FS, id: 'C' + i + '_' + k });
    });
  });

  items.push({
    k: 'actor', cx: actorCx, top: actorCy - 62, scale: 1.05, id: 'ACTOR',
    label: actor, labelFs: 17, labelY: actorCy + 16, labelWeight: '600'
  });

  return { w: W, h: H, items };
}

export function renderUsecase(json: UsecaseData): Diagram[] {
  return layoutUsecase(json).map(p => ({
    name: p.name, svg: paintSvg(uid('uc'), p.scene), w: p.scene.w, h: p.scene.h
  }));
}
