/**
 * 流程图：**坐标由 AI 直接给**（网格 col/row），引擎只做换算，不做自动布局。
 *
 * 为什么不做自动布局：流程图的分支、回环、合流太不规则，自动算怎么都容易乱；
 * 让 AI 按网格给出位置反而更接近人手画出来的效果。
 * 重叠、对齐之类的问题不在这里校验 —— 用户可以导进 draw.io 自己拖两下。
 *
 * 网格约定：`col` / `row` 指的是**节点中心**落在第几格，一格默认 40px。
 * 同一 row 的节点 y 绝对对齐，同一 col 的节点 x 绝对对齐（这是「整齐」的来源）。
 * 宽高由引擎按文字长度算，想更宽可以用 `w`（单位同样是格）覆盖。
 */
import { tw, uid } from '../base';
import { paintSvg } from '../paint-svg';
import type { FlowData, Diagram } from '../types';
import type { SceneItem, ScenePage } from '../scene';

const FS = 16;              // 框内字号
const LFS = 14;             // 连线标注字号
const M = 60;               // 页边距
const UNIT_DEFAULT = 40;    // 一格多少像素
const SLANT = 18;           // 平行四边形斜边的水平偏移

interface FlowNodeNorm {
  id: string; text: string; shape: string;
  col: number; row: number; w: number;
}
interface Placed extends FlowNodeNorm {
  cx: number; cy: number; w2: number; h: number;
}

/** 按形状算宽高：宽度跟文字走（判断框要更宽，因为文字被菱形斜边挤掉一半） */
function sizeOf(text: string, shape: string): { w: number; h: number } {
  const t = tw(text, FS);
  if (shape === 'decision') return { w: Math.max(150, Math.round(t * 1.85 + 44)), h: 84 };
  if (shape === 'io') return { w: Math.max(140, Math.round(t + 84)), h: 56 };
  if (shape === 'start' || shape === 'end') return { w: Math.max(110, Math.round(t + 60)), h: 48 };
  return { w: Math.max(120, Math.round(t + 52)), h: 56 };
}

/** 兼容 `id / text / name`、`shape / type`、缺省 col/row 等写法（宽松，不报错） */
export function normFlow(json: FlowData) {
  const unit = Number((json as any)?.unit) > 0 ? Number((json as any).unit) : UNIT_DEFAULT;
  const rawNodes = Array.isArray((json as any)?.nodes) ? (json as any).nodes : [];
  const nodes: FlowNodeNorm[] = rawNodes
    .filter((n: any) => n && typeof n === 'object')
    .map((n: any, i: number) => ({
      id: String(n.id ?? `n${i + 1}`),
      text: String(n.text ?? n.name ?? n.label ?? ''),
      shape: String(n.shape ?? n.type ?? 'process').toLowerCase(),
      col: Number.isFinite(Number(n.col)) ? Number(n.col) : 4,
      row: Number.isFinite(Number(n.row)) ? Number(n.row) : 1 + i * 2,
      w: Number(n.w) > 0 ? Number(n.w) : 0
    }));
  const rawEdges = Array.isArray((json as any)?.edges) ? (json as any).edges : [];
  const edges = rawEdges
    .filter((e: any) => e && typeof e === 'object')
    .map((e: any) => ({
      from: String(e.from ?? ''),
      to: String(e.to ?? ''),
      label: e.label == null ? '' : String(e.label),
      dash: !!e.dash
    }));
  return { unit, nodes, edges, title: String((json as any)?.title ?? '') };
}

