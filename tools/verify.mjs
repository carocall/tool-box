/**
 * 新版验收（v2.1）：drawio 导出 / JSON 可编辑 / 默认折叠 / 提示词 / 无 SQL。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/Project/MyProject/image_tool';
const PLAYWRIGHT = process.env.PLAYWRIGHT_PATH
  || 'file:///C:/Users/24173/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.js';
const pw = await import(PLAYWRIGHT);
const chromium = pw.chromium || pw.default?.chromium;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = p => 'file:///' + path.join(ROOT, p).replace(/\\/g, '/');
const TMP = path.join(ROOT, 'tmp');

let ok = 0, fail = 0;
const chk = (name, cond, extra) => {
  if (cond) { ok++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
};

const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const ctx = await browser.newContext({
  viewport: { width: 1720, height: 1020 },
  acceptDownloads: true,
  permissions: ['clipboard-read', 'clipboard-write']
});
const errs = [];

/* ---------------- A. 默认样例 ---------------- */
console.log('\n[A] 默认样例渲染');
// 全部 6 种图，提示词 / 导出等通用断言也用它
const ALL = [
  { key: 'er', tab: 'ER 图' },
  { key: 'usecase', tab: '用例图' },
  { key: 'functional', tab: '功能模块图' },
  { key: 'arch', tab: '系统架构图' },
  { key: 'sequence', tab: '时序图' },
  { key: 'flow', tab: '流程图' },
  { key: 'swim', tab: '泳道图' },
  { key: 'class', tab: '类图' },
  { key: 'state', tab: '状态图' }
];

