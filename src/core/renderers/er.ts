/** ER 图（分离式）：1 张总 E-R 图 + 每个实体 1 张属性图。 */
import { tw, uid } from '../base';
import { paintSvg } from '../paint-svg';
import { resolveOverlaps, normalizeBoxes } from '../layout';
import type { ERData, Diagram, Box } from '../types';
import type { Scene, SceneItem, ScenePage } from '../scene';

export function erEntitySize(name: string): { w: number; h: number } {
  return { w: Math.max(150, Math.round(tw(name, 24) + 46)), h: 64 };
}
export const ER_REL_SIZE = { w: 150, h: 84 };
export const ER_STY = {
  rect:  { fill: '#FFFFFF', stroke: '#000000', sw: 1 },
  rhom:  { fill: '#FFFFFF', stroke: '#000000', sw: 1 },
  edge:  { sw: 1 },
  nameFs: 24, relFs: 22, cardFs: 20
};

/** 沿某方向从中心走到包围盒边界所需的距离 */
export function boxHitDist(hw: number, hh: number, ux: number, uy: number): number {
  return Math.min(
    Math.abs(ux) > 1e-6 ? hw / Math.abs(ux) : Infinity,
    Math.abs(uy) > 1e-6 ? hh / Math.abs(uy) : Infinity
  );
}
/** 基数标签：落在「实体边框 ↔ 菱形边框」之间的空档中点，沿连线方向 */
export function erCardLabel(ent: any, rb: Box, text: string) {
  const dx = rb.cx - ent.cx, dy = rb.cy - ent.cy;
  const dl = Math.hypot(dx, dy) || 1;
  const ux = dx / dl, uy = dy / dl;
  const tEnt = boxHitDist(ent.w / 2, ent.h / 2, ux, uy);       // 出实体框
  const tDia = Math.max(tEnt, dl - boxHitDist(rb.w / 2, rb.h / 2, ux, uy)); // 到菱形边
  const t = (tEnt + tDia) / 2;
  return { x: ent.cx + ux * t, y: ent.cy + uy * t, text, fs: ER_STY.cardFs };
}

/** 布局过程中的内部节点：w/h/cx/cy 在布局阶段逐步补齐 */
interface ErNode {
  id: string;
  name: string;
  attrs: string[];
  w: number;
  h: number;
  cx: number;
  cy: number;
  _dx?: number;
}
/** 内部的联系记录：a/b 直接引用实体对象，省去反复查表 */
interface ErRel {
  id: string;
  name: string;
  a: ErNode;
  b: ErNode;
  ca: string;
  cb: string;
}

