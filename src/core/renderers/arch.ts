/**
 * 系统架构图（分层）：一条横带 = 一层，横带左侧写层名，带内一行组件方块，层与层之间用向下箭头连接。
 *
 * 之所以做成"带容器"的结构（组件是横带的子元素）而不是平铺一堆矩形：
 * 1. 视觉上就是论文里常见的分层架构图；
 * 2. drawio 里拖动整层时，层内组件会一起走（`parent`），箭头也两端都连在层带上。
 */
import { tw, uid } from '../base';
import { paintSvg } from '../paint-svg';
import type { ArchitectureData, Diagram } from '../types';
import type { SceneItem, ScenePage } from '../scene';

export function layoutArchitecture(json: ArchitectureData): ScenePage[] {
  const title = json.title || '系统架构图';
  const layers = (json.layers || []).map((l, i) => ({
    name: (l && l.name) || ('第' + (i + 1) + '层'),
    items: (l && l.items ? l.items : []).map(x => String(x)).filter(s => s.trim() !== '')
  }));
  if (!layers.length) throw new Error('系统架构图至少需要一个层次（layers）');

  const fsLayer = 22, fsComp = 18;
  const boxH = 56, padY = 16, padX = 16;
  const gapBox = 24, gapLabel = 14;
  const M = 40;                 // 画布外边距
  const gapBand = 56;           // 层与层之间的间距（放箭头）
  const bandH = boxH + padY * 2;

  // 左侧层名列宽：全图统一，保证各层名字左对齐
  const labelW = Math.max.apply(null, layers.map(l => Math.round(tw(l.name, fsLayer)))) + padX * 2;

  const rows = layers.map(l => {
    const ws = l.items.map(t => Math.max(110, Math.round(tw(t, fsComp) + 40)));
    const sum = ws.reduce((a, b) => a + b, 0) + gapBox * Math.max(0, ws.length - 1);
    return { ws, sum };
  });

  const maxRow = Math.max.apply(null, rows.map(r => r.sum).concat([0]));
  const W = Math.max(labelW + gapLabel + maxRow + padX * 2 + M * 2, 680);

  const items: SceneItem[] = [];
  let y = M;

  layers.forEach((l, li) => {
    const bandId = 'L' + li;
    const bandW = W - M * 2;

    items.push({
      k: 'rect', x: M, y, w: bandW, h: bandH,
      fill: '#FFFFFF', stroke: '#000000', sw: 1.4,
      text: l.name, fs: fsLayer, weight: '700',
      textAlign: 'start', textPad: padX,
      id: bandId
    });

    // 组件：在「层名列右侧 → 右内边距」之间居中
    const { ws, sum } = rows[li];
    const left = M + labelW + gapLabel;
    const right = W - M - padX;
    let cx = left + Math.max(0, (right - left - sum) / 2);
    l.items.forEach((t, ci) => {
      items.push({
        k: 'rect', x: cx, y: y + padY, w: ws[ci], h: boxH,
        fill: '#FFFFFF', stroke: '#000000', sw: 1,
        text: t, fs: fsComp,
        id: 'C' + li + '_' + ci,
        parent: bandId
      });
      cx += ws[ci] + gapBox;
    });

    // 层间箭头（两端连在层带上）
    if (li < layers.length - 1) {
      items.push({
        k: 'path', pts: [[W / 2, y + bandH], [W / 2, y + bandH + gapBand]],
        sw: 1.2, arrow: 'solid',
        link: [bandId, 'L' + (li + 1)],
        ports: { exit: [0.5, 1], entry: [0.5, 0] }
      });
    }

    y += bandH + gapBand;
  });

  const H = y - gapBand + M;
  return [{ name: title, scene: { w: W, h: H, items } }];
}

export function renderArchitecture(json: ArchitectureData): Diagram[] {
  return layoutArchitecture(json).map(p => ({
    name: p.name, svg: paintSvg(uid('ar'), p.scene), w: p.scene.w, h: p.scene.h
  }));
}