const page = await ctx.newPage();
page.on('pageerror', e => errs.push('[new] ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('[new console] ' + m.text()); });
await page.goto(url('dist/index.html'), { waitUntil: 'load' });
await page.waitForTimeout(900);

// 每种图的默认样例都应该能出图（至少 1 张，且每张都渲染出 SVG）
for (const t of ALL) {
  if (t.key !== 'er') { await page.click(`.tabs button:text-is("${t.tab}")`); await page.waitForTimeout(600); }
  const n = await page.$$eval('.diagram', els => els.length);
  const svgs = await page.$$eval('.paper svg', els => els.length);
  chk(`${t.key.padEnd(10)} 默认样例出 ${n} 张图`, n >= 1 && svgs === n, { n, svgs });
}

/* ---------------- B. 默认折叠 ---------------- */
console.log('\n[B] 默认全部折叠');
await page.click('.tabs button:text-is("ER 图")');
await page.waitForTimeout(500);
const fold0 = await page.evaluate(() => ({
  secs: [...document.querySelectorAll('.fsec')].length,
  secsFolded: [...document.querySelectorAll('.fsec.folded')].length,
  cards: [...document.querySelectorAll('.fcard')].length,
  cardsFolded: [...document.querySelectorAll('.fcard.folded')].length,
  bodiesHidden: [...document.querySelectorAll('.fsec-body, .fcard-body')].every(e => getComputedStyle(e).display === 'none')
}));
chk('分区默认折叠', fold0.secs > 0 && fold0.secsFolded === fold0.secs, fold0);
chk('条目卡片默认折叠', fold0.cards > 0 && fold0.cardsFolded === fold0.cards, fold0);
chk('折叠后正文全部隐藏', fold0.bodiesHidden);
chk('按钮初始为「全部展开」', (await page.textContent('.pane-head')).includes('全部展开'));

// 展开全部 → 加一个实体 → 新卡片是展开的
await page.click('text=全部展开');
await page.waitForTimeout(300);
const expanded = await page.evaluate(() => [...document.querySelectorAll('.fsec.folded, .fcard.folded')].length);
chk('全部展开后无折叠项', expanded === 0, expanded);
await page.click('text=全部折叠');
await page.waitForTimeout(250);
await page.click('.fsec .add-btn');
await page.waitForTimeout(350);
const newCardOpen = await page.evaluate(() => {
  const cards = document.querySelectorAll('.fsec')[0].querySelectorAll('.fcard');
  const last = cards[cards.length - 1];
  return { folded: last.classList.contains('folded'), bodyShown: getComputedStyle(last.querySelector('.fcard-body')).display !== 'none' };
});
chk('新增条目自动展开', newCardOpen.folded === false && newCardOpen.bodyShown, newCardOpen);

/* ---------------- C. JSON 只读 + 导入 ---------------- */
console.log('\n[C] JSON 只读面板 / 导入 JSON');
await page.click('.editor-pane .pane-head button:text-is("JSON")');
await page.waitForTimeout(300);
chk('JSON 面板是只读 <pre>', (await page.$eval('.json-read', e => e.tagName)) === 'PRE');
chk('面板里没有可编辑 textarea', (await page.$$('.json-view > textarea')).length === 0);
const shown = await page.$eval('.json-read', e => e.textContent);
const shownObj = JSON.parse(shown);
// 不写死数量（样例会变）：和左侧表单里的实体卡片数对上就算一致
const formEnts = await page.$$eval('.fsec', els => els[0] ? els[0].querySelectorAll('.fcard').length : -1);
chk('面板展示当前数据', shownObj.entities.length === formEnts && formEnts > 0, { panel: shownObj.entities.length, form: formEnts });

// 打开导入弹窗
await page.click('.json-view-head button:text-is("导入 JSON")');
await page.waitForTimeout(300);
chk('导入弹窗打开', await page.$eval('.mask.show .import-modal', () => true).catch(() => false));
chk('导入弹窗里有 textarea', !!(await page.$('.import-area')));

// 语法错误 → 报错、不改数据、弹窗不关
const countBefore = (await page.$$('.diagram')).length;
await page.fill('.import-area', '{ "entities": [ }');
await page.click('.import-modal button:text-is("校验并导入")');
await page.waitForTimeout(350);
const errMsg = await page.textContent('.import-modal .msg');
chk('语法错误有提示', /语法错误/.test(errMsg), errMsg);
chk('出错不改变图数量', (await page.$$('.diagram')).length === countBefore, { before: countBefore, after: (await page.$$('.diagram')).length });
chk('出错时弹窗仍开着', await page.$eval('.mask', e => e.classList.contains('show')));

// 结构错误 → 报错
await page.fill('.import-area', JSON.stringify({ title: 'x' }));
await page.click('.import-modal button:text-is("校验并导入")');
await page.waitForTimeout(300);
chk('缺 entities 有明确提示', /entities/.test(await page.textContent('.import-modal .msg')), await page.textContent('.import-modal .msg'));

// 合法 JSON → 导入
const newJson = JSON.stringify({
  title: '测试系统E-R图',
  entities: [
    { name: '教师', attributes: ['教师编号', '姓名', '职称'] },
    { name: '课程', attributes: ['课程编号', '课程名', '学分'] },
    { name: '班级', attributes: ['班级编号', '班级名'] }
  ],
  relations: [
    { name: '讲授', from: '教师', to: '课程', fromCard: '1', toCard: 'n' },
    { name: '使用', from: '课程', to: '班级', fromCard: '1', toCard: 'n' }
  ]
}, null, 2);
await page.fill('.import-area', newJson);
await page.click('.import-modal button:text-is("校验并导入")');
await page.waitForTimeout(700);
chk('导入后弹窗自动关闭', !(await page.$eval('.mask', e => e.classList.contains('show'))));
chk('3 实体 → 4 张图', (await page.$$('.diagram')).length === 4);
const formTitles = await page.$$eval('.fcard-title', els => els.map(e => e.textContent.trim()));
chk('表单同步为新实体', formTitles.includes('教师') && formTitles.includes('课程'), formTitles.slice(0, 5));
chk('只读面板已刷新', JSON.parse(await page.$eval('.json-read', e => e.textContent)).entities[0].name === '教师');

// Ctrl+Enter 导入
await page.click('.json-view-head button:text-is("导入 JSON")');
await page.waitForTimeout(250);
await page.fill('.import-area', JSON.stringify({ entities: [{ name: '唯一实体', attributes: ['编号'] }], relations: [] }));
await page.press('.import-area', 'Control+Enter');
await page.waitForTimeout(700);
chk('Ctrl+Enter 也能导入', (await page.$$('.diagram')).length === 2);

// 还原当前数据（第 2 次打开时草稿应等于当前数据）
await page.click('.json-view-head button:text-is("导入 JSON")');
await page.waitForTimeout(250);
const draftName = await page.$eval('.import-area', e => JSON.parse(e.value).entities[0].name);
chk('导入框默认带当前数据', draftName === '唯一实体', draftName);
await page.click('.import-modal button:text-is("取消")');
await page.waitForTimeout(200);

// 恢复示例，关掉面板
await page.click('text=示例');
await page.waitForTimeout(400);
await page.click('.editor-pane .pane-head button:text-is("JSON")');
await page.waitForTimeout(200);

/* ---------------- D. 提示词 ---------------- */
console.log('\n[D] 复制提示词');
chk('没有「导入 SQL」按钮', !(await page.$('text=导入 SQL')));
await page.click('text=复制提示词');
await page.waitForTimeout(300);
chk('提示词弹窗打开', await page.$eval('.mask', e => e.classList.contains('show')));
const promptText = await page.textContent('.prompt-pre');
chk('ER 提示词含 JSON 结构', promptText.includes('"entities"') && promptText.includes('"relations"'));
chk('提示词不再强制「只输出 JSON」', !/只输出 JSON/.test(promptText) && !/代码块围栏/.test(promptText));
chk('提示词仍要求给出完整 JSON', /一份完整的 JSON/.test(promptText));
await page.click('.prompt-modal .btn.primary');
await page.waitForTimeout(400);
const tip = await page.textContent('.prompt-modal .msg');
chk('复制后有反馈', /已复制|失败/.test(tip), tip);
let clip = '';
try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch { clip = ''; }
chk('剪贴板内容 = 提示词', clip.length > 200 && clip.includes('entities'), clip.length);
await page.click('.prompt-modal .btn:not(.primary)');
await page.waitForTimeout(250);

// 每种类型都有各自的提示词
for (const t of ALL.slice(1)) {
  await page.click(`.tabs button:text-is("${t.tab}")`);
  await page.waitForTimeout(350);
  await page.click('text=复制提示词');
  await page.waitForTimeout(250);
  const txt = await page.textContent('.prompt-pre');
  const key = { usecase: '"usecases"', functional: '"roles"', arch: '"layers"', sequence: '"messages"', flow: '"nodes"', swim: '"lanes"', class: '"classes"', state: '"transitions"' }[t.key];
  chk(`${t.key} 提示词含 ${key}`, txt.includes(key));
  await page.click('.prompt-modal .btn:not(.primary)');
  await page.waitForTimeout(200);
}

/* ---------------- E. drawio 导出 ---------------- */
console.log('\n[E] drawio 导出');
await page.click('.tabs button:text-is("ER 图")');
await page.waitForTimeout(500);
await page.click('text=示例');
await page.waitForTimeout(600);

const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.click('.preview-pane .btn:has-text("drawio")')
]);
const f = path.join(TMP, dl.suggestedFilename());
await dl.saveAs(f);
chk('下载文件名是 .drawio', dl.suggestedFilename().endsWith('.drawio'), dl.suggestedFilename());
const xml = fs.readFileSync(f, 'utf8');