/** 总 E-R 图：只做几何布局，产出场景图 */
export function layoutERTotal(json: ERData): ScenePage {
  const ents: ErNode[] = (json.entities || []).map((e, i) => ({
    id: 'E' + i,
    name: e.name || ('实体' + (i + 1)),
    attrs: e.attributes || [],
    w: 0, h: 0, cx: 0, cy: 0
  }));
  if (!ents.length) throw new Error('ER 图至少需要一个实体（entities）');
  const nameMap = new Map(ents.map(e => [e.name, e]));
  const rels = (json.relations || []).map((r: any, i: number): ErRel | null => {
    const a = nameMap.get(r.from), b = nameMap.get(r.to);
    if (!a || !b) return null;
    return { id: 'R' + i, name: r.name || '关联', a, b, ca: r.fromCard || '1', cb: r.toCard || 'n' };
  }).filter(Boolean) as ErRel[];

  ents.forEach(e => { const s = erEntitySize(e.name); e.w = s.w; e.h = s.h; });

  /* ---- 1. 分层排布：BFS 层号作行，子实体尽量落在父实体正下方（横平竖直） ---- */
  const N = ents.length;
  const adj = new Map(ents.map(e => [e.id, []]));
  const deg = new Map(ents.map(e => [e.id, 0]));
  rels.forEach(r => {
    adj.get(r.a.id).push(r.b); adj.get(r.b.id).push(r.a);
    deg.set(r.a.id, deg.get(r.a.id) + 1); deg.set(r.b.id, deg.get(r.b.id) + 1);
  });

  // 多源 BFS 分层。每个连通分量挑「BFS 树最矮」的实体当根（≈ 图中心），
  // 否则大图会退化成一长条（例：权限←角色←用户角色←用户←员工 一路挂到最底），
  // 画布会又高又空。同高时取度数大的，保证小图（≤8 个实体）的选根与旧版完全一致。
  const level = new Map();
  const compOf = new Map<string, number>();
  let cid = -1;
  ents.forEach(e => {
    if (compOf.has(e.id)) return;
    cid++;
    compOf.set(e.id, cid);
    const q = [e];
    while (q.length) {
      const cur = q.shift();
      adj.get(cur.id).forEach(nb => {
        if (!compOf.has(nb.id)) { compOf.set(nb.id, cid); q.push(nb); }
      });
    }
  });

  const treeHeight = (root) => {
    const seen = new Map([[root.id, 0]]);
    const q = [root];
    let h = 0;
    while (q.length) {
      const cur = q.shift();
      const lv = seen.get(cur.id);
      if (lv > h) h = lv;
      adj.get(cur.id).forEach(nb => {
        if (!seen.has(nb.id)) { seen.set(nb.id, lv + 1); q.push(nb); }
      });
    }
    return h;
  };

  // 每个连通分量选根：先算所有候选的 BFS 树高，**允许比最优多 1 层**，
  // 在这批里取度数最大的。这样小图仍以业务中心实体为根（与旧版逐字符一致），
  // 大图则优先保证不会出现一长条。
  const comps = new Map<number, any[]>();
  ents.forEach(e => {
    const c = compOf.get(e.id);
    if (!comps.has(c)) comps.set(c, []);
    comps.get(c).push(e);
  });

  const bestRoot = new Map();
  comps.forEach((list, c) => {
    const hs = list.map(e => treeHeight(e));
    const minH = Math.min.apply(null, hs);
    let best = list[0], bestDeg = -1;
    list.forEach((e, i) => {
      if (hs[i] > minH + 1) return;
      const d = deg.get(e.id);
      if (d > bestDeg) { best = e; bestDeg = d; }
    });
    bestRoot.set(c, best);
  });

  // 连通分量按实体数从多到少依次排在下方
  const rootOrder = Array.from(bestRoot.keys()).sort((a, b) =>
    (comps.get(b) || []).length - (comps.get(a) || []).length);

  rootOrder.forEach(c => {
    const root = bestRoot.get(c);
    if (level.has(root.id)) return;
    const base = level.size ? Math.max.apply(null, Array.from(level.values())) + 1 : 0;
    level.set(root.id, base);
    const q = [root];
    while (q.length) {
      const cur = q.shift();
      const lv = level.get(cur.id);
      adj.get(cur.id).slice().sort((p, r2) => deg.get(r2.id) - deg.get(p.id) || 0)
        .forEach(nb => { if (!level.has(nb.id)) { level.set(nb.id, lv + 1); q.push(nb); } });
    }
  });

  const maxLevel = Math.max.apply(null, Array.from(level.values()).concat([0]));
  // 同一行相邻实体的间距。菱形固定 150 宽，186 只剩 18px 给基数标签（会压框），
  // 240 时每侧 45px，标签居中后离边框 ~15px，够放「1 / n」。
  const gapX = 260, rowStep = 310;

  // 层内顺序：贪心成链，让同层内有连线的实体相邻，减少同层长连线
  const levelList = [];
  for (let L = 0; L <= maxLevel; L++) {
    const rest = ents.filter(e => level.get(e.id) === L)
      .sort((x, y) => deg.get(y.id) - deg.get(x.id) || 0);
    const out = [];
    while (rest.length) {
      let pick = 0;
      if (out.length) {
        const last = out[out.length - 1];
        const i = rest.findIndex(e => adj.get(last.id).some(x => x.id === e.id));
        if (i >= 0) pick = i;
      }
      out.push(rest.splice(pick, 1)[0]);
    }
    levelList[L] = out;
  }

  const initRow = (L) => {
    let cursor = null;
    levelList[L].forEach(e => {
      const left = cursor === null ? 0 : cursor + gapX;
      e.cx = left + e.w / 2; e.cy = L * rowStep;
      cursor = left + e.w;
    });
  };
  const placeRow = (L, from) => {                 // from=-1 用父层期望，from=+1 用子层期望
    const list = levelList[L].slice();
    list.forEach(e => {
      const ns = adj.get(e.id).filter(p => level.get(p.id) === L + from);
      e._dx = ns.length ? ns.reduce((s, p) => s + p.cx, 0) / ns.length : e.cx;
    });
    list.sort((a, b) => a._dx - b._dx);
    let cursor = null;
    list.forEach(e => {
      let left = e._dx - e.w / 2;
      if (cursor !== null && left < cursor + gapX) left = cursor + gapX;
      e.cx = left + e.w / 2;
      cursor = left + e.w;
    });
  };

  for (let L = 0; L <= maxLevel; L++) initRow(L);
  // 迭代松弛：自顶向下让子跟随父，自底向上让父居中于子（收敛后父实体自然居中）
  for (let it = 0; it < 6; it++) {
    for (let L = 1; L <= maxLevel; L++) placeRow(L, -1);
    for (let L = maxLevel - 1; L >= 0; L--) placeRow(L, +1);
  }

  /* ---- 2. 联系菱形：落在两实体之间，同行/同列时严格对齐成水平/垂直 ---- */
  const relBoxes: Array<Box & { id: string; _r: ErRel }> =
    rels.map(r => ({ id: r.id, w: ER_REL_SIZE.w, h: ER_REL_SIZE.h, cx: 0, cy: 0, _r: r }));
  const placed: Box[] = [];
  const hitsBox = (b, list, gap) => list.some(o =>
    Math.abs(b.cx - o.cx) < (b.w + o.w) / 2 + gap &&
    Math.abs(b.cy - o.cy) < (b.h + o.h) / 2 + gap);

  relBoxes.forEach(rb => {
    const r = rb._r, a = r.a, b = r.b;
    const sameRow = Math.abs(a.cy - b.cy) < 1;
    const sameCol = Math.abs(a.cx - b.cx) < 1;
    const midX = (a.cx + b.cx) / 2, midY = (a.cy + b.cy) / 2;
    const mx = sameRow ? midX : (sameCol ? a.cx : midX);
    const my = sameRow ? a.cy : (sameCol ? midY : midY);
    const dx = b.cx - a.cx, dy = b.cy - a.cy;
    const dl = Math.hypot(dx, dy) || 1;
    const nx = -dy / dl, ny = dx / dl;              // 垂直于连线的方向

    // 候选落点：中点 + 折点（让连线尽量横平竖直）+ 垂直偏移
    const cand: any[] = [{ x: mx, y: my },
      { x: a.cx, y: midY }, { x: b.cx, y: midY },
      { x: midX, y: a.cy }, { x: midX, y: b.cy }];
    const stepLen = ER_REL_SIZE.h + 40;
    for (let k = 1; k <= 2; k++) {
      cand.push({ x: mx + nx * stepLen * k, y: my + ny * stepLen * k });
      cand.push({ x: mx - nx * stepLen * k, y: my - ny * stepLen * k });
      cand.push({ x: a.cx, y: midY + stepLen * k });
      cand.push({ x: b.cx, y: midY - stepLen * k });
    }
    const others = ents.filter(e => e !== a && e !== b);
    const ends = [a, b];
    const boxOf = (c: any): Box => ({ cx: c.x, cy: c.y, w: rb.w, h: rb.h });
    const clearThird = (c: any) => !hitsBox(boxOf(c), others, 16) && !hitsBox(boxOf(c), placed, 18);
    // 备选落点还必须避开两端实体本身（中点允许与端点自然相邻）。
    // 这里留 30px 而不是 10px：留 10px 时「菱形边缘→实体边框」只剩一条 10px 的短线，
    // 基数标签（约 20×22）居中放上去必然压住实体框角落。
    const alts = cand.slice(1).filter(c => clearThird(c) && !hitsBox(boxOf(c), ends, 48));
    let chosen;
    if (clearThird(cand[0])) chosen = cand[0];
    else if (alts.length) {
      alts.forEach(c => { c._cost = Math.hypot(c.x - a.cx, c.y - a.cy) + Math.hypot(c.x - b.cx, c.y - b.cy); });
      alts.sort((p, q) => p._cost - q._cost);
      chosen = alts[0];
    } else chosen = cand[0];
    rb.cx = chosen.x; rb.cy = chosen.y;
    placed.push({ cx: rb.cx, cy: rb.cy, w: rb.w, h: rb.h });
  });
  resolveOverlaps(relBoxes, 18, 140);              // 菱形之间轻微去重（安全网）

  const allBoxes: Box[] = (ents as Box[]).concat(relBoxes);
  const nb = normalizeBoxes(allBoxes, 60);

  /* ---- 3. 组装场景图：连线 → 白底图形 → 标注（顺序即绘制顺序，不能改） ---- */
  const items: SceneItem[] = [];
  rels.forEach(r => {
    const rb = relBoxes.find(b => b.id === r.id);
    const a = r.a, b = r.b;
    items.push({ k: 'line', x1: a.cx, y1: a.cy, x2: rb.cx, y2: rb.cy, ...ER_STY.edge, link: [a.id, rb.id], id: a.id + '_' + rb.id });
    items.push({ k: 'line', x1: rb.cx, y1: rb.cy, x2: b.cx, y2: b.cy, ...ER_STY.edge, link: [rb.id, b.id], id: rb.id + '_' + b.id });
  });
  relBoxes.forEach(rb => {
    items.push({
      k: 'diamond', cx: rb.cx, cy: rb.cy, w: rb.w, h: rb.h, ...ER_STY.rhom,
      text: rb._r.name, fs: ER_STY.relFs, weight: 'normal', id: rb.id
    });
  });
  ents.forEach(e => {
    items.push({ k: 'rect', x: e.cx - e.w / 2, y: e.cy - e.h / 2, w: e.w, h: e.h, ...ER_STY.rect, text: e.name, fs: ER_STY.nameFs, id: e.id });
  });
  // 基数标签挂到对应的那条边上（drawio 里会成为 edge label，跟着线走）
  rels.forEach(r => {
    const rb = relBoxes.find(b => b.id === r.id);
    items.push({ k: 'label', ...erCardLabel(r.a, rb, r.ca), owner: r.a.id + '_' + rb.id, ownerX: 0, ownerY: 0 });
    items.push({ k: 'label', ...erCardLabel(r.b, rb, r.cb), owner: rb.id + '_' + r.b.id, ownerX: 0, ownerY: 0 });
  });

  return {
    name: (json.title ? json.title + ' · ' : '') + '总 E-R 图',
    scene: { w: nb.w, h: nb.h, items }
  };
}

