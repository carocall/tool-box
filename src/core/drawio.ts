/**
 * 场景图 → draw.io（.drawio / mxfile）XML。
 *
 * 这一版的首要目标不是"看起来像"，而是**打开后真的能编辑**：
 *
 * 1. **所有连线都是真正的连接线**（`source` / `target` 指向真实单元格），
 *    没有"浮空线段拼接"。拖动任意图形，线会跟着走、自动重新贴边。
 * 2. **文字属于图形**（矩形的 label、边的 label），而不是压在图形上的独立文本框。
 *    基数 1/n、消息文字都挂在对应边上，跟着线移动。
 * 3. **从属关系用父子单元格表达**：时序图的激活条与生命线锚点挂在参与方下面，
 *    拖动整列时一起走。
 * 4. 多张图 = **多页 .drawio**（ER 的「总图 + N 张属性图」= N 个 <diagram>）。
 *
 * 刻意遵守 skill（drawio.md）里的硬约束：
 * - 必须有 id="0" / id="1"；顶点 `vertex="1"`、边 `edge="1"` 互斥；
 * - 非矩形图形显式给出 `perimeter`（菱形/椭圆），否则连线会连到包围盒而不是图形边界；
 * - 属性值里不能出现裸 `<`，换行写 `&lt;br&gt;`（写 `<br>` 会让 XML 非法，
 *   draw.io 会静默丢掉后面所有单元格）；
 * - 父单元格必须写在子单元格之前（mxCodec 按文档顺序解析 parent）。
 */
import { esc, tw } from './base';
import { tokenizeV } from './vertical';
import type { Scene, SceneItem, ScenePage, SceneLabel } from './scene';

const FONT = 'Microsoft YaHei';
/** draw.io 保存时写的版本号，仅作元信息 */
const DIO_VERSION = '24.7.17';

const n2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * 文本转 html label。
 * XML 属性值里不能出现裸 `<`，所以 `<br>` 必须写成 `&lt;br&gt;`；
 * draw.io 读到后先做 XML 反转义再按 HTML 渲染，正好得到一个换行。
 */
const BR = '&lt;br&gt;';
function htmlValue(text: string, vertical = false): string {
  const lines = String(text == null ? '' : text).split(/\r?\n|<br\s*\/?>/i);
  if (!vertical) return lines.map(l => esc(l)).join(BR);
  const out: string[] = [];
  lines.forEach(l => tokenizeV(l).forEach(tk => out.push(esc(tk))));
  return out.join(BR);
}

/** 图形通用样式：白底 + 黑线 + 无圆角 + 无阴影 */
function shapeStyle(o: {
  prefix?: string; fill?: string; stroke?: string; sw?: number; fs?: number;
  weight?: string; dash?: string; rx?: number; perimeter?: string;
  align?: 'left'; spacingLeft?: number;
}): string {
  const fill = o.fill ?? '#FFFFFF';
  const stroke = o.stroke ?? '#000000';
  const sw = o.sw ?? 1;
  const round = o.rx ? 'rounded=1;' : 'rounded=0;';
  let s = (o.prefix || '') + round + 'whiteSpace=wrap;html=1;'
    + `fillColor=${fill};strokeColor=${stroke};strokeWidth=${n2(sw)};`
    + `fontSize=${o.fs ?? 16};fontFamily=${FONT};fontColor=#000000;`
    + `fontStyle=${o.weight === '700' || o.weight === '600' || o.weight === 'bold' ? 1 : 0};`;
  // 左对齐文字（架构图的层名靠左），与 SVG 的 textAlign:'start' 对应；居中是默认值，不用写
  if (o.align === 'left') s += `align=left;spacingLeft=${o.spacingLeft ?? 12};`;
  if (o.perimeter) s += `perimeter=${o.perimeter};`;
  if (o.dash) s += 'dashed=1;dashPattern=' + o.dash.replace(/\s+/g, ' ') + ';';
  return s;
}

/** 独立文字（无边框）样式 */
function textStyle(o: { fs: number; align?: string; weight?: string; bg?: boolean }): string {
  const bold = o.weight === '700' || o.weight === '600' || o.weight === 'bold';
  return 'text;html=1;whiteSpace=wrap;'
    + `align=${o.align || 'center'};verticalAlign=middle;resizable=0;points=[];`
    + `fontSize=${o.fs};fontFamily=${FONT};fontColor=#000000;fontStyle=${bold ? 1 : 0};`
    + (o.bg === false ? 'labelBackgroundColor=none;' : 'labelBackgroundColor=#FFFFFF;');
}

