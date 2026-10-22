/**
 * 泳道图（跨职能流程图）：列 = 角色，行 = 阶段。
 *
 * 和流程图一样**不做自动布局** —— 节点只要说清「第几列第几行」，位置由网格算。
 * 区别是多了一层「格子」的语义：
 *   - 列宽按该列最宽的文字撑开，行高按该行叠了几层节点撑开（判断框更高）；
 *   - 一个格子里可以放多个节点，按数组顺序自上而下叠；
 *   - 连线走**正交折线 + 拐点**，拐点统一落在目标行上方的缝里，横向那一段不会穿过别的格子。
 *
 * 样式固定为黑白线框（和其余图一致），格子本身画成 drawio 的容器，
 * 导出后拖动节点会被限制在自己的格子里。
 */
import { tw, uid } from '../base';
import { paintSvg } from '../paint-svg';
import type { SwimData, Diagram } from '../types';
import type { SceneItem, ScenePage } from '../scene';

const FS = 13;              // 节点字号
const LFS = 12;             // 连线标注字号
const M = 40;               // 页边距
const TITLE_H = 34;         // 顶部标题条
const HEAD_H = 34;          // 列头高度
const STAGE_W = 40;         // 左侧行头宽度
const PAD_X = 26;           // 格子左右内边距
const PAD_Y = 22;           // 格子上下内边距
const GAP_Y = 14;           // 同格子内两个节点的间距
const MIN_COL = 176;
const MIN_ROW = 92;
const GUTTER = 14;          // 折线横向段离目标行边线的距离（落在行的留白里）

interface SwimNodeNorm {
  id: string; text: string; kind: string;
  lane: number; stage: number;      // 0 基
}
interface Placed extends SwimNodeNorm {
  cx: number; cy: number; w: number; h: number;
}

/** 节点尺寸：宽度跟文字走，判断框要更高更宽（文字被菱形斜边挤） */
function sizeOf(text: string, kind: string): { w: number; h: number } {
  const t = tw(text, FS);
  if (kind === 'decision') return { w: Math.max(124, Math.round(t * 1.7 + 36)), h: 64 };
  if (kind === 'start' || kind === 'end') return { w: Math.max(96, Math.round(t + 44)), h: 38 };
  if (kind === 'io') return { w: Math.max(110, Math.round(t + 62)), h: 46 };
  return { w: Math.max(96, Math.round(t + 44)), h: 46 };
}

/** 宽松归一化：数字兜底、lane/stage 从 1 开始 */
export function normSwim(json: SwimData) {
  const lanes = (Array.isArray((json as any)?.lanes) ? (json as any).lanes : []).map((x: any) =>
    typeof x === 'string' ? x : String(x?.name ?? x?.text ?? ''));
  const stages = (Array.isArray((json as any)?.stages) ? (json as any).stages : []).map((x: any) =>
    typeof x === 'string' ? x : String(x?.name ?? x?.text ?? ''));
  const rawNodes = Array.isArray((json as any)?.nodes) ? (json as any).nodes : [];
  const nodes: SwimNodeNorm[] = rawNodes
    .filter((n: any) => n && typeof n === 'object')
    .map((n: any, i: number) => ({
      id: String(n.id ?? `n${i + 1}`),
      text: String(n.text ?? n.name ?? ''),
      kind: String(n.kind ?? n.shape ?? 'process').toLowerCase(),
      lane: Math.max(0, Math.round(Number(n.lane) || 1) - 1),
      stage: Math.max(0, Math.round(Number(n.stage) || 1) - 1)
    }));
  const rawEdges = Array.isArray((json as any)?.edges) ? (json as any).edges : [];
  const edges = rawEdges
    .filter((e: any) => e && typeof e === 'object')
    .map((e: any) => ({
      from: String(e.from ?? ''), to: String(e.to ?? ''),
      label: e.label == null ? '' : String(e.label),
      dash: !!e.dash
    }));
  return { lanes, stages, nodes, edges, title: String((json as any)?.title ?? '') };
}

