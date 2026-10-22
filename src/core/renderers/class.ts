/**
 * 类图（UML Class）。
 *
 * 和流程图 / 泳道图一样**坐标直给**：每个类填 `col` / `row`（网格，从 1 开始），
 * 类框的宽高由引擎按内容算（类名、属性、方法最长的那一行），不做自动布局。
 *
 * 关系按 UML 约定画（只差箭头语义，都是行业标准）：
 *   extends     实线 + 空心三角（指向父类）
 *   implements  虚线 + 空心三角
 *   composition 实线 + 实心菱形（菱形在 from 端 = 整体）
 *   aggregation 实线 + 空心菱形
 *   association 实线（可带标签）
 *   dependency  虚线 + 开口箭头
 */
import { tw, uid } from '../base';
import { paintSvg } from '../paint-svg';
import { classBoxHeight } from '../svg';
import type { ClassData, Diagram } from '../types';
import type { SceneItem, ScenePage } from '../scene';

const FS = 13;
const M = 60;
const PAD_X = 48;          // 格子左右留白（给连线让路）
const PAD_Y = 40;          // 格子上下留白
const GAP_Y = 24;          // 同格子内两个类之间的距离
const MIN_COL = 210;
const MIN_ROW = 140;
const INNER_X = 12;        // 类框内文字左右内边距（与 CLASS_M.padX 配合）

interface ClassNorm {
  id: string; name: string; stereotype: string;
  attrs: string[]; methods: string[];
  col: number; row: number;           // 0 基
}
interface Placed extends ClassNorm {
  cx: number; cy: number; w: number; h: number;
}

const KINDS: Record<string, { arrow: 'triHollow' | 'open' | 'none'; startArrow?: 'diamondFilled' | 'diamondHollow'; dash?: string }> = {
  extends:     { arrow: 'triHollow' },
  implements:  { arrow: 'triHollow', dash: '6 4' },
  composition: { arrow: 'none', startArrow: 'diamondFilled' },
  aggregation: { arrow: 'none', startArrow: 'diamondHollow' },
  association: { arrow: 'none' },
  dependency:  { arrow: 'open', dash: '6 4' }
};

export function normClass(json: ClassData) {
  const raw = Array.isArray((json as any)?.classes) ? (json as any).classes : [];
  const used = new Set<string>();
  const classes: ClassNorm[] = raw
    .filter((c: any) => c && typeof c === 'object')
    .map((c: any, i: number) => {
      let id = String(c.id ?? c.name ?? `c${i + 1}`);
      while (used.has(id)) id += '_';
      used.add(id);
      const arr = (v: any) => (Array.isArray(v) ? v.map((x: any) => String(typeof x === 'string' ? x : (x?.text ?? x?.name ?? ''))).filter(Boolean) : []);
      return {
        id,
        name: String(c.name ?? c.text ?? '未命名'),
        stereotype: c.stereotype ? String(c.stereotype) : '',
        attrs: arr(c.attributes ?? c.attrs ?? c.fields),
        methods: arr(c.methods ?? c.operations),
        col: Math.max(0, Math.round(Number(c.col) || 1) - 1),
        row: Math.max(0, Math.round(Number(c.row) || 1) - 1)
      };
    });
  const rawR = Array.isArray((json as any)?.relations) ? (json as any).relations : [];
  const relations = rawR
    .filter((r: any) => r && typeof r === 'object')
    .map((r: any) => ({
      from: String(r.from ?? ''),
      to: String(r.to ?? ''),
      kind: String(r.kind ?? r.type ?? 'association').toLowerCase(),
      label: r.label == null ? '' : String(r.label)
    }));
  return { classes, relations, title: String((json as any)?.title ?? '') };
}

/** 类框宽度：取类名 / 构造型 / 属性 / 方法里最长的一行 */
function boxWidth(c: ClassNorm): number {
  const lines = [c.name, c.stereotype, ...c.attrs, ...c.methods];
  const maxW = Math.max(...lines.map(l => tw(l, FS)), 60);
  return Math.max(160, Math.round(maxW + INNER_X * 2 + 16));
}

