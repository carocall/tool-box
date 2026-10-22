/**
 * 核心自检：不需要浏览器、不需要基线文件，直接跑 src/core。
 *
 * 以前的 tools/compare.mjs 是「新核心 vs 冻结基线」逐字符对比；基线删掉之后，
 * 这里改成**结构性断言**，专门盯那些"改布局最容易踩坏"的东西：
 *   1. 6 种图 + 边界数据都能渲染，不抛错、不出 NaN；
 *   2. 张数符合约定（ER = 实体数 + 1，其余 1 张）；
 *   3. ER 基数标签不压实体框（2026-10 就是因为这个才把 gapX 从 186 调到 260）；
 *   4. 流程图节点不出画布、drawio 里每条边都连在图形上。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = 'D:/Project/MyProject/image_tool';

fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
execSync('npx esbuild src/core/index.ts --bundle --format=esm --outfile=tmp/core.mjs --log-level=warning', {
  cwd: ROOT, stdio: 'inherit', shell: true
});

const { SAMPLES, render, layoutFlow, buildDrawio, LAYOUTS } = await import(
  pathToFileURL(path.join(ROOT, 'tmp/core.mjs')).href
);

let pass = 0, fail = 0;
const chk = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
};

/* ---------------- 1. 六种图的默认样例 ---------------- */
console.log('\n[1] 默认样例');
for (const [type, data] of Object.entries(SAMPLES)) {
  let out;
  try { out = render(type, data); } catch (e) { chk(`${type} 渲染`, false, String(e.message)); continue; }
  const dirty = out.filter(d => /\bNaN\b|\bundefined\b/.test(d.svg));
  chk(`${type.padEnd(10)} ${out.length} 张，坐标无 NaN`, out.length >= 1 && dirty.length === 0, {
    pages: out.length, dirty: dirty.length
  });
  if (type === 'er') {
    chk('ER 张数 = 实体数 + 1', out.length === (data.entities || []).length + 1, out.length);
  } else {
    chk(`${type.padEnd(10)} 只有 1 张`, out.length === 1, out.length);
  }
}

/* ---------------- 2. 边界数据 ---------------- */
console.log('\n[2] 边界数据');
const EDGES = [
  ['er 单实体', 'er', { title: 'T', entities: [{ name: '甲', attributes: ['a', 'b'] }], relations: [] }],
  ['er 无属性', 'er', { title: 'T', entities: [{ name: '甲', attributes: [] }, { name: '乙', attributes: [] }], relations: [{ name: '有', from: '甲', to: '乙', fromCard: '1', toCard: 'n' }] }],
  ['sequence 自调用', 'sequence', { title: 'T', actor: 'A', lifelines: ['B'], messages: [{ from: 1, to: 1, text: '1.自处理', kind: 'self' }, { from: 0, to: 1, text: '2.请求', kind: 'request' }] }],
  ['functional 西文模块', 'functional', { title: '系统', roles: [{ name: '管理员', modules: ['Redis缓存', 'SQL审计', '用户管理'] }] }],
  ['flow 单节点', 'flow', { title: 'T', nodes: [{ id: 'n1', text: '开始', shape: 'start', col: 1, row: 1 }], edges: [] }],
  ['flow 引用不存在', 'flow', { title: 'T', nodes: [{ id: 'n1', text: '开始', shape: 'start', col: 1, row: 1 }], edges: [{ from: 'n1', to: 'n9' }] }]
];
for (const [name, type, data] of EDGES) {
  try {
    const out = render(type, data);
    chk(`${name}`, out.length >= 1 && !/\bNaN\b/.test(out.map(d => d.svg).join('')), out.length);
  } catch (e) { chk(`${name}`, false, String(e.message)); }
}

/* ---------------- 3. ER 基数标签不压实体框 ---------------- */
console.log('\n[3] 几何护栏');
{
  const er = render('er', SAMPLES.er)[0];
  const sceneEr = LAYOUTS.er(SAMPLES.er)[0].scene;
  const rects = sceneEr.items.filter(i => i.k === 'rect');
  const cards = sceneEr.items.filter(i => i.k === 'label');
  // 与 core/base.ts 的 tw 保持一致（CJK = fs，其余 0.56fs，空格 0.3fs）
  const tw = (t, fs) => [...String(t)].reduce(
    (s, ch) => s + (/\s/.test(ch) ? fs * 0.3 : /[\u4e00-\u9fa5]/.test(ch) ? fs : fs * 0.56), 0);
  let worst = Infinity, who = '';
  for (const l of cards) {
    const lw = tw(l.text, l.fs) + 10, lh = l.fs + 8;
    for (const r of rects) {
      const dx = Math.max(r.x - (l.x + lw / 2), (l.x - lw / 2) - (r.x + r.w), 0);
      const dy = Math.max(r.y - (l.y + lh / 2), (l.y - lh / 2) - (r.y + r.h), 0);
      const d = (dx === 0 && dy === 0) ? -1 : Math.hypot(dx, dy);
      if (d < worst) { worst = d; who = `"${l.text}" vs "${r.text}"`; }
    }
  }
  chk(`ER 基数标签离实体框 ≥8px（实际 ${Math.round(worst)}px，${who}）`, worst >= 8, Math.round(worst));
  chk('ER 总图有内容', er.w > 0 && er.h > 0);
}

/* ---------------- 4. 流程图：节点不出画布 ---------------- */
console.log('\n[4] 流程图');
{
  const p = layoutFlow(SAMPLES.flow)[0].scene;
  const boxes = p.items.filter(i => i.k === 'rect' || i.k === 'diamond' || i.k === 'polygon');
  let outside = 0;
  for (const b of boxes) {
    const bb = b.k === 'rect' ? { x: b.x, y: b.y, w: b.w, h: b.h }
      : b.k === 'diamond' ? { x: b.cx - b.w / 2, y: b.cy - b.h / 2, w: b.w, h: b.h }
      : (() => { const xs = b.pts.map(q => q[0]), ys = b.pts.map(q => q[1]);
          return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; })();
    if (bb.x < 0 || bb.y < 0 || bb.x + bb.w > p.w + 1 || bb.y + bb.h > p.h + 1) outside++;
  }
  chk(`${boxes.length} 个节点全在画布内`, outside === 0, { outside });
  chk('连线数 = 数据里的 edges 数', p.items.filter(i => i.k === 'path').length === SAMPLES.flow.edges.length);
}

/* ---------------- 5. drawio：每条边两端都连在图形上 ---------------- */
console.log('\n[5] drawio 导出');
{
  const xml = buildDrawio([{ name: 'T', scene: layoutFlow(SAMPLES.flow)[0].scene }], 'T');
  const cells = [...xml.matchAll(/<mxCell ([^>]*)>/g)].map(m => m[1]);
  const edges = cells.filter(c => /edge="1"/.test(c));
  const floating = edges.filter(c => !/\bsource="/.test(c) || !/\btarget="/.test(c));
  const ids = new Set(cells.map(c => (c.match(/id="([^"]+)"/) || [])[1]));
  const badRef = edges.flatMap(c => [...c.matchAll(/\b(?:source|target)="([^"]+)"/g)].map(m => m[1]))
    .filter(id => !ids.has(id));
  chk(`${edges.length} 条边都有 source + target`, floating.length === 0, floating.length);
  chk('source / target 指向存在的单元格', badRef.length === 0, badRef.slice(0, 3));
  chk('value 里没有裸 `<`', !/<mxCell [^>]*value="[^"]*<[^&]/.test(xml));
}

console.log(`\n===== ${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