export function layoutSwim(json: SwimData): ScenePage[] {
  const { lanes, stages, nodes, edges, title } = normSwim(json);
  if (!lanes.length) throw new Error('泳道图至少需要一条泳道（lanes）');
  if (!stages.length) throw new Error('泳道图至少需要一个阶段（stages）');
  if (!nodes.length) throw new Error('泳道图至少需要一个节点（nodes）');

  // 越界的 lane / stage 夹回范围内（宽松处理，不报错）
  nodes.forEach(n => {
    n.lane = Math.min(n.lane, lanes.length - 1);
    n.stage = Math.min(n.stage, stages.length - 1);
  });

  // 1) 列宽 / 行高
  const colW = lanes.map((_, i) => {
    const items = nodes.filter(n => n.lane === i).map(n => sizeOf(n.text, n.kind));
    return items.length ? Math.max(MIN_COL, Math.max(...items.map(s => s.w)) + PAD_X * 2) : MIN_COL;
  });
  const rowH = stages.map((_, j) => {
    let tallest = 0;
    for (let i = 0; i < lanes.length; i++) {
      const cell = nodes.filter(n => n.lane === i && n.stage === j);
      if (!cell.length) continue;
      const sum = cell.reduce((s, n) => s + sizeOf(n.text, n.kind).h, 0) + GAP_Y * (cell.length - 1);
      tallest = Math.max(tallest, sum);
    }
    return Math.max(MIN_ROW, Math.round(tallest + PAD_Y * 2));
  });

  // 2) 网格坐标
  const gridX = M + STAGE_W;
  const colX: number[] = [];
  let cursorX = gridX;
  colW.forEach(w => { colX.push(cursorX); cursorX += w; });
  const gridW = cursorX - gridX;

  const gridY = M + TITLE_H + HEAD_H;
  const rowY: number[] = [];
  let cursorY = gridY;
  rowH.forEach(h => { rowY.push(cursorY); cursorY += h; });
  const gridH = cursorY - gridY;

  const W = gridX + gridW + M;
  const H = gridY + gridH + M;

  // 3) 节点落点：格子里居中，多个节点自上而下叠
  const placed: Placed[] = [];
  for (let i = 0; i < lanes.length; i++) {
    for (let j = 0; j < stages.length; j++) {
      const cell = nodes.filter(n => n.lane === i && n.stage === j);
      if (!cell.length) continue;
      const sizes = cell.map(n => sizeOf(n.text, n.kind));
      const total = sizes.reduce((s, x) => s + x.h, 0) + GAP_Y * (cell.length - 1);
      let y = rowY[j] + (rowH[j] - total) / 2;
      cell.forEach((n, k) => {
        const s = sizes[k];
        placed.push({
          ...n, w: s.w, h: s.h,
          cx: colX[i] + colW[i] / 2,
          cy: y + s.h / 2
        });
        y += s.h + GAP_Y;
      });
    }
  }

  const items: SceneItem[] = [];
  const labels: SceneItem[] = [];

  // 4) 表头 + 格子（格子同时是 drawio 里的容器）
  items.push({
    k: 'rect', x: M, y: M, w: STAGE_W + gridW, h: TITLE_H,
    fill: '#FFFFFF', stroke: '#000000', sw: 1,
    text: title || '泳道图', fs: 15
  });
  // 左上角那一格（标题条下方、行头上方、列头左侧）也要补上，否则表格缺个口子
  items.push({
    k: 'rect', x: M, y: M + TITLE_H, w: STAGE_W, h: HEAD_H,
    fill: '#FFFFFF', stroke: '#000000', sw: 1
  });
  lanes.forEach((name, i) => {
    items.push({
      k: 'rect', x: colX[i], y: M + TITLE_H, w: colW[i], h: HEAD_H,
      fill: '#FFFFFF', stroke: '#000000', sw: 1, text: name, fs: 14
    });
  });
  stages.forEach((name, j) => {
    items.push({
      k: 'rect', x: M, y: rowY[j], w: STAGE_W, h: rowH[j],
      fill: '#FFFFFF', stroke: '#000000', sw: 1, vtext: name, fs: 13
    });
  });
  for (let i = 0; i < lanes.length; i++) {
    for (let j = 0; j < stages.length; j++) {
      items.push({
        k: 'rect', x: colX[i], y: rowY[j], w: colW[i], h: rowH[j],
        fill: '#FFFFFF', stroke: '#000000', sw: 1, id: cellId(i, j)
      });
    }
  }

  // 5) 连线：正交折线，横向段落在目标行的留白里
  const byId = new Map(placed.map(p => [p.id, p]));
  // 「正上方直落下来」的箭头已经占住了目标节点的顶部端口，
  // 别的线再往顶部拐就会和它叠成一条 —— 这类改从侧面进。
  const topTaken = new Set<string>();
  edges.forEach(e => {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (a && b && Math.abs(a.cx - b.cx) < 1 && b.stage > a.stage) topTaken.add(b.id);
  });
  edges.forEach((e, idx) => {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) return;
    const pts = orthRoute(a, b, rowY, rowH, topTaken.has(b.id));
    const id = 'E' + idx;
    items.push({
      k: 'path', pts, sw: 1, arrow: 'solid',
      dash: e.dash ? '6 4' : undefined,
      link: [a.id, b.id], id,
      ports: portsOf(pts),
      route: pts.length > 2 ? 'ortho' : undefined
    });
    if (e.label) labels.push(labelAt(id, pts, e.label));
  });

  // 6) 节点（白底，会盖住先画的线）；挂在所在格子的容器下，导进 drawio 拖动不会串道
  placed.forEach(p => {
    const x = p.cx - p.w / 2, y = p.cy - p.h / 2;
    const base = {
      fill: '#FFFFFF', stroke: '#000000', sw: 1,
      text: p.text, fs: FS, id: p.id, parent: cellId(p.lane, p.stage)
    };
    if (p.kind === 'decision') items.push({ k: 'diamond', cx: p.cx, cy: p.cy, w: p.w, h: p.h, ...base });
    else if (p.kind === 'io') {
      const s = 12;
      items.push({
        k: 'polygon', shape: 'parallelogram',
        pts: [[x + s, y], [x + p.w, y], [x + p.w - s, y + p.h], [x, y + p.h]],
        ...base
      });
    } else {
      items.push({ k: 'rect', x, y, w: p.w, h: p.h, rx: (p.kind === 'start' || p.kind === 'end') ? p.h / 2 : 0, ...base });
    }
  });

  return [{
    name: title || '泳道图',
    scene: { w: Math.round(W), h: Math.round(H), items: items.concat(labels) }
  }];
}

