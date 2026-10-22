/** SVG 图元构造：全部返回字符串，不碰 DOM。 */
import { esc, tw, FONT, SVGNS } from './base';
import type { SvgTextOpts, ShapeOpts, LineOpts } from './types';

export function attrStr(o: Record<string, unknown>): string {
  let s = '';
  for (const k in o) if (o[k] !== undefined && o[k] !== null) s += ` ${k}="${esc(o[k])}"`;
  return s;
}
export function svgText(x: number, y: number, text: unknown, o?: SvgTextOpts): string {
  o = o || {};
  const fs = o.fs || 16;
  const a = {
    x: r2(x), y: r2(y), 'font-size': fs, fill: o.fill || '#000000',
    'text-anchor': o.anchor || 'middle', 'dominant-baseline': 'central',
    'font-weight': o.weight || 'normal',
    'font-family': o.family || FONT,
    'letter-spacing': o.ls || undefined
  };
  let tr = '';
  if (o.rotate) tr = ` transform="rotate(${o.rotate} ${r2(x)} ${r2(y)})"`;
  return `<text${attrStr(a)}${tr}>${esc(text)}</text>`;
}
/** 多行文本（\n 或 <br>） */
export function svgTextML(cx: number, cy: number, text: unknown, fs: number, o?: SvgTextOpts): string {
  o = o || {};
  const lines = String(text == null ? '' : text).split(/\r?\n|<br\s*\/?>/i);
  const lh = o.lh || fs * 1.28;
  const y0 = cy - (lines.length - 1) * lh / 2;
  return lines.map((ln, i) => svgText(cx, y0 + i * lh, ln, Object.assign({}, o, { fs: fs }))).join('');
}

export function svgRect(x: number, y: number, w: number, h: number, o?: ShapeOpts): string {
  o = o || {};
  return `<rect${attrStr({
    x: r2(x), y: r2(y), width: r2(w), height: r2(h),
    fill: o.fill || '#FFFFFF', stroke: o.stroke === undefined ? '#000000' : o.stroke,
    'stroke-width': o.sw === undefined ? 1 : o.sw,
    rx: o.rx || undefined, ry: o.ry || undefined,
    'stroke-dasharray': o.dash || undefined
  })} />`;
}
export function svgEllipse(cx: number, cy: number, rx: number, ry: number, o?: ShapeOpts): string {
  o = o || {};
  return `<ellipse${attrStr({
    cx: r2(cx), cy: r2(cy), rx: r2(rx), ry: r2(ry),
    fill: o.fill || '#FFFFFF', stroke: o.stroke === undefined ? '#000000' : o.stroke,
    'stroke-width': o.sw === undefined ? 1 : o.sw
  })} />`;
}
export function svgPoly(points: number[][], o?: ShapeOpts): string {
  o = o || {};
  const p = points.map(pt => r2(pt[0]) + ',' + r2(pt[1])).join(' ');
  return `<polygon${attrStr({
    points: p, fill: o.fill || '#FFFFFF',
    stroke: o.stroke === undefined ? '#000000' : o.stroke,
    'stroke-width': o.sw === undefined ? 1 : o.sw
  })} />`;
}
export function svgLine(x1: number, y1: number, x2: number, y2: number, o?: LineOpts): string {
  o = o || {};
  return `<line${attrStr({
    x1: r2(x1), y1: r2(y1), x2: r2(x2), y2: r2(y2),
    stroke: o.stroke || '#000000', 'stroke-width': o.sw === undefined ? 1 : o.sw,
    'stroke-dasharray': o.dash || undefined, 'stroke-linecap': 'round'
  })} />`;
}
export function svgPath(d: string, o?: LineOpts): string {
  o = o || {};
  return `<path${attrStr({
    d: d, fill: 'none', stroke: o.stroke || '#000000',
    'stroke-width': o.sw === undefined ? 1 : o.sw,
    'stroke-dasharray': o.dash || undefined,
    'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    'marker-end': o.marker || undefined
  })} />`;
}
export function r2(n: number): number { return Math.round(n * 100) / 100; }

/** 箭头 marker 定义 */
export function defsMarkers(pid: string): string {
  return `<defs>
    <marker id="${pid}-arrowSolid" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#000000"/>
    </marker>
    <marker id="${pid}-arrowOpen" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10" fill="none" stroke="#000000" stroke-width="1.6"/>
    </marker>
  </defs>`;
}
/** UML 火柴人 */
export function umlActor(cx: number, top: number, scale?: number): string {
  const s = scale || 1;
  const g = [];
  g.push(`<circle${attrStr({ cx: r2(cx), cy: r2(top + 9 * s), r: r2(8 * s), fill: '#FFFFFF', stroke: '#000000', 'stroke-width': 1.4 })} />`);
  g.push(svgLine(cx, top + 17 * s, cx, top + 38 * s, { sw: 1.4 }));
  g.push(svgLine(cx - 13 * s, top + 24 * s, cx + 13 * s, top + 24 * s, { sw: 1.4 }));
  g.push(svgLine(cx, top + 38 * s, cx - 11 * s, top + 58 * s, { sw: 1.4 }));
  g.push(svgLine(cx, top + 38 * s, cx + 11 * s, top + 58 * s, { sw: 1.4 }));
  return g.join('');
}
/** 带白底标签 */
export function labelBox(x: number, y: number, text: string, fs: number): string {
  const w = tw(text, fs) + 10, h = fs + 8;
  return svgRect(x - w / 2, y - h / 2, w, h, { fill: '#FFFFFF', stroke: 'none' }) +
         svgText(x, y, text, { fs: fs });
}
/** 折线路径字符串 */
export function polyPath(pts: number[][]): string {
  return pts.map((p, i) => (i ? 'L' : 'M') + r2(p[0]) + ' ' + r2(p[1])).join(' ');
}

export function svgDoc(pid: string, inner: string, w: number, h: number): string {
  return `<svg xmlns="${SVGNS}" width="${r2(w)}" height="${r2(h)}" viewBox="0 0 ${r2(w)} ${r2(h)}" font-family="${FONT}">
${defsMarkers(pid)}
<rect x="0" y="0" width="${r2(w)}" height="${r2(h)}" fill="#FFFFFF"/>
${inner}
</svg>`;
}