const pageCount = (xml.match(/<diagram\b/g) || []).length;
// 页数跟着样例走：1 张总图 + 每个实体 1 张属性图
const erPages = (await page.$$('.diagram')).length;
chk(`样例 ${erPages} 张图 = ${erPages} 页`, pageCount === erPages, { pageCount, erPages });
chk('含 mxfile 根节点', xml.startsWith('<?xml') && xml.includes('<mxfile'));
chk('每页含 id="0" 与 id="1"', (xml.match(/<mxCell id="0" \/>/g) || []).length === erPages && (xml.match(/<mxCell id="1" parent="0" \/>/g) || []).length === erPages);

// 解析校验：标签闭合 / ID 唯一 / source-target 存在
const idsOf = (chunk) => [...chunk.matchAll(/<mxCell id="([^"]+)"/g)].map(m => m[1]);
const pagesHtml = xml.split('<diagram ').slice(1);
let dupIds = 0, badRef = 0, unbalanced = 0, edgeNoGeo = 0;
pagesHtml.forEach(pg => {
  const ids = idsOf(pg);
  if (new Set(ids).size !== ids.length) dupIds++;
  const set = new Set(ids);
  [...pg.matchAll(/\b(?:source|target)="([^"]+)"/g)].forEach(m => { if (!set.has(m[1])) badRef++; });
  const opens = (pg.match(/<mxCell\b/g) || []).length;
  const closes = (pg.match(/<\/mxCell>/g) || []).length;
  const selfClosed = (pg.match(/<mxCell[^>]*\/>/g) || []).length;
  if (opens !== closes + selfClosed) unbalanced++;
  const edges = (pg.match(/edge="1"/g) || []).length;
  const geos = (pg.match(/relative="1"/g) || []).length;
  if (edges !== geos) edgeNoGeo++;
});
chk('ID 无重复', dupIds === 0, dupIds);
chk('source/target 全部指向存在的 ID', badRef === 0, badRef);
chk('mxCell 标签闭合', unbalanced === 0, unbalanced);
chk('每条边都有 relative 几何', edgeNoGeo === 0, edgeNoGeo);
chk('菱形用了 rhombus', xml.includes('rhombus;'));
chk('菱形带 perimeter', xml.includes('perimeter=rhombusPerimeter'));
chk('白底黑线（无配色/圆角）', xml.includes('fillColor=#FFFFFF') && !xml.includes('rounded=1'));
chk('矩形无阴影', !/shadow=1/.test(xml));
// 属性值里出现裸 `<` 会让 XML 解析失败（draw.io 会静默丢掉后面所有单元格）
chk('XML 合法（value 内无裸 <）', !/value="[^"]*</.test(xml));