const cellId = (i: number, j: number) => `cell_${i}_${j}`;

/**
 * 正交连线：
 * - 同列 → 竖直
 * - 同一行 → 水平（两端高度不同时中间加一段折）
 * - 跨行列 → 从源的下边（或上边）出发，在目标行上方的缝里横移，再进目标的上边
 */
function orthRoute(a: Placed, b: Placed, rowY: number[], rowH: number[], sideEntry: boolean): number[][] {
  const aTop = a.cy - a.h / 2, aBot = a.cy + a.h / 2;
  const bTop = b.cy - b.h / 2, bBot = b.cy + b.h / 2;

  // 同一列：竖直
  if (Math.abs(a.cx - b.cx) < 1) {
    return b.cy >= a.cy ? [[a.cx, aBot], [b.cx, bTop]] : [[a.cx, aTop], [b.cx, bBot]];
  }
  // 同一行：水平
  if (a.stage === b.stage) {
    if (Math.abs(a.cy - b.cy) < 1) {
      return b.cx >= a.cx
        ? [[a.cx + a.w / 2, a.cy], [b.cx - b.w / 2, b.cy]]
        : [[a.cx - a.w / 2, a.cy], [b.cx + b.w / 2, b.cy]];
    }
    const midX = (a.cx + b.cx) / 2;
    return [
      [b.cx >= a.cx ? a.cx + a.w / 2 : a.cx - a.w / 2, a.cy],
      [midX, a.cy], [midX, b.cy],
      [b.cx >= a.cx ? b.cx - b.w / 2 : b.cx + b.w / 2, b.cy]
    ];
  }
  const down = b.stage > a.stage;

  // 目标顶部已被竖直箭头占用：竖直走到目标高度，再横着插进侧边。
  // 侧边入口抬到 1/4 高度 —— 不然会和「从侧边出去的线」落在同一水平线上叠成一条。
  if (sideEntry) {
    const yIn = b.cy - b.h * 0.25;
    return [
      [a.cx, down ? aBot : aTop],
      [a.cx, yIn],
      [b.cx >= a.cx ? b.cx - b.w / 2 : b.cx + b.w / 2, yIn]
    ];
  }

  // 跨行：横向段落在**目标行的留白里**（往下走时在目标行顶部、回退时在目标行底部），
  // 不能贴着行分隔线走 —— 那样线和分隔线会重叠成一条粗线。
  const gapY = down
    ? rowY[b.stage] + GUTTER
    : rowY[b.stage] + rowH[b.stage] - GUTTER;
  return [
    [a.cx, down ? aBot : aTop],
    [a.cx, gapY],
    [b.cx, gapY],
    [b.cx, down ? bTop : bBot]
  ];
}