interface Ports { exit?: [number, number]; entry?: [number, number] }

/** 边样式：`endArrow=none` 时为普通连线 */
function edgeStyle(o: {
  sw?: number; dash?: string; arrow?: 'solid' | 'open' | 'none' | 'triHollow';
  startArrow?: 'diamondFilled' | 'diamondHollow';
  stroke?: string; ports?: Ports; labelFs?: number; ortho?: boolean; html?: boolean;
}): string {
  let head = 'endArrow=none;';
  if (o.arrow === 'solid') head = 'endArrow=block;endFill=1;endSize=7;';
  else if (o.arrow === 'open') head = 'endArrow=open;endFill=0;endSize=8;';
  // 继承 / 实现：空心三角
  else if (o.arrow === 'triHollow') head = 'endArrow=block;endFill=0;endSize=10;';
  // 组合（实心菱形）/ 聚合（空心菱形）：菱形画在起点，也就是“整体”那一端
  if (o.startArrow === 'diamondFilled') head += 'startArrow=diamondThin;startFill=1;startSize=12;';
  else if (o.startArrow === 'diamondHollow') head += 'startArrow=diamondThin;startFill=0;startSize=12;';
  // 正交路由：拖动端点后 draw.io 会自动重排直角，而不是拉成斜线
  // html=0：标签里有尖括号（如 <<include>>）时必须关掉 HTML 渲染，
  // 否则 draw.io 会把 <<include>> 当成未知标签吞掉，只剩一个 "<>"
  const html = o.html === false ? 0 : 1;
  let s = head + `html=${html};rounded=0;` + (o.ortho ? 'edgeStyle=orthogonalEdgeStyle;' : 'edgeStyle=none;')
    + `strokeColor=${o.stroke ?? '#000000'};strokeWidth=${n2(o.sw ?? 1)};`;
  if (o.dash) s += 'dashed=1;dashPattern=' + o.dash.replace(/\s+/g, ' ') + ';';
  // 显式端口：不加的话 drawio 会按图形中心自动选口，消息/基数会跑位
  if (o.ports?.exit) {
    s += `exitX=${n2(o.ports.exit[0])};exitY=${n2(o.ports.exit[1])};exitPerimeter=0;`;
  }
  if (o.ports?.entry) {
    s += `entryX=${n2(o.ports.entry[0])};entryY=${n2(o.ports.entry[1])};entryPerimeter=0;`;
  }
  if (o.labelFs !== undefined) {
    s += `fontSize=${o.labelFs};fontFamily=${FONT};fontColor=#000000;labelBackgroundColor=#FFFFFF;`;
  }
  return s;
}

interface Cell {
  id: string;
  style: string;
  value?: string;
  vertex?: boolean;
  edge?: boolean;
  parent?: string;
  source?: string;
  target?: string;
  /** 顶点几何（绝对坐标或相对父级的坐标） */
  x?: number; y?: number; w?: number; h?: number;
  /** 边的自由端点（仅当某一端没有连接时使用） */
  sourcePoint?: number[];
  targetPoint?: number[];
  /** 边的中间折点（绝对坐标） */
  waypoints?: number[][];
  /** 边标签的位置：x 沿边比例（0=中点），y 垂直偏移（像素） */
  labelX?: number;
  labelY?: number;
}

let CELL = 0;
const nextId = (p: string) => p + (++CELL).toString(36);