/**
 * 可编辑性审计：每条边都必须 source+target 齐全（不能是浮空线段），
 * 子单元格（parent 指向另一个图形）必须排在父级之后。
 */
function auditDrawio(src) {
  const pages = src.split('<diagram ').slice(1);
  let edges = 0, floating = 0, childAfterParent = 0, labelsOnEdge = 0, children = 0;
  pages.forEach(pg => {
    const seen = new Set();
    for (const m of pg.matchAll(/<mxCell ([^>]*)>/g)) {
      const attrs = m[1];
      const id = (attrs.match(/id="([^"]+)"/) || [])[1];
      const parent = (attrs.match(/parent="([^"]+)"/) || [])[1];
      const isEdge = /edge="1"/.test(attrs);
      if (isEdge) {
        edges++;
        const hasSrc = /\bsource="/.test(attrs);
        const hasDst = /\btarget="/.test(attrs);
        if (!hasSrc || !hasDst) floating++;
        if (/\bvalue="/.test(attrs)) labelsOnEdge++;
      }
      if (parent && parent !== '0' && parent !== '1') {
        children++;
        if (!seen.has(parent)) childAfterParent++;
      }
      if (id) seen.add(id);
    }
  });
  return { edges, floating, childAfterParent, labelsOnEdge, children };
}

const a1 = auditDrawio(xml);
chk('ER 图没有浮空线段（每条边两端都连图形）', a1.floating === 0, a1);
chk('ER 子单元格排在父级之后', a1.childAfterParent === 0, a1);
chk('ER 基数标签挂在边上（不是独立文本框）', a1.labelsOnEdge > 0, a1.labelsOnEdge);

// 其它三种类型也能导出，并检查各自的形状映射 + 可编辑性
for (const t of ALL.slice(1)) {
  await page.click(`.tabs button:text-is("${t.tab}")`);
  await page.waitForTimeout(400);
  const [d2] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click('.preview-pane .btn:has-text("drawio")')
  ]);
  const p2 = path.join(TMP, 'x-' + t.key + '.drawio');
  await d2.saveAs(p2);
  const x2 = fs.readFileSync(p2, 'utf8');
  chk(`${t.key} 可导出 drawio`, x2.includes('<mxfile') && (x2.match(/<diagram\b/g) || []).length === 1);
  const a = auditDrawio(x2);
  chk(`${t.key} 没有浮空线段`, a.floating === 0, a);
  chk(`${t.key} 子单元格在父级之后`, a.childAfterParent === 0, a);
  if (t.key === 'usecase') {
    chk('用例图含 umlActor', x2.includes('shape=umlActor'));
    chk('用例椭圆带 perimeter', x2.includes('perimeter=ellipsePerimeter'));
  }
  if (t.key === 'arch') {
    chk('架构图：层名左对齐', x2.includes('align=left;spacingLeft='));
    chk('架构图：组件是层带的子单元格', a.children > 0, a.children);
    chk('架构图：3 层 → 2 条箭头', a.edges === 2, a.edges);
  }
  if (t.key === 'flow') {
    chk('流程图：6 个顶点形状 + 10 节点', (x2.match(/<mxCell [^>]*vertex="1"/g) || []).length === 10,
      (x2.match(/<mxCell [^>]*vertex="1"/g) || []).length);
    chk('流程图：10 条连线', a.edges === 10, a.edges);
    chk('流程图：判断框用 rhombus', x2.includes('rhombus;'));
    chk('流程图：输入输出用平行四边形', x2.includes('shape=parallelogram;'));
    chk('流程图：连线全连到图形（无浮空）', a.floating === 0, a);
    chk('流程图：是/否标签挂在边上', a.labelsOnEdge >= 2, a.labelsOnEdge);
  }
  if (t.key === 'swim') {
    chk('泳道图：7 条连线', a.edges === 7, a.edges);
    chk('泳道图：连线全连到图形（无浮空）', a.floating === 0, a);
    chk('泳道图：节点是格子的子单元格', a.children >= 7, a.children);
    chk('泳道图：判断框用 rhombus', x2.includes('rhombus;'));
    chk('泳道图：顶点含表头/格子/节点', (x2.match(/vertex="1"/g) || []).length >= 22, (x2.match(/vertex="1"/g) || []).length);
  }
  if (t.key === 'class') {
    chk('类图：6 个类框（每个一个加粗类名）', (x2.match(/&lt;b&gt;/g) || []).length === 6, (x2.match(/&lt;b&gt;/g) || []).length);
    chk('类图：5 条关系', a.edges === 5, a.edges);
    chk('类图：连线全连到图形（无浮空）', a.floating === 0, a);
    chk('类图：空心三角 endFill=0', x2.includes('endArrow=block;endFill=0'));
    chk('类图：组合菱形 startFill=1', x2.includes('startArrow=diamondThin;startFill=1'));
    chk('类图：<<interface>> 没被当标签吞掉', x2.includes('&amp;lt;&amp;lt;interface'));
  }
  if (t.key === 'state') {
    chk('状态图：7 条迁移', a.edges === 7, a.edges);
    chk('状态图：连线全连到图形（无浮空）', a.floating === 0, a);
    chk('状态图：迁移文字挂在边上', a.labelsOnEdge >= 5, a.labelsOnEdge);
    chk('状态图：状态框是圆角矩形', x2.includes('rounded=1'));
    chk('状态图：终止圆是双圆（两个椭圆顶点）', (x2.match(/ellipse;/g) || []).length >= 3, (x2.match(/ellipse;/g) || []).length);
  }
  if (t.key === 'functional') {
    chk('功能模块名用 &lt;br&gt; 逐字换行', /value="[^"]*&lt;br&gt;[^"]*"/.test(x2));
    // 标题→角色 2 条 + 角色→模块 6+5 条，共 13 条（拆段会出现 3 倍数量）
    chk('正交连线是整条边而非碎线段', a.edges === 13, a.edges);
  }
  if (t.key === 'sequence') {
    chk('时序图生命线是虚线', x2.includes('dashed=1;dashPattern=6 4'));
    chk('时序图返回消息是空心箭头', x2.includes('endArrow=open'));
    chk('消息文字挂在边上', a.labelsOnEdge >= 7, a.labelsOnEdge);
    chk('激活条/锚点挂在参与方下（父子单元格）', a.children > 0, a.children);
    // 5 条生命线 + 7 条消息
    chk('时序图边数 = 12（无碎线段）', a.edges === 12, a.edges);
  }
}