/** 单实体属性图（扇形） */
export function layoutERAttr(entity: any): ScenePage {
  const name = entity.name;
  const attrs = (entity.attrs || []).filter(a => String(a).trim() !== '');
  const es = { w: Math.max(170, Math.round(tw(name, 22) + 66)), h: 70 };
  const fsAttr = 20, fsEnt = 22;
  const items0 = attrs.map(a => {
    const t = String(a);
    return { text: t, w: Math.max(120, Math.round(tw(t, fsAttr) + 44)), h: 60 };
  });

  const cx = 0;                 // 临时坐标系，最后统一平移
  const entTop = -(es.h);       // 实体上边（相对圆心）
  const n = items0.length;
  const span = 132, a0 = 156;
  let R = 165;

  if (n === 1) {
    R = Math.max(165, items0[0].w * 0.9);
    items0[0].ax = cx; items0[0].ay = entTop - R;
  } else if (n > 1) {
    const dTheta = span / (n - 1);
    const dRad = dTheta * Math.PI / 180;
    for (let i = 0; i < n - 1; i++) {
      const need = ((items0[i].w + items0[i + 1].w) / 2 + 16) / dRad;
      R = Math.max(R, need);
    }
    R = Math.min(R, 900);
    items0.forEach((it, i) => {
      const th = (a0 - i * dTheta) * Math.PI / 180;
      it.ax = cx + R * Math.cos(th);
      it.ay = entTop - R * Math.sin(th);
    });
  }

  // 计算包围盒
  let minX = cx - es.w / 2, maxX = cx + es.w / 2, minY = entTop, maxY = entTop + es.h;
  items0.forEach(it => {
    minX = Math.min(minX, it.ax - it.w / 2); maxX = Math.max(maxX, it.ax + it.w / 2);
    minY = Math.min(minY, it.ay - it.h / 2); maxY = Math.max(maxY, it.ay + it.h / 2);
  });
  const M = 34;
  const dx = M - minX, dy = M - minY;
  const W = (maxX - minX) + M * 2, H = (maxY - minY) + M * 2;

  const entCx = cx + dx, entCy = entTop + es.h / 2 + dy;
  const items: SceneItem[] = [];
  items0.forEach((it, i) => {
    const ax = it.ax + dx, ay = it.ay + dy;
    items.push({ k: 'line', x1: entCx, y1: entCy, x2: ax, y2: ay, ...ER_STY.edge, link: ['ENT', 'A' + i] });
  });
  items0.forEach((it, i) => {
    const ax = it.ax + dx, ay = it.ay + dy;
    items.push({ k: 'ellipse', cx: ax, cy: ay, rx: it.w / 2, ry: it.h / 2, fill: '#FFFFFF', stroke: '#000000', sw: 1, text: it.text, fs: fsAttr, id: 'A' + i });
  });
  items.push({ k: 'rect', x: entCx - es.w / 2, y: entCy - es.h / 2, w: es.w, h: es.h, ...ER_STY.rect, text: name, fs: fsEnt, id: 'ENT' });

  return { name: name + '实体属性图', scene: { w: W, h: H, items } };
}

/** 只算场景（drawio 导出用） */
export function layoutER(json: ERData): ScenePage[] {
  const out: ScenePage[] = [layoutERTotal(json)];
  const ents = (json.entities || []).map((e, i) => ({
    name: e.name || ('实体' + (i + 1)),
    attrs: e.attributes || []
  }));
  ents.forEach(e => out.push(layoutERAttr(e)));
  return out;
}

export function renderER(json: ERData): Diagram[] {
  const pages: ScenePage[] = layoutER(json);
  return pages.map((p, i) => {
    const sc: Scene = p.scene;
    return { name: p.name, svg: paintSvg(uid(i === 0 ? 'er' : 'era'), sc), w: sc.w, h: sc.h };
  });
}