/** 由折线首尾两段推断 drawio 的出口/入口（0~1 相对包围盒） */
function portsOf(pts: number[][]) {
  const p0 = pts[0], p1 = pts[1] || pts[0];
  const pn = pts[pts.length - 1], pv = pts[pts.length - 2] || p0;
  const side = (from: number[], to: number[]): [number, number] => {
    const dx = to[0] - from[0], dy = to[1] - from[1];
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? [1, 0.5] : [0, 0.5];
    return dy >= 0 ? [0.5, 1] : [0.5, 0];
  };
  const entry = side(pv, pn);
  // 入口方向反过来就是「连到图形哪一点」
  const entryOpp: [number, number] = [
    entry[0] === 0.5 ? 0.5 : 1 - entry[0],
    entry[1] === 0.5 ? 0.5 : 1 - entry[1]
  ];
  return { exit: side(p0, p1), entry: entryOpp };
}

/** 标注：优先放在折线的横向段上，纯直线时贴在线的右侧/上方 */
function labelAt(owner: string, pts: number[][], text: string): SceneItem {
  let best = { x: pts[0][0], y: pts[0][1], len: -1, horiz: true };
  for (let i = 1; i < pts.length; i++) {
    const dx = Math.abs(pts[i][0] - pts[i - 1][0]);
    const dy = Math.abs(pts[i][1] - pts[i - 1][1]);
    const len = Math.hypot(dx, dy);
    if (len > best.len) {
      best = {
        x: (pts[i][0] + pts[i - 1][0]) / 2,
        y: (pts[i][1] + pts[i - 1][1]) / 2,
        len, horiz: dx >= dy
      };
    }
  }
  const vertical = !best.horiz;
  return {
    k: 'label',
    x: vertical ? best.x + 16 : best.x,
    y: vertical ? best.y : best.y - 10,
    text, fs: LFS, owner, ownerX: 0, ownerY: vertical ? 0 : 10
  };
}

export function renderSwim(json: SwimData): Diagram[] {
  return layoutSwim(json).map(p => ({
    name: p.name, svg: paintSvg(uid('sw'), p.scene), w: p.scene.w, h: p.scene.h
  }));
}