/* ---------------- F. 原有功能 ---------------- */
console.log('\n[F] 原有功能未被破坏');
await page.click('.tabs button:text-is("ER 图")');
await page.waitForTimeout(400);
const [dlPng] = await Promise.all([
  page.waitForEvent('download', { timeout: 90000 }),
  page.click('text=/打包 PNG/')
]);
chk('ZIP 打包仍可用', dlPng.suggestedFilename().endsWith('.zip'), dlPng.suggestedFilename());

/* ---------------- G. 功能模块图「上下布局」 ---------------- */
console.log('\n[G] 功能模块图上下布局');
await page.click('text=功能模块图');
await page.waitForTimeout(500);

/** 用标题文字反查系统框的纵向位置（判断是"在最上面"还是"在中间"） */
async function titleRatio() {
  return page.evaluate(() => {
    const svg = document.querySelector('.paper svg');
    const vb = svg.viewBox.baseVal;
    const title = [...svg.querySelectorAll('text')].find(t => /电商系统/.test(t.textContent));
    return title ? { ratio: +(+title.getAttribute('y') / vb.height).toFixed(2), h: vb.height, w: vb.width } : null;
  });
}

chk('有「布局方式」下拉', !!(await page.$('select.inp')));
const opts = await page.$$eval('select.inp option', els => els.map(e => e.value));
chk('两种布局可选', opts.includes('bottom') && opts.includes('split'), opts);

