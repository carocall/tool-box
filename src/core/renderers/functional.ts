/** 功能模块图：系统名 → 角色 → 竖排模块方块。 */
import { tw, uid } from '../base';
import { paintSvg } from '../paint-svg';
import { vTextHeight } from '../vertical';
import type { FunctionalData, Diagram } from '../types';
import type { SceneItem, ScenePage } from '../scene';

export function layoutFunctional(json: FunctionalData): ScenePage[] {
  const title = json.title || '系统';
  const roles = (json.roles || []).map((r, i) => ({
    name: r.name || ('角色' + (i + 1)),
    modules: r.modules || []
  })).filter(r => r.name);
  if (!roles.length) throw new Error('功能模块图至少需要一个角色（roles）');

  const fsTitle = 20, fsRole = 24, fsMod = 24;
  const titleW = Math.max(460, Math.round(tw(title, fsTitle) + 90));
  const titleH = 60;
  const roleH = 40, boxW = 40, gapMod = 20;

  // 每个角色的模块组宽度（模块框内文字竖排，高度按竖排所需长度计算）
  const groups = roles.map(r => {
    const ms = r.modules.map(m => String(m));
    let needH = 0;
    ms.forEach(m => { needH = Math.max(needH, vTextHeight(m, fsMod)); });
    const modH = Math.max(200, Math.round(needH + 30));
    const gw = ms.length ? ms.length * boxW + (ms.length - 1) * gapMod : boxW;
    const rw = Math.max(100, Math.round(tw(r.name, fsRole) + 50));
    return { r: r, ms: ms, gw: gw, rw: rw, modH: modH };
  });
  // 全局模块框统一高度
  const modH = Math.max.apply(null, groups.map(g => g.modH).concat([200]));

  const gapRole = 150;
  const rowWidth = (list: typeof groups) =>
    list.reduce((s, g) => s + Math.max(g.rw, g.gw), 0) + gapRole * Math.max(0, list.length - 1);

  const edges: SceneItem[] = [];
  const nodes: SceneItem[] = [];

  /* ------------------------------------------------------------------ *
   * 默认布局：系统在最上方，角色一行，模块一行在角色下方
   * ------------------------------------------------------------------ */
  if (json.layout !== 'split' || groups.length < 2) {
    const totalW = rowWidth(groups);
    const W = Math.max(totalW + 120, titleW + 120);
    let cursor = (W - totalW) / 2;
    const yTitle = 40, yRole = 150, yMod = 232;
    const titleCx = W / 2;

    nodes.push({ k: 'rect', x: titleCx - titleW / 2, y: yTitle, w: titleW, h: titleH, fill: '#FFFFFF', stroke: '#000000', sw: 1, text: title, fs: fsTitle, weight: '700', id: 'TITLE' });

    const busY = 124;
    groups.forEach((g, gi) => {
      const slotW = Math.max(g.rw, g.gw);
      const slotCx = cursor + slotW / 2;
      const roleCx = slotCx;
      const roleId = 'ROLE' + gi;
      // 标题 → 角色（正交折线）：drawio 里是**一条**带折点的边，两端都挂在图形上
      edges.push({
        k: 'path', pts: [[titleCx, yTitle + titleH], [titleCx, busY], [roleCx, busY], [roleCx, yRole]],
        sw: 1, link: ['TITLE', roleId], id: 'E_T_' + roleId, route: 'ortho' as const,
        ports: { exit: [0.5, 1], entry: [0.5, 0] }
      });
      // 角色框
      nodes.push({ k: 'rect', x: roleCx - g.rw / 2, y: yRole, w: g.rw, h: roleH, fill: '#FFFFFF', stroke: '#000000', sw: 1, text: g.r.name, fs: fsRole, id: roleId });
      // 模块
      const mStartX = slotCx - g.gw / 2;
      const modBusY = yMod - 18;
      g.ms.forEach((m, mi) => {
        const mx = mStartX + mi * (boxW + gapMod) + boxW / 2;
        const modId = 'MOD' + gi + '_' + mi;
        edges.push({
          k: 'path', pts: [[roleCx, yRole + roleH], [roleCx, modBusY], [mx, modBusY], [mx, yMod]],
          sw: 1, link: [roleId, modId], id: 'E_' + modId, route: 'ortho' as const,
          ports: { exit: [0.5, 1], entry: [0.5, 0] }
        });
        nodes.push({ k: 'rect', x: mx - boxW / 2, y: yMod, w: boxW, h: modH, fill: '#FFFFFF', stroke: '#000000', sw: 1, vtext: m, fs: fsMod, id: modId });
      });
      cursor += slotW + gapRole;
    });

    const H = yMod + modH + 60;
    return [{ name: title + '功能模块图', scene: { w: W, h: H, items: edges.concat(nodes) } }];
  }

  /* ------------------------------------------------------------------ *
   * 上下布局：角色对半分列系统上下，上半部分的模块挂在角色**上方**
   * 垂直顺序：模块 → 角色 → 系统 → 角色 → 模块
   * ------------------------------------------------------------------ */
  const M = 40;
  const topModY = M;
  const topRoleY = topModY + modH + 46;
  const sysY = topRoleY + roleH + 70;
  const botRoleY = sysY + titleH + 70;
  const botModY = botRoleY + roleH + 46;
  const H = botModY + modH + M;

  const topN = Math.ceil(groups.length / 2);
  const pairs = groups.map((g, gi) => ({ g, gi }));
  const topRows = pairs.slice(0, topN);
  const botRows = pairs.slice(topN);

  const W = Math.max(
    rowWidth(topRows.map(p => p.g)) + 120,
    rowWidth(botRows.map(p => p.g)) + 120,
    titleW + 120
  );
  const titleCx = W / 2;

  nodes.push({ k: 'rect', x: titleCx - titleW / 2, y: sysY, w: titleW, h: titleH, fill: '#FFFFFF', stroke: '#000000', sw: 1, text: title, fs: fsTitle, weight: '700', id: 'TITLE' });

  const sysBusTop = sysY - 30;              // 系统 → 上排角色 的横线
  const sysBusBot = sysY + titleH + 30;     // 系统 → 下排角色 的横线

  /** up=true：模块在角色上方（连线向上）；false：模块在角色下方 */
  const placeRow = (list: typeof pairs, roleY: number, modY: number, up: boolean) => {
    const total = rowWidth(list.map(p => p.g));
    let cursor = (W - total) / 2;
    const modBusY = up ? roleY - 20 : roleY + roleH + 20;
    const sysBusY = up ? sysBusTop : sysBusBot;

    list.forEach(({ g, gi }) => {
      const slotW = Math.max(g.rw, g.gw);
      const slotCx = cursor + slotW / 2;
      const roleCx = slotCx;
      const roleId = 'ROLE' + gi;

      // 系统 → 角色
      edges.push({
        k: 'path',
        pts: up
          ? [[titleCx, sysY], [titleCx, sysBusY], [roleCx, sysBusY], [roleCx, roleY + roleH]]
          : [[titleCx, sysY + titleH], [titleCx, sysBusY], [roleCx, sysBusY], [roleCx, roleY]],
        sw: 1, link: ['TITLE', roleId], id: 'E_T_' + roleId, route: 'ortho' as const,
        ports: up ? { exit: [0.5, 0], entry: [0.5, 1] } : { exit: [0.5, 1], entry: [0.5, 0] }
      });

      nodes.push({ k: 'rect', x: roleCx - g.rw / 2, y: roleY, w: g.rw, h: roleH, fill: '#FFFFFF', stroke: '#000000', sw: 1, text: g.r.name, fs: fsRole, id: roleId });

      const mStartX = slotCx - g.gw / 2;
      g.ms.forEach((m, mi) => {
        const mx = mStartX + mi * (boxW + gapMod) + boxW / 2;
        const modId = 'MOD' + gi + '_' + mi;
        edges.push({
          k: 'path',
          pts: up
            ? [[roleCx, roleY], [roleCx, modBusY], [mx, modBusY], [mx, modY + modH]]
            : [[roleCx, roleY + roleH], [roleCx, modBusY], [mx, modBusY], [mx, modY]],
          sw: 1, link: [roleId, modId], id: 'E_' + modId, route: 'ortho' as const,
          ports: up ? { exit: [0.5, 0], entry: [0.5, 1] } : { exit: [0.5, 1], entry: [0.5, 0] }
        });
        nodes.push({ k: 'rect', x: mx - boxW / 2, y: modY, w: boxW, h: modH, fill: '#FFFFFF', stroke: '#000000', sw: 1, vtext: m, fs: fsMod, id: modId });
      });

      cursor += slotW + gapRole;
    });
  };

  placeRow(topRows, topRoleY, topModY, true);
  placeRow(botRows, botRoleY, botModY, false);

  return [{ name: title + '功能模块图', scene: { w: W, h: H, items: edges.concat(nodes) } }];
}

export function renderFunctional(json: FunctionalData): Diagram[] {
  return layoutFunctional(json).map(p => ({
    name: p.name, svg: paintSvg(uid('fm'), p.scene), w: p.scene.w, h: p.scene.h
  }));
}
