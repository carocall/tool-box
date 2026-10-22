/**
 * 把构建产物复制成一个"可以发给别人双击"的文件。
 * 用法：npm run release
 */
import fs from 'node:fs';

const SRC = 'dist/index.html';
const OUT_DIR = 'release';
const OUT = `${OUT_DIR}/Carocall Tool Box.html`;

if (!fs.existsSync(SRC)) {
  console.error('找不到 dist/index.html，请先 npm run build');
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.copyFileSync(SRC, OUT);
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`✅ 已生成 ${OUT}  (${kb} KB) —— 双击即可打开，可直接分发`);
