/**
 * 场景图 → SVG 字符串。
 *
 * 每种场景元素的绘制顺序必须与改造前逐字符一致（回归靠 tools/compare.mjs 逐字符对比），
 * 所以这里刻意复用 core/svg.ts 里原有的图元函数，不做任何"优化"。
 */
import { svgRect, svgEllipse, svgPoly, svgLine, svgPath, svgText, svgTextML, labelBox, umlActor, polyPath, svgDoc } from './svg';
import { svgTextVertical, vTextHeight } from './vertical';
import type { Scene, SceneItem } from './scene';

function paintItem(it: SceneItem, pid: string): string {
  switch (it.k) {
    case 'rect': {
      let s = svgRect(it.x, it.y, it.w, it.h, {
        fill: it.fill, stroke: it.stroke, sw: it.sw, rx: it.rx, ry: it.ry, dash: it.dash
      });
      if (it.vtext !== undefined) {
        const fs = it.fs ?? 24;
        s += svgTextVertical(it.x + it.w / 2, it.y + (it.h - vTextHeight(it.vtext, fs)) / 2, it.vtext, fs);
      } else if (it.text !== undefined) {
        if (it.textAlign === 'start') {
          s += svgText(it.x + (it.textPad ?? 12), it.y + it.h / 2, it.text, {
            fs: it.fs ?? 16, anchor: 'start', weight: it.weight
          });
        } else {
          s += svgTextML(it.x + it.w / 2, it.y + it.h / 2, it.text, it.fs ?? 16, { weight: it.weight });
        }
      }
      return s;
    }
    case 'ellipse': {
      let s = svgEllipse(it.cx, it.cy, it.rx, it.ry, { fill: it.fill, stroke: it.stroke, sw: it.sw });
      if (it.text !== undefined) s += svgTextML(it.cx, it.cy, it.text, it.fs ?? 16);
      return s;
    }
    case 'diamond': {
      // 菱形四点的顺序与 ER 渲染器历史输出保持一致（上 → 右 → 下 → 左）
      const y = it.cy - it.h / 2;
      let s = svgPoly(
        [[it.cx, y], [it.cx + it.w / 2, it.cy], [it.cx, y + it.h], [it.cx - it.w / 2, it.cy]],
        { fill: it.fill, stroke: it.stroke, sw: it.sw }
      );
      if (it.text !== undefined) s += svgTextML(it.cx, it.cy, it.text, it.fs ?? 22, { weight: it.weight ?? 'normal' });
      return s;
    }
    case 'polygon': {
      let s = svgPoly(it.pts, { fill: it.fill, stroke: it.stroke, sw: it.sw });
      if (it.text !== undefined) {
        const xs = it.pts.map(p => p[0]), ys = it.pts.map(p => p[1]);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        s += svgTextML(cx, cy, it.text, it.fs ?? 16);
      }
      return s;
    }
    case 'line':
      return svgLine(it.x1, it.y1, it.x2, it.y2, { sw: it.sw, stroke: it.stroke, dash: it.dash });
    case 'path':
      return svgPath(polyPath(it.pts), {
        sw: it.sw, stroke: it.stroke, dash: it.dash,
        marker: it.arrow === 'solid' ? `url(#${pid}-arrowSolid)`
          : it.arrow === 'open' ? `url(#${pid}-arrowOpen)` : undefined
      });
    case 'text':
      return svgText(it.x, it.y, it.text, { fs: it.fs, anchor: it.anchor, weight: it.weight, rotate: it.rotate });
    case 'label':
      if (it.bg === false) return svgText(it.x, it.y, it.text, { fs: it.fs, anchor: it.anchor ?? 'middle' });
      return labelBox(it.x, it.y, it.text, it.fs);
    case 'actor': {
      let s = umlActor(it.cx, it.top, it.scale);
      if (it.label !== undefined) {
        s += svgText(it.cx, it.labelY, it.label, { fs: it.labelFs ?? 17, weight: it.labelWeight });
      }
      return s;
    }
    default:
      return '';
  }
}

/** 场景图 → 完整 <svg> 文档 */
export function paintSvg(pid: string, sc: Scene): string {
  let inner = '';
  for (const it of sc.items) inner += paintItem(it, pid);
  return svgDoc(pid, inner, sc.w, sc.h);
}