export function layoutClass(json: ClassData): ScenePage[] {
  const { classes, relations, title } = normClass(json);
  if (!classes.length) throw new Error('类图至少需要一个类（classes）');

  // 1) 每个类的尺寸
  const sized = classes.map(c => ({
    ...c,
    w: boxWidth(c),
    h: Math.round(classBoxHeight(c.attrs.length, c.methods.length, !!c.stereotype))
  }));

  // 2) 列宽 / 行高（同一列/行取最大值，保证不打架）
  const cols = Math.max(...sized.map(c => c.col)) + 1;
  const rows = Math.max(...sized.map(c => c.row)) + 1;
  const colW: number[] = [];
  const rowH: number[] = [];
  for (let i = 0; i < cols; i++) {
    const items = sized.filter(c => c.col === i);
    colW[i] = Math.max(MIN_COL, items.length ? Math.max(...items.map(c => c.w)) + PAD_X * 2 : MIN_COL);
  }
  for (let j = 0; j < rows; j++) {
    // 同一格里叠几个类时按总高撑开
    let tallest = 0;
    for (let i = 0; i < cols; i++) {
      const cell = sized.filter(c => c.col === i && c.row === j);
      if (!cell.length) continue;
      tallest = Math.max(tallest, cell.reduce((s, c) => s + c.h, 0) + GAP_Y * (cell.length - 1));
    }
    rowH[j] = Math.max(MIN_ROW, Math.round(tallest + PAD_Y * 2));
  }

  // 3) 网格 → 像素
  const colX: number[] = [];
  let cx0 = M;
  colW.forEach(w => { colX.push(cx0); cx0 += w; });
  const rowY: number[] = [];
  let cy0 = M + 40;                        // 顶部留出图标题
  rowH.forEach(h => { rowY.push(cy0); cy0 += h; });
  const W = cx0 + M;
  const H = cy0 + M;

  const placed: Placed[] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cell = sized.filter(c => c.col === i && c.row === j);
      if (!cell.length) continue;
      const total = cell.reduce((s, c) => s + c.h, 0) + GAP_Y * (cell.length - 1);
      let y = rowY[j] + (rowH[j] - total) / 2;
      cell.forEach(c => {
        placed.push({ ...c, cx: colX[i] + colW[i] / 2, cy: y + c.h / 2 });
        y += c.h + GAP_Y;
      });
    }
  }

  const byId = new Map(placed.map(p => [p.id, p]));
  const items: SceneItem[] = [];
  const labels: SceneItem[] = [];

  // 4) 图标题
  if (title) {
    items.push({ k: 'text', x: W / 2, y: M + 18, text: title, fs: 18, anchor: 'middle', weight: 'bold' });
  }

  // 5) 关系线（先画，类框的白底会盖住压进来的部分）
  relations.forEach((r, idx) => {
    const a = byId.get(r.from), b = byId.get(r.to);
    if (!a || !b) return;
    const pts = orthRoute(a, b, colX, colW);
    const st = KINDS[r.kind] || KINDS.association;
    const id = 'R' + idx;
    items.push({
      k: 'path', pts, sw: 1, arrow: st.arrow, startArrow: st.startArrow as any,
      dash: st.dash, link: [a.id, b.id], id,
      ports: portsOf(pts),
      route: pts.length > 2 ? 'ortho' : undefined
    });
    if (r.label) labels.push(labelAt(id, pts, r.label));
  });

  // 6) 类框（白底，最后画）
  placed.forEach(p => {
    items.push({
      k: 'classBox',
      x: p.cx - p.w / 2, y: p.cy - p.h / 2, w: p.w, h: p.h,
      name: p.name, stereotype: p.stereotype || undefined,
      attrs: p.attrs, methods: p.methods,
      fill: '#FFFFFF', stroke: '#000000', sw: 1, fs: FS, id: p.id
    });
  });

  return [{
    name: title || '类图',
    scene: { w: Math.round(W), h: Math.round(H), items: items.concat(labels) }
  }];
}

/**
 * 正交折线：
 * - 同列 → 竖直直连
 * - 同行 → 水平直连（两端高度不同时中间加一段折）
 * - 跨行跨列 → **走两列之间的竖缝**，横竖各一段，避免竖线穿过同列的其他类框
 */
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
  // 跨行 + 跨列：竖段走在目标列旁边的那条缝里（列内留白 48px，14px 足够）
  const toRight = b.cx > a.cx;
  const gx = toRight
    ? colX[b.col] - 14
    : colX[b.col] + colW[b.col] + 14;
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
    text, fs: 12, owner, ownerX: 0, ownerY: vertical ? 0 : 10
  };
}

export function renderClass(json: ClassData): Diagram[] {
  return layoutClass(json).map(p => ({
    name: p.name, svg: paintSvg(uid('cl'), p.scene), w: p.scene.w, h: p.scene.h
  }));
}