export function layoutFlow(json: FlowData): ScenePage[] {
  const { unit, nodes, edges, title } = normFlow(json);
  if (!nodes.length) throw new Error('流程图至少需要一个节点（nodes）');

  // 1) 网格 → 像素（先按原始坐标算，随后整体平移到边距内）
  const placed: Placed[] = nodes.map(n => {
    const s = sizeOf(n.text, n.shape);
    return { ...n, cx: n.col * unit, cy: n.row * unit, w2: n.w ? Math.round(n.w * unit) : s.w, h: s.h };
  });

  const minX = Math.min(...placed.map(p => p.cx - p.w2 / 2));
  const minY = Math.min(...placed.map(p => p.cy - p.h / 2));
  const shiftX = M - minX, shiftY = M - minY;
  placed.forEach(p => { p.cx += shiftX; p.cy += shiftY; });

  const W = Math.max(...placed.map(p => p.cx + p.w2 / 2)) + M;
  const H = Math.max(...placed.map(p => p.cy + p.h / 2)) + M;

  const byId = new Map(placed.map(p => [p.id, p]));
  const items: SceneItem[] = [];
  const labels: SceneItem[] = [];

  // 2) 连线：按「上下 / 左右」选端口，两端都钉在边框中点，天然横平竖直
  edges.forEach((e, i) => {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) return;                       // 引用不存在的节点：跳过（不做校验）
    const vertical = Math.abs(b.cy - a.cy) >= Math.abs(b.cx - a.cx);
    let p1: number[], p2: number[], ports: any;
    if (vertical) {
      const down = b.cy >= a.cy;
      p1 = [a.cx, down ? a.cy + a.h / 2 : a.cy - a.h / 2];
      p2 = [b.cx, down ? b.cy - b.h / 2 : b.cy + b.h / 2];
      ports = { exit: [0.5, down ? 1 : 0], entry: [0.5, down ? 0 : 1] };
    } else {
      const right = b.cx >= a.cx;
      p1 = [right ? a.cx + a.w2 / 2 : a.cx - a.w2 / 2, a.cy];
      p2 = [right ? b.cx - b.w2 / 2 : b.cx + b.w2 / 2, b.cy];
      ports = { exit: [right ? 1 : 0, 0.5], entry: [right ? 0 : 1, 0.5] };
    }
    const id = 'E' + i;
    items.push({
      k: 'path', pts: [p1, p2], sw: 1, arrow: 'solid',
      dash: e.dash ? '6 4' : undefined,
      link: [a.id, b.id], id, ports
    });
    if (e.label) {
      const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
      // 竖线把标注放右边、横线放上边，避免压住箭头
      labels.push({
        k: 'label', x: vertical ? mx + 17 : mx, y: vertical ? my : my - 12,
        text: e.label, fs: LFS, owner: id, ownerX: 0, ownerY: vertical ? 0 : 12
      });
    }
  });

  // 3) 图形（白底，会盖住先画的线）
  placed.forEach(p => {
    const x = p.cx - p.w2 / 2, y = p.cy - p.h / 2;
    const base = { fill: '#FFFFFF', stroke: '#000000', sw: 1, text: p.text, fs: FS, id: p.id };
    if (p.shape === 'decision') {
      items.push({ k: 'diamond', cx: p.cx, cy: p.cy, w: p.w2, h: p.h, ...base });
    } else if (p.shape === 'io') {
      items.push({
        k: 'polygon', shape: 'parallelogram',
        pts: [[x + SLANT, y], [x + p.w2, y], [x + p.w2 - SLANT, y + p.h], [x, y + p.h]],
        ...base
      });
    } else {
      const pill = p.shape === 'start' || p.shape === 'end';
      items.push({ k: 'rect', x, y, w: p.w2, h: p.h, rx: pill ? p.h / 2 : 0, ...base });
    }
  });

  // 4) 标注最后画（白底会把线切断，正好让「是/否」读得清）
  const all = items.concat(labels);

  return [{
    name: title || '流程图',
    scene: { w: Math.round(W), h: Math.round(H), items: all }
  }];
}

export function renderFlow(json: FlowData): Diagram[] {
  return layoutFlow(json).map(p => ({
    name: p.name, svg: paintSvg(uid('fl'), p.scene), w: p.scene.w, h: p.scene.h
  }));
}