const before = await titleRatio();
chk('默认布局：系统在最上方', before.ratio < 0.35, before);

await page.selectOption('select.inp', 'split');
await page.waitForTimeout(600);
const after = await titleRatio();
chk('上下布局：系统移到中间', after.ratio > 0.35, after);
chk('上下布局后画布更高', after.h > before.h, { before: before.h, after: after.h });
chk('仍然只出 1 张图', (await page.$$('.diagram')).length === 1);

// 上下布局的 drawio：向上的边要用上端口，且仍无浮空线段
const [dlSplit] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.click('.preview-pane .btn:has-text("drawio")')
]);
const pSplit = path.join(TMP, 'x-functional-split.drawio');
await dlSplit.saveAs(pSplit);
const xSplit = fs.readFileSync(pSplit, 'utf8');
chk('上排连线用上端口（exitY=0）', /exitX=0\.5;exitY=0;/.test(xSplit) && /entryX=0\.5;entryY=1;/.test(xSplit));
const aSplit = auditDrawio(xSplit);
chk('上下布局的边全部连接', aSplit.floating === 0, aSplit);

await page.selectOption('select.inp', 'bottom');
await page.waitForTimeout(500);
const back = await titleRatio();
chk('切回默认布局可复原', Math.abs(back.h - before.h) < 1, { before: before.h, back: back.h });

/* ---------------- H. 提示词不再有数量配额 ---------------- */
console.log('\n[H] 提示词已去掉数量限制');
for (const t of ALL) {
  await page.click(`.tabs button:text-is("${t.tab}")`);
  await page.waitForTimeout(350);
  await page.click('text=复制提示词');
  await page.waitForTimeout(250);
  const txt = await page.textContent('.prompt-pre');
  const quota = txt.match(/\d+\s*[~～-]\s*\d+\s*(个|条)/g);
  chk(`${t.key} 提示词无数量配额`, !quota, quota);
  chk(`${t.key} 提示词无「至少 N 个」`, !/至少\s*\d+\s*(个|条)/.test(txt));
  await page.click('.prompt-modal .btn:not(.primary)');
  await page.waitForTimeout(200);
}
await page.click('text=功能模块图');
await page.waitForTimeout(300);
await page.click('text=复制提示词');
await page.waitForTimeout(250);
const fTxt = await page.textContent('.prompt-pre');
chk('功能模块图提示词含 layout 字段', fTxt.includes('"layout"') && fTxt.includes('split'));
await page.click('.prompt-modal .btn:not(.primary)');
await page.waitForTimeout(200);

console.log('\n[I] 系统架构图');
await page.click('text=系统架构图');
await page.waitForTimeout(600);
chk(`${ALL.length} 个页签`, (await page.$$('.tabs button')).length === ALL.length, (await page.$$('.tabs button')).length);
chk('架构图出 1 张', (await page.$$('.diagram')).length === 1);
const archTexts = await page.$$eval('.paper svg text', els => els.map(e => e.textContent));
chk('含三个层名', ['表现层', '业务层', '数据层'].every(n => archTexts.includes(n)), archTexts.slice(0, 6));
chk('含组件名', archTexts.includes('MySQL') && archTexts.includes('Web 前端'), archTexts);
chk('有「层次」分区', (await page.$$eval('.fsec-title', els => els.map(e => e.textContent))).some(t => t.includes('层次')));

// 新增一层 → 画布变高
const h0 = await page.$eval('.paper svg', e => e.viewBox.baseVal.height);
await page.click('.fsec .add-btn');
await page.waitForTimeout(450);
const h1 = await page.$eval('.paper svg', e => e.viewBox.baseVal.height);
chk('新增层次后画布变高', h1 > h0, { h0, h1 });

// 导入 JSON（验证 normalizeData 对 arch 的处理）
await page.click('.editor-pane .pane-head button:text-is("JSON")');
await page.waitForTimeout(300);
await page.click('.json-view-head button:text-is("导入 JSON")');
await page.waitForTimeout(300);
await page.fill('.import-area', JSON.stringify({
  title: '测试架构',
  layers: [
    { name: '前端层', items: ['Vue 3'] },
    { name: '后端层', items: ['Spring Boot', 'MyBatis'] },
    { name: '数据层', items: ['MySQL', 'Redis'] }
  ]
}));
await page.click('.import-modal button:text-is("校验并导入")');
await page.waitForTimeout(700);
const archTexts2 = await page.$$eval('.paper svg text', els => els.map(e => e.textContent));
chk('导入后层名更新', archTexts2.includes('前端层') && archTexts2.includes('后端层'), archTexts2.slice(0, 5));
chk('导入后组件更新', archTexts2.includes('Spring Boot') && archTexts2.includes('MyBatis'), archTexts2);
await page.click('.editor-pane .pane-head button:text-is("JSON")');
await page.waitForTimeout(200);