function cellXml(c: Cell): string {
  const attrs = [`id="${c.id}"`];
  if (c.value !== undefined) attrs.push(`value="${c.value}"`);
  attrs.push(`style="${c.style}"`);
  if (c.vertex) attrs.push('vertex="1"');
  if (c.edge) attrs.push('edge="1"');
  attrs.push(`parent="${c.parent || '1'}"`);
  if (c.source) attrs.push(`source="${c.source}"`);
  if (c.target) attrs.push(`target="${c.target}"`);

  let geo: string;
  if (c.vertex) {
    geo = `<mxGeometry x="${n2(c.x ?? 0)}" y="${n2(c.y ?? 0)}" width="${n2(c.w ?? 0)}" height="${n2(c.h ?? 0)}" as="geometry" />`;
  } else {
    const parts: string[] = [];
    if (c.sourcePoint) parts.push(`<mxPoint x="${n2(c.sourcePoint[0])}" y="${n2(c.sourcePoint[1])}" as="sourcePoint" />`);
    if (c.targetPoint) parts.push(`<mxPoint x="${n2(c.targetPoint[0])}" y="${n2(c.targetPoint[1])}" as="targetPoint" />`);
    if (c.waypoints && c.waypoints.length) {
      parts.push('<Array as="points">');
      c.waypoints.forEach(p => parts.push(`<mxPoint x="${n2(p[0])}" y="${n2(p[1])}" />`));
      parts.push('</Array>');
    }
    const hasLabel = c.labelX !== undefined || c.labelY !== undefined;
    if (hasLabel) parts.push('<mxPoint as="offset" />');
    const xy = hasLabel ? ` x="${n2(c.labelX ?? 0)}" y="${n2(c.labelY ?? 0)}"` : '';
    geo = `<mxGeometry${xy} relative="1" as="geometry">${parts.join('')}</mxGeometry>`;
  }
  return `<mxCell ${attrs.join(' ')}>${geo}</mxCell>`;
}

