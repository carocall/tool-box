/** 时序图：生命线 + 激活条 + 请求 / 返回 / 自调用箭头。 */
import { num, tw, uid } from '../base';
import { paintSvg } from '../paint-svg';
import type { SequenceData, Diagram } from '../types';
import type { SceneItem, ScenePage } from '../scene';

export function layoutSequence(json: SequenceData): ScenePage[] {
  const actor = json.actor || '';
  const objects = (json.lifelines || []).map(o => o || '');
  if (!objects.length) throw new Error('时序图至少需要一个生命线（lifelines）');
  const labels = (actor ? [actor] : []).concat(objects);
  const isActorCol = !!actor;

  const fs = 18, msgFs = 17;
  const boxH = 40, boxY = 108;
  const widths = labels.map((t) => Math.max(140, Math.round(tw(t, fs) + 34)));
  const step = Math.max.apply(null, widths) + 34;
  const colX = labels.map((t, i) => 60 + widths[i] / 2 + i * step);

  const msgs = (json.messages || []).filter(m => m && m.text !== undefined);
  const yMsg = [];
  let cy = 208;
  msgs.forEach(m => {
    yMsg.push(cy);
    const self = (num(m.from, 0) === num(m.to, 0));
    cy += self ? 82 : 50;
  });
  const lineBottom = Math.max(cy + 30, 420);
  const W = colX[colX.length - 1] + widths[widths.length - 1] / 2 + 60;
  const H = lineBottom + 40;

  const anchors: SceneItem[] = [];
  const lifelines: SceneItem[] = [];
  const bars: SceneItem[] = [];
  const arrows: SceneItem[] = [];
  const nodes: SceneItem[] = [];
  const labelsSvg: SceneItem[] = [];

  /*
   * 每个参与方下面挂一个不可见锚点，生命线的下端就连它。
   * drawio 里锚点是该参与方的子元素 —— 拖动整列时生命线跟着走，不会留在原地。
   */
  colX.forEach((x, i) => {
    anchors.push({ k: 'anchor', id: 'LEND' + i, x, y: lineBottom, parent: 'P' + i });
  });
  // 生命线（两端都连图形：上端接参与方底边，下端接锚点）
  colX.forEach((x, i) => {
    lifelines.push({
      k: 'line', x1: x, y1: 148, x2: x, y2: lineBottom, sw: 1, dash: '6 4',
      link: ['P' + i, 'LEND' + i], id: 'LL' + i,
      ports: { exit: [0.5, 1], entry: [0.5, 0.5] }
    });
  });
  // 激活条（含最左侧的角色列）；记录每列的条框，供消息计算相对端口
  const barBox: any[] = [];
  for (let i = 0; i < colX.length; i++) {
    let mn = Infinity, mx = -Infinity;
    msgs.forEach((m, k) => {
      if (num(m.from, -1) === i || num(m.to, -1) === i) { mn = Math.min(mn, yMsg[k]); mx = Math.max(mx, yMsg[k]); }
    });
    if (mn !== Infinity) {
      const by = mn - 14, bh = (mx - mn) + 28;
      barBox[i] = { y: by, h: bh };
      bars.push({
        k: 'rect', x: colX[i] - 6, y: by, w: 12, h: bh,
        fill: '#FFFFFF', stroke: '#000000', sw: 1,
        id: 'BAR' + i, parent: 'P' + i          // 挂在参与方下，随列平移
      });
    }
  }
  // 消息
  msgs.forEach((m, k) => {
    const f = Math.max(0, Math.min(labels.length - 1, num(m.from, 0)));
    const t = Math.max(0, Math.min(labels.length - 1, num(m.to, 0)));
    const kind = (m.kind || '').toLowerCase();
    const isReturn = kind === 'return' || kind === 'reply' || kind === 'resp';
    const y = yMsg[k];
    const arrow = isReturn ? 'open' : 'solid';
    const sw = isReturn ? 1.1 : 1.2;
    const dash = isReturn ? '6 4' : undefined;
    const mid = 'M' + k;
    // 消息挂到激活条上，并用相对端口钉死 y —— 否则 drawio 会按图形中心自动选口，消息会跑位
    const rel = (i: number, yy: number) => {
      const b = barBox[i];
      if (!b) return 0.5;
      return Math.max(0, Math.min(1, (yy - b.y) / b.h));
    };

    if (f === t) {
      const x0 = colX[f] + 6;
      arrows.push({
        k: 'path', pts: [[x0, y], [x0 + 48, y], [x0 + 48, y + 26], [x0, y + 26]],
        sw, dash, arrow, id: mid,
        link: ['BAR' + f, 'BAR' + f],
        ports: { exit: [1, rel(f, y)], entry: [1, rel(f, y + 26)] }
      });
      // 自调用：文字放到回路上方（drawio 里边标签默认落在路径中点，会盖住小回路）
      labelsSvg.push({ k: 'label', x: x0 + 56, y: y + 4, text: m.text, fs: msgFs, bg: false, anchor: 'start', owner: mid, ownerX: 0, ownerY: 20 });
    } else {
      const dir = t > f ? 1 : -1;
      const x1 = colX[f] + dir * 6;
      const x2 = colX[t] - dir * 6;
      arrows.push({
        k: 'path', pts: [[x1, y], [x2, y]], sw, dash, arrow, id: mid,
        link: ['BAR' + f, 'BAR' + t],
        ports: {
          exit: [dir > 0 ? 1 : 0, rel(f, y)],
          entry: [dir > 0 ? 0 : 1, rel(t, y)]
        }
      });
      const mx = (x1 + x2) / 2;
      labelsSvg.push({ k: 'label', x: mx, y: y - 13, text: m.text, fs: msgFs, owner: mid, ownerX: 0, ownerY: 12 });
    }
  });

  // 顶部标签（不带冒号）
  colX.forEach((x, i) => {
    nodes.push({ k: 'rect', x: x - widths[i] / 2, y: boxY, w: widths[i], h: boxH, fill: '#FFFFFF', stroke: '#000000', sw: 1, text: labels[i], fs, id: 'P' + i });
  });
  if (isActorCol) {
    nodes.push({ k: 'actor', cx: colX[0], top: 30, scale: 1.0, id: 'ACTOR' });
  }

  return [{
    name: json.title || '时序图',
    scene: { w: W, h: H, items: anchors.concat(lifelines, bars, arrows, nodes, labelsSvg) }
  }];
}

export function renderSequence(json: SequenceData): Diagram[] {
  return layoutSequence(json).map(p => ({
    name: p.name, svg: paintSvg(uid('sq'), p.scene), w: p.scene.w, h: p.scene.h
  }));
}