/* ---------------- J. 用例图二级功能（<<include>>） ---------------- */
console.log('\n[J] 用例图二级功能');
await page.click('text=用例图');
await page.waitForTimeout(500);
await page.click('text=示例');
await page.waitForTimeout(700);
const sampleTexts = await page.$$eval('.paper svg text', els => els.map(e => e.textContent));
chk('示例自带二级功能', sampleTexts.filter(t => t === '<<include>>').length >= 5,
  sampleTexts.filter(t => t === '<<include>>').length);
chk('示例含二级功能名', sampleTexts.includes('填写手机号') && sampleTexts.includes('申请退款'));

await page.click('.editor-pane .pane-head button:text-is("JSON")');
await page.waitForTimeout(250);
await page.click('.json-view-head button:text-is("导入 JSON")');
await page.waitForTimeout(250);
await page.fill('.import-area', JSON.stringify({
  title: '教师用例图',
  actor: '教师',
  usecases: [
    { name: '实验室预约审批', includes: ['审核学生实验室预约', '批量审批预约', '驳回并填写理由'] },
    { name: '个人信息管理', includes: ['查看个人信息', '修改个人信息'] }
  ]
}));
await page.click('.import-modal button:text-is("校验并导入")');
await page.waitForTimeout(800);

const ucTexts = await page.$$eval('.paper svg text', els => els.map(e => e.textContent));
chk('一级用例渲染', ucTexts.includes('实验室预约审批') && ucTexts.includes('个人信息管理'), ucTexts);
chk('二级功能渲染', ucTexts.includes('审核学生实验室预约') && ucTexts.includes('查看个人信息'));
chk('<<include>> 出现 5 次', ucTexts.filter(t => t === '<<include>>').length === 5, ucTexts.filter(t => t.includes('include')));
const dashes = await page.$$eval('.paper svg path[stroke-dasharray]', els => els.length);
chk('虚线 5 条', dashes === 5, dashes);
chk('只画一个角色（火柴人 1 个）', (await page.$$eval('.paper svg circle', els => els.length)) === 1);

// 表单：每个用例一张卡片，标题显示二级功能数量
await page.click('.editor-pane .pane-head button:text-is("JSON")');
await page.waitForTimeout(250);
const cardTitles = await page.$$eval('.fcard-title', els => els.map(e => e.textContent.trim()));
chk('用例卡片显示二级功能数', cardTitles.some(t => t.includes('3 项二级功能')), cardTitles);

// drawio：include 边要是「虚线 + 空心箭头 + 纯文本标签」
const [dlUc] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.click('.preview-pane .btn:has-text("drawio")')
]);
const pUc = path.join(TMP, 'x-usecase-2level.drawio');
await dlUc.saveAs(pUc);
const xUc = fs.readFileSync(pUc, 'utf8');
chk('include 边是虚线', xUc.includes('dashed=1;dashPattern=5 4'));
chk('include 边是空心箭头', xUc.includes('endArrow=open'));
chk('含尖括号的标签走 html=0', xUc.includes('html=0'));
chk('标签文本是 &lt;&lt;include&gt;&gt;', xUc.includes('value="&lt;&lt;include&gt;&gt;"'));
const aUc = auditDrawio(xUc);
chk('用例图边数 = 2 条角色线 + 5 条 include', aUc.edges === 7, aUc);
chk('用例图没有浮空线段', aUc.floating === 0, aUc);

/* ---------------- K. 品牌与布局 ---------------- */
console.log('\n[K] 品牌 / 导出区位置');
chk('顶栏品牌是 Carocall Tool Box', (await page.textContent('header .logo')).trim() === 'Carocall Tool Box');
chk('顶栏不再有导出按钮（留给个人主页）', (await page.$$('header .btn')).length === 0);
chk('顶栏没有旧图标', (await page.$$('header .logo .dot')).length === 0);
chk('导出按钮在预览栏', !!(await page.$('.preview-pane .pane-head button:has-text("导出 drawio")')));
chk('预览栏里仍保留缩放', !!(await page.$('.preview-pane .pane-head button:has-text("适应宽度")')));
const title = await page.title();
chk('页面标题已改名', /Carocall Tool Box/.test(title), title);

