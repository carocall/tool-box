/** 通用布局工具：矩形重叠消解、包围盒归一化。 */
import type { Box } from './types';

/** 矩形重叠消解 */
export function resolveOverlaps(boxes: Box[], gap?: number, iters?: number): void {
  gap = gap === undefined ? 26 : gap;
  iters = iters || 400;
  for (let it = 0; it < iters; it++) {
    let moved = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const dx = b.cx - a.cx, dy = b.cy - a.cy;
        const ox = (a.w + b.w) / 2 + gap - Math.abs(dx);
        const oy = (a.h + b.h) / 2 + gap - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (ox < oy) {
            const s = (dx >= 0 ? 1 : -1) * ox / 2;
            a.cx -= s; b.cx += s;
          } else {
            const s = (dy >= 0 ? 1 : -1) * oy / 2;
            a.cy -= s; b.cy += s;
          }
        }
      }
    }
    if (!moved) break;
  }
}

/** 把一组盒子的包围盒归一化到 (marginX, marginY) 起 */
export function normalizeBoxes(boxes: Box[], marginX?: number, marginY?: number): { dx: number; dy: number; w: number; h: number } {
  if (marginX === undefined) marginX = 56;
  if (marginY === undefined) marginY = marginX;
  if (!boxes.length) return { dx: 0, dy: 0, w: 200, h: 200 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.cx - b.w / 2); maxX = Math.max(maxX, b.cx + b.w / 2);
    minY = Math.min(minY, b.cy - b.h / 2); maxY = Math.max(maxY, b.cy + b.h / 2);
  }
  const dx = marginX - minX, dy = marginY - minY;
  for (const b of boxes) { b.cx += dx; b.cy += dy; }
  return { dx: dx, dy: dy, w: maxX - minX + marginX * 2, h: maxY - minY + marginY * 2 };
}
