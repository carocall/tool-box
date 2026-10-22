/**
 * 状态图（UML State Machine）。
 *
 * 和流程图同源：**不做自动布局**，每个状态填 `col` / `row`（网格，从 1 开始），
 * 引擎按内容算格子和连线。三种形状：
 *   - initial：实心小圆（一个状态图只有一个）
 *   - state  ：圆角矩形
 *   - final  ：双圆（实心圆 + 外圈）
 *
 * 连线是「事件 / 条件」，正交折线；状态自己连自己（重试、催付）会画成右侧小回路。
 */
import { tw, uid } from '../base';
import { paintSvg } from '../paint-svg';
import type { StateData, Diagram } from '../types';
import type { SceneItem, ScenePage } from '../scene';

const FS = 14;
const LFS = 12;
const M = 60;
const PAD_X = 40;
const PAD_Y = 34;
const GAP_Y = 22;
const MIN_COL = 132;
const MIN_ROW = 96;
const R_INIT = 9;          // 起始圆半径
const R_FINAL = 11;        // 终止圆外圈半径
const LOOP = 40;           // 自调用回路伸出长度

interface StateNorm {
  id: string; text: string; kind: string;
  col: number; row: number;
}
interface Placed extends StateNorm {
  cx: number; cy: number; w: number; h: number;
}

/** 圆点类的包围盒固定，状态框按文字算 */
function sizeOf(text: string, kind: string): { w: number; h: number } {
  if (kind === 'initial') return { w: R_INIT * 2, h: R_INIT * 2 };
  if (kind === 'final') return { w: R_FINAL * 2, h: R_FINAL * 2 };
  return { w: Math.max(112, Math.round(tw(text, FS) + 46)), h: 52 };
}

export function normState(json: StateData) {
  const raw = Array.isArray((json as any)?.nodes) ? (json as any).nodes : [];
  const used = new Set<string>();
  const nodes: StateNorm[] = raw
    .filter((n: any) => n && typeof n === 'object')
    .map((n: any, i: number) => {
      let id = String(n.id ?? `s${i + 1}`);
      while (used.has(id)) id += '_';
      used.add(id);
      const kind = String(n.kind ?? n.shape ?? 'state').toLowerCase();
      return {
        id,
        text: String(n.text ?? n.name ?? ''),
        kind: ['initial', 'final', 'state'].includes(kind) ? kind : 'state',
        col: Math.max(0, Math.round(Number(n.col) || 1) - 1),
        row: Math.max(0, Math.round(Number(n.row) || 1) - 1)
      };
    });
  const rawT = Array.isArray((json as any)?.transitions) ? (json as any).transitions : [];
  const transitions = rawT
    .filter((t: any) => t && typeof t === 'object' && t.from != null && t.to != null)
    .map((t: any) => ({
      from: String(t.from), to: String(t.to),
      label: t.label == null ? '' : String(t.label),
      dash: !!t.dash
    }));
  return { nodes, transitions, title: String((json as any)?.title ?? '') };
}