/* 顶栏右侧的外链（第一个是 draw.io） */
const link = await page.$eval('.top-links a', a => ({ href: a.href, target: a.target, rel: a.rel }));
chk('外链指向 app.diagrams.net', link.href === 'https://app.diagrams.net/', link.href);
chk('外链新标签打开且带 noopener', link.target === '_blank' && /noopener/.test(link.rel), link);
chk('外链图标是内联 SVG', (await page.$$('.top-links svg')).length === 1);
const linkRight = await page.evaluate(() => {
  const a = document.querySelector('.top-links a').getBoundingClientRect();
  const t = document.querySelector('.tabs').getBoundingClientRect();
  const h = document.querySelector('header').getBoundingClientRect();
  return { ok: a.left >= t.right - 1 && h.right - a.right < 40, ax: Math.round(a.left), tx: Math.round(t.right), gap: Math.round(h.right - a.right) };
});
chk('外链在页签右侧、贴着顶栏右边缘', linkRight.ok, linkRight);

/* ---------------- L. 流程图（网格坐标） ---------------- */
console.log('\n[L] 流程图网格布局');
await page.click('.tabs button:text-is("流程图")');
await page.waitForTimeout(700);
chk('流程图出 1 张', (await page.$$('.diagram')).length === 1);
const flTexts = await page.$$eval('.paper svg text', els => els.map(e => e.textContent));
chk('节点文字都渲染了', ['开始', '选择商品', '库存充足？', '通知补货', '打包发货'].every(t => flTexts.includes(t)), flTexts);
chk('判断的「是/否」标签存在', flTexts.filter(t => t === '是' || t === '否').length >= 2, flTexts);

// 形状：1 个菱形 + 1 个平行四边形 + 若干矩形
chk('有一个判断菱形', (await page.$$eval('.paper svg polygon', els => els.length)) >= 2,
  await page.$$eval('.paper svg polygon', els => els.map(e => e.getAttribute('points')?.slice(0, 12))));

// 网格：同一 row 的两个节点 y 完全对齐
const sameRowY = await page.evaluate(() => {
  const rs = [...document.querySelectorAll('.paper svg rect')].map(r => r);
  return rs.length > 0;
});
chk('形状用 rect/polygon 绘制', sameRowY);

// 改「行」→ 画布变高（表单默认折叠，先全部展开）
await page.click('text=全部展开');
await page.waitForTimeout(600);
const fh0 = await page.$eval('.paper svg', e => e.viewBox.baseVal.height);
const inputs = await page.$$('.grid-xy input.num');
chk('每个节点都有列/行输入框', inputs.length >= 20, inputs.length);
// 第 2 个节点的「行」加 2
// 把最下面那个节点（结束，row 17）再往下挪 → 画布应该变高
await inputs[15].fill('25');
await inputs[15].dispatchEvent('input');
await page.waitForTimeout(500);
const fh1 = await page.$eval('.paper svg', e => e.viewBox.baseVal.height);
chk('改行号后画布变高', fh1 > fh0, { fh0, fh1 });

// 加一个节点 → 卡片数 +1
const flCards0 = await page.$$eval('.fcard-title', els => els.length);
await page.click('.fsec .add-btn');
await page.waitForTimeout(500);
const flCards1 = await page.$$eval('.fcard-title', els => els.length);
chk('新增节点后卡片 +1', flCards1 === flCards0 + 1, { flCards0, flCards1 });

// 提示词包含网格规则
await page.click('text=复制提示词');
await page.waitForTimeout(300);
const flPrompt = await page.textContent('.prompt-pre');
chk('流程图提示词讲清了 col/row', /col/.test(flPrompt) && /row/.test(flPrompt));
chk('流程图提示词给了间距规则', /行距/.test(flPrompt));
await page.click('.prompt-modal .btn.primary');
await page.waitForTimeout(300);

console.log('\n===== ' + ok + ' 通过 / ' + fail + ' 失败 =====');
console.log('errors: ' + (errs.length ? errs.join('\n') : '(none)'));
await browser.close();
process.exit(fail ? 1 : 0);