/** 类框里的文字要先做 **HTML** 转义：否则 `<<interface>>`、`List<Order>` 会被当成标签吞掉 */
function htmlText(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 类框的 HTML 标签：类名居中加粗，属性/方法左对齐，三段之间用 `<hr>` 分隔。
 * 返回的是**已做 XML 转义**的字符串（esc 一次，drawio 解析后会还原成真标签）。
 */
function classBoxHtml(it: any): string {
  const parts: string[] = [];
  if (it.stereotype) parts.push(`<div style="text-align:center;font-size:11px;">${htmlText(it.stereotype)}</div>`);
  parts.push(`<div style="text-align:center;"><b>${htmlText(it.name)}</b></div>`);
  parts.push('<hr size="1">');
  (it.attrs || []).forEach((a: string) => parts.push(`<div style="text-align:left;">${htmlText(a)}</div>`));
  parts.push('<hr size="1">');
  (it.methods || []).forEach((m: string) => parts.push(`<div style="text-align:left;">${htmlText(m)}</div>`));
  return esc(parts.join(''));
}

const isVertex = (it: SceneItem): boolean =>
  it.k === 'rect' || it.k === 'ellipse' || it.k === 'diamond' || it.k === 'polygon' || it.k === 'classBox' || it.k === 'actor' || it.k === 'anchor';
const isEdge = (it: SceneItem): boolean => it.k === 'line' || it.k === 'path';

/** 顶点在画布上的绝对包围盒（子元素换算相对坐标要用） */
function absBoxOf(it: SceneItem): { x: number; y: number; w: number; h: number } | null {
  if (it.k === 'rect') return { x: it.x, y: it.y, w: it.w, h: it.h };
  if (it.k === 'ellipse') return { x: it.cx - it.rx, y: it.cy - it.ry, w: it.rx * 2, h: it.ry * 2 };
  if (it.k === 'diamond') return { x: it.cx - it.w / 2, y: it.cy - it.h / 2, w: it.w, h: it.h };
  if (it.k === 'classBox') return { x: it.x, y: it.y, w: it.w, h: it.h };
  if (it.k === 'polygon') {
    const xs = it.pts.map(p => p[0]), ys = it.pts.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  if (it.k === 'actor') {
    const s = it.scale ?? 1;
    return { x: it.cx - 13 * s, y: it.top, w: 26 * s, h: 58 * s };
  }
  if (it.k === 'anchor') return { x: it.x, y: it.y, w: 0, h: 0 };
  return null;
}

/** 一个场景 → 一组 drawio cell（顶点在前、边在后；父级先于子级） */
function sceneCells(sc: Scene): Cell[] {
  const idOf = new Map<string, string>();

  // ── 预分配顶点 id（边引用它们时必须已经存在）──
  const vertices = sc.items.filter(isVertex);
  vertices.forEach(v => { const id = (v as any).id; if (id) idOf.set(id, nextId('v')); });

  // ── 挂在边上的文字（value 写到边上，不再单独占一个文本框）──
  const labelOf = new Map<string, SceneLabel>();
  sc.items.forEach(it => { if (it.k === 'label' && it.owner) labelOf.set(it.owner, it); });

  const out: Cell[] = [];
  const abs = new Map<string, { x: number; y: number; w: number; h: number }>();

  // ── 顶点：先输出无父级的，再输出子级（mxCodec 按文档顺序解析 parent）──
  const ordered = vertices.filter(v => !(v as any).parent).concat(vertices.filter(v => (v as any).parent));
  for (const it of ordered) {
    const sid = (it as any).id as string | undefined;
    const id = sid ? idOf.get(sid)! : nextId('v');
    const parentSid = (it as any).parent as string | undefined;
    const parentId = parentSid ? idOf.get(parentSid) : undefined;
    const box = absBoxOf(it)!;
    const pb = parentId ? abs.get(parentId) : undefined;
    // 子元素坐标要相对父级原点
    const bx = pb ? box.x - pb.x : box.x;
    const by = pb ? box.y - pb.y : box.y;
    if (id) abs.set(id, box);

    if (it.k === 'rect') {
      const value = it.vtext !== undefined ? htmlValue(it.vtext, true)
        : it.text !== undefined ? htmlValue(it.text) : '';
      out.push({
        id, vertex: true, value, parent: parentId,
        style: shapeStyle({ fill: it.fill, stroke: it.stroke, sw: it.sw, fs: it.fs ?? 16, weight: it.weight, dash: it.dash, rx: it.rx, align: it.textAlign === 'start' ? 'left' : undefined, spacingLeft: it.textPad }),
        x: bx, y: by, w: it.w, h: it.h
      });
    } else if (it.k === 'ellipse') {
      out.push({
        id, vertex: true, value: it.text !== undefined ? htmlValue(it.text) : '', parent: parentId,
        style: shapeStyle({ prefix: 'ellipse;', fill: it.fill, stroke: it.stroke, sw: it.sw, fs: it.fs ?? 16, perimeter: 'ellipsePerimeter' }),
        x: bx, y: by, w: it.rx * 2, h: it.ry * 2
      });
    } else if (it.k === 'diamond') {
      out.push({
        id, vertex: true, value: it.text !== undefined ? htmlValue(it.text) : '', parent: parentId,
        style: shapeStyle({ prefix: 'rhombus;', fill: it.fill, stroke: it.stroke, sw: it.sw, fs: it.fs ?? 22, weight: it.weight, perimeter: 'rhombusPerimeter' }),
        x: bx, y: by, w: it.w, h: it.h
      });
    } else if (it.k === 'polygon') {
      const xs = it.pts.map(p => p[0]), ys = it.pts.map(p => p[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys);
      out.push({
        id, vertex: true, value: it.text !== undefined ? htmlValue(it.text) : '', parent: parentId,
        style: shapeStyle({
          prefix: 'shape=parallelogram;', fill: it.fill, stroke: it.stroke, sw: it.sw,
          fs: it.fs ?? 16, perimeter: 'parallelogramPerimeter'
        }),
        x: bx, y: by, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0
      });
    } else if (it.k === 'classBox') {
      // 一个类 = 一个单元格，三段式靠 HTML 标签里的 <hr> 分隔（这样拖动时是一个整体）
      out.push({
        id, vertex: true, value: classBoxHtml(it), parent: parentId,
        style: shapeStyle({ fill: it.fill, stroke: it.stroke, sw: it.sw, fs: it.fs ?? 13 })
          + 'align=center;verticalAlign=top;spacing=2;spacingLeft=6;spacingRight=6;',
        x: bx, y: by, w: it.w, h: it.h
      });
    } else if (it.k === 'actor') {
      const s = it.scale ?? 1;
      // 火柴人不把角色名放进 value：draw.io 会把名字画在小人腿上，这里单独出一个文字单元格
      out.push({
        id, vertex: true, value: '', parent: parentId,
        style: `shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;`
          + `fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=1.4;fontFamily=${FONT};`,
        x: bx, y: by, w: 26 * s, h: 58 * s
      });
      if (it.label !== undefined) {
        const fs = it.labelFs ?? 17;
        const w = tw(it.label, fs) + 8, h = fs + 8;
        const bold = it.labelWeight === '600' || it.labelWeight === '700';
        // draw.io 的 umlActor 会把小人画满几何框（脚落在框底），比 SVG 留白少 5~6px，
        // 所以 label 额外下移一点，避免贴住腿。
        const cy = (it.labelY ?? (it.top + 58 * s)) + 6;
        // 名字挂成火柴人的子单元格：拖动小人时名字跟着走
        out.push({
          id: nextId('t'), vertex: true, value: htmlValue(it.label), parent: id,
          style: textStyle({ fs, align: 'center', weight: bold ? '600' : undefined, bg: false }),
          x: it.cx - w / 2 - box.x,
          y: cy - h / 2 - box.y,
          w, h
        });
      }
    } else if (it.k === 'anchor') {
      // 不可见连接点：生命线下端就落在这里
      out.push({
        id, vertex: true, value: '', parent: parentId,
        style: 'rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=none;connectable=0;',
        x: bx, y: by, w: 1, h: 1
      });
    }
  }

  // ── 边：一律 source/target 连接；标签跟随边 ──
  for (const it of sc.items) {
    if (it.k === 'line' || it.k === 'path') {
      const pts = it.k === 'line' ? [[it.x1, it.y1], [it.x2, it.y2]] : it.pts;
      const src = it.link && it.link[0] ? idOf.get(it.link[0]) : undefined;
      const dst = it.link && it.link[1] ? idOf.get(it.link[1]) : undefined;
      const lab = it.id ? labelOf.get(it.id) : undefined;
      const labText = lab ? lab.text : '';
      const c: Cell = {
        id: nextId('e'), edge: true,
        style: edgeStyle({
          sw: it.sw, dash: it.dash, arrow: it.k === 'path' ? (it.arrow ?? 'none') : 'none',
          startArrow: it.k === 'path' ? (it as any).startArrow : undefined,
          ports: (it as any).ports, labelFs: lab ? lab.fs : undefined,
          ortho: it.k === 'path' && (it as any).route === 'ortho',
          // 含尖括号的标签（<<include>>）必须走纯文本渲染
          html: !/[<>]/.test(labText)
        })
      };
      if (lab) {
        c.value = htmlValue(lab.text);
        c.labelX = lab.ownerX ?? 0;
        c.labelY = lab.ownerY ?? 0;
      }
      if (src) c.source = src;
      if (dst) c.target = dst;
      // 两端都连了图形时，首尾点由端口/图形边界决定，只保留中间折点
      if (src && dst && pts.length > 2) c.waypoints = pts.slice(1, -1);
      if (!src) c.sourcePoint = pts[0];
      if (!dst) c.targetPoint = pts[pts.length - 1];
      out.push(c);
    } else if (it.k === 'label' && !it.owner) {
      // 兜底：没有归属边的标注才单独建文本框
      const w = tw(it.text, it.fs) + 10, h = it.fs + 8;
      out.push({
        id: nextId('t'), vertex: true, value: htmlValue(it.text),
        style: textStyle({ fs: it.fs }),
        x: it.x - w / 2, y: it.y - h / 2, w, h
      });
    } else if (it.k === 'text') {
      const w = tw(it.text, it.fs) + 8, h = it.fs + 8;
      const align = it.anchor === 'start' ? 'left' : it.anchor === 'end' ? 'right' : 'center';
      const x = it.anchor === 'start' ? it.x : it.anchor === 'end' ? it.x - w : it.x - w / 2;
      out.push({
        id: nextId('t'), vertex: true, value: htmlValue(it.text),
        style: textStyle({ fs: it.fs, align, weight: it.weight, bg: false }),
        x, y: it.y - h / 2, w, h
      });
    }
  }
  return out;
}

function pageXml(name: string, sc: Scene, pageId: string): string {
  CELL = 0;
  const cells = sceneCells(sc).map(cellXml).join('\n        ');
  return `  <diagram id="${esc(pageId)}" name="${esc(name)}">
    <mxGraphModel dx="800" dy="600" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${Math.max(1, Math.round(sc.w))}" pageHeight="${Math.max(1, Math.round(sc.h))}" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        ${cells}
      </root>
    </mxGraphModel>
  </diagram>`;
}

/** 多张场景 → 一个多页 .drawio 文件 */
export function buildDrawio(pages: ScenePage[], title: string): string {
  const body = pages.map((p, i) => pageXml(p.name || `第 ${i + 1} 页`, p.scene, 'page' + (i + 1))).join('\n');
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${stamp}" agent="Carocall Tool Box" version="${DIO_VERSION}" type="device" title="${esc(title)}">
${body}
</mxfile>
`;
}