export function layoutState(json: StateData): ScenePage[] {
  const { nodes, transitions, title } = normState(json);
  if (!nodes.length) throw new Error('状态图至少需要一个节点（nodes）');

  const sized = nodes.map(n => ({ ...n, ...sizeOf(n.text, n.kind) }));

  // 列宽 / 行高（同列/同行取最大值；同格多个时按总高叠）
  const cols = Math.max(...sized.map(n => n.col)) + 1;
  const rows = Math.max(...sized.map(n => n.row)) + 1;
  const colW: number[] = [];
  const rowH: number[] = [];
  for (let i = 0; i < cols; i++) {
    const cell = sized.filter(n => n.col === i);
    colW[i] = Math.max(MIN_COL, cell.length ? Math.max(...cell.map(n => n.w)) + PAD_X * 2 : MIN_COL);
  }
  for (let j = 0; j < rows; j++) {
    let tallest = 0;
    for (let i = 0; i < cols; i++) {
      const cell = sized.filter(n => n.col === i && n.row === j);
      if (!cell.length) continue;
      tallest = Math.max(tallest, cell.reduce((s, n) => s + n.h, 0) + GAP_Y * (cell.length - 1));
    }
    rowH[j] = Math.max(MIN_ROW, Math.round(tallest + PAD_Y * 2));
  }

  const colX: number[] = [];
  let cx0 = M;
  colW.forEach(w => { colX.push(cx0); cx0 += w; });
  const rowY: number[] = [];
  let cy0 = M;
  rowH.forEach(h => { rowY.push(cy0); cy0 += h; });
  const W = cx0 + M;
  const H = cy0 + M;

  const placed: Placed[] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cell = sized.filter(n => n.col === i && n.row === j);
      if (!cell.length) continue;
      const total = cell.reduce((s, n) => s + n.h, 0) + GAP_Y * (cell.length - 1);
      let y = rowY[j] + (rowH[j] - total) / 2;
      cell.forEach(n => {
        placed.push({ ...n, cx: colX[i] + colW[i] / 2, cy: y + n.h / 2 });
        y += n.h + GAP_Y;
      });
    }
  }

  const byId = new Map(placed.map(p => [p.id, p]));
  const items: SceneItem[] = [];
  const labels: SceneItem[] = [];
  const selfCount = new Map<string, number>();
  let bottom = 0;   // 自回路可能伸出最后一行，画布要跟着长高

  // 1) 连线（先画，圆点/状态框的白底会盖住压进来的部分）
  transitions.forEach((t, idx) => {
    const a = byId.get(t.from), b = byId.get(t.to);
    if (!a || !b) return;
    const id = 'T' + idx;
    if (a === b) {
      // 自调用：右侧一个方回路，放在**下半侧** —— 正中的位置会被出线占着，两者会叠在一起。
      // 同一个状态有多条自迁移（重试、超时…）时往下错开，别叠成一团。
      const k = selfCount.get(a.id) ?? 0;
      selfCount.set(a.id, k + 1);
      const dy = k * 56;
      const x0 = a.cx + a.w / 2, x1 = x0 + LOOP;
      const yTop = a.cy + 6 + dy, yBot = a.cy + 30 + dy;
      items.push({
        k: 'path', pts: [[x0, yTop], [x1, yTop], [x1, yBot], [x0, yBot]],
        sw: 1, arrow: 'solid', dash: t.dash ? '6 4' : undefined,
        link: [a.id, b.id], id, loop: true, route: 'ortho'
      });
      bottom = Math.max(bottom, yBot + (t.label ? 34 : 8));
      if (t.label) {
        // 标签挂在**状态框**下面（不是挂边上）：draw.io 对自回路的边标签只肯放在回路正中，
        // 又吃不到 ownerX/ownerY 偏移（±24、±40 都试过，纹丝不动），压上去就是一团。
        // 挂成子单元格反而最稳：位置自己定，拖动状态框时文字还跟着走。
        labels.push({
          k: 'text', x: (x0 + x1) / 2, y: yBot + 16, text: t.label, fs: LFS, parent: a.id
        });
      }
      return;
    }
    const pts = orthRoute(a, b, colX, colW);
    items.push({
      k: 'path', pts, sw: 1, arrow: 'solid', dash: t.dash ? '6 4' : undefined,
      link: [a.id, b.id], id, ports: portsOf(pts),
      route: pts.length > 2 ? 'ortho' : undefined
    });
    if (t.label) labels.push(labelAt(id, pts, t.label));
  });

  // 2) 节点
  placed.forEach(p => {
    if (p.kind === 'initial') {
      items.push({ k: 'ellipse', cx: p.cx, cy: p.cy, rx: R_INIT, ry: R_INIT, fill: '#000000', stroke: '#000000', sw: 1, id: p.id });
    } else if (p.kind === 'final') {
      items.push({ k: 'ellipse', cx: p.cx, cy: p.cy, rx: R_FINAL, ry: R_FINAL, fill: '#FFFFFF', stroke: '#000000', sw: 1, id: p.id });
      items.push({ k: 'ellipse', cx: p.cx, cy: p.cy, rx: R_FINAL - 4.5, ry: R_FINAL - 4.5, fill: '#000000', stroke: '#000000', sw: 1 });
    } else {
      items.push({
        k: 'rect', x: p.cx - p.w / 2, y: p.cy - p.h / 2, w: p.w, h: p.h, rx: 12,
        fill: '#FFFFFF', stroke: '#000000', sw: 1, text: p.text, fs: FS, id: p.id
      });
    }
  });

  return [{
    name: title || '状态图',
    scene: { w: Math.round(W), h: Math.round(Math.max(H, bottom + 30)), items: items.concat(labels) }
  }];
}

/** 正交折线：同列竖直、同行水平、跨行列走两列之间的竖缝 */
function orthRoute(a: Placed, b: Placed, colX: number[], colW: number[]): number[][] {
  const aTop = a.cy - a.h / 2, aBot = a.cy + a.h / 2;
  const bTop = b.cy - b.h / 2, bBot = b.cy + b.h / 2;

  if (Math.abs(a.cx - b.cx) < 1) {
    return b.cy >= a.cy ? [[a.cx, aBot], [b.cx, bTop]] : [[a.cx, aTop], [b.cx, bBot]];
  }
  if (a.row === b.row) {
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
  const toRight = b.cx > a.cx;
  const gx = toRight ? colX[b.col] - 14 : colX[b.col] + colW[b.col] + 14;
  return [
    [toRight ? a.cx + a.w / 2 : a.cx - a.w / 2, a.cy],
    [gx, a.cy],
    [gx, b.cy],
    [toRight ? b.cx - b.w / 2 : b.cx + b.w / 2, b.cy]
  ];
}

function portsOf(pts: number[][]) {
  const p0 = pts[0], p1 = pts[1] || pts[0];
  const pn = pts[pts.length - 1], pv = pts[pts.length - 2] || p0;
  const side = (from: number[], to: number[]): [number, number] => {
    const dx = to[0] - from[0], dy = to[1] - from[1];
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? [1, 0.5] : [0, 0.5];
    return dy >= 0 ? [0.5, 1] : [0.5, 0];
  };
  const entry = side(pv, pn);
  return {
    exit: side(p0, p1),
    entry: [entry[0] === 0.5 ? 0.5 : 1 - entry[0], entry[1] === 0.5 ? 0.5 : 1 - entry[1]] as [number, number]
  };
}

function labelAt(owner: string, pts: number[][], text: string): SceneItem {
  let best = { x: pts[0][0], y: pts[0][1], len: -1, horiz: true };
  for (let i = 1; i < pts.length; i++) {
    const dx = Math.abs(pts[i][0] - pts[i - 1][0]);
    const dy = Math.abs(pts[i][1] - pts[i - 1][1]);
    const len = Math.hypot(dx, dy);
    if (len > best.len) {
      best = { x: (pts[i][0] + pts[i - 1][0]) / 2, y: (pts[i][1] + pts[i - 1][1]) / 2, len, horiz: dx >= dy };
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

export function renderState(json: StateData): Diagram[] {
  return layoutState(json).map(p => ({
    name: p.name, svg: paintSvg(uid('st'), p.scene), w: p.scene.w, h: p.scene.h
  }));
}
