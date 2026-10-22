/**
 * 导出：SVG / PNG / ZIP 打包。
 *
 * 为什么打包：浏览器会拦截「一次触发多个下载」，所以多张图必须合成一个 zip。
 * PNG 走 SVG → <img> → canvas → toBlob，导出时把 svg 尺寸放大 scale 倍保证清晰。
 */
import { buildZip } from '../core/zip';
import { buildDrawio } from '../core/drawio';
import type { Diagram } from '../core/types';
import { state, diagrams, currentScenes, TYPE_LABEL } from './store';

export function safeName(s: string): string {
  return String(s)
    .replace(/[\\/:*?"<>|\s·（）()\[\]]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60) || 'diagram';
}

export function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 800);
}

/** 按缩放比重新生成 svg 的 width/height（保留 viewBox，保证矢量清晰） */
function scaleSvgSize(svg: string, w: number, h: number, scale: number): string {
  return svg.replace(
    /<svg([^>]*?)width="[\d.]+"\s+height="[\d.]+"/,
    `<svg$1width="${Math.round(w * scale * 100) / 100}" height="${Math.round(h * scale * 100) / 100}"`
  );
}

export function exportSVG(d: Diagram) {
  download(new Blob([d.svg], { type: 'image/svg+xml;charset=utf-8' }), safeName(d.name) + '.svg');
}

/** SVG → PNG 字节 */
export function svgToPngBytes(d: Diagram, scale = 2): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const svgStr = scaleSvgSize(d.svg, d.w, d.h, scale);
    const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = Math.round(d.w * scale);
      cv.height = Math.round(d.h * scale);
      const ctx = cv.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('canvas 不可用')); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(b => {
        if (!b) { reject(new Error('PNG 生成失败')); return; }
        b.arrayBuffer().then(buf => resolve(new Uint8Array(buf)), reject);
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG 光栅化失败')); };
    img.src = url;
  });
}

export async function exportPNG(d: Diagram, scale = 2): Promise<boolean> {
  try {
    const bytes = await svgToPngBytes(d, scale);
    download(new Blob([bytes as unknown as BlobPart], { type: 'image/png' }), safeName(d.name) + '.png');
    return true;
  } catch { return false; }
}

/** 顶部按钮文案：1 张时显示「导出」，多张时显示「打包（N）」 */
export function packLabel(kind: 'SVG' | 'PNG'): string {
  const n = diagrams.value.length;
  return n > 1 ? `打包 ${kind}（${n}）` : `导出 ${kind}`;
}

/** 一键拿走当前类型的全部图：1 张直出文件，多张打成 zip */
export async function exportPack(kind: 'svg' | 'png'): Promise<void> {
  const list = diagrams.value;
  if (!list.length) return;
  const K = kind.toUpperCase();
  if (list.length === 1) {
    if (kind === 'svg') exportSVG(list[0]);
    else await exportPNG(list[0], 2);
    return;
  }
  const enc = new TextEncoder();
  const files: { name: string; data: Uint8Array }[] = [];
  const used = new Set<string>();
  const uniq = (n: string) => {
    let name = n, i = 2;
    while (used.has(name)) name = n.replace(/(\.[A-Za-z]+)$/, `(${i++})$1`);
    used.add(name);
    return name;
  };
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    const base = String(i + 1).padStart(2, '0') + '_' + safeName(d.name);
    if (kind === 'png') {
      try { files.push({ name: uniq(base + '.png'), data: await svgToPngBytes(d, 2) }); }
      catch { /* 单张失败跳过，不影响其余 */ }
    } else {
      files.push({ name: uniq(base + '.svg'), data: enc.encode(d.svg) });
    }
  }
  if (!files.length) return;
  download(buildZip(files), `Carocall Tool Box_${TYPE_LABEL[state.type]}_${K}_${stamp()}.zip`);
}

/**
 * 导出 .drawio（draw.io / diagrams.net 可直接打开编辑）。
 *
 * 多张图 = 一个文件的多页：ER 的「总图 + N 张属性图」会在 draw.io 左侧
 * 显示为 N 个页面，一次拿到全部，不用打包 zip。
 */
export function exportDrawio(): boolean {
  const pages = currentScenes();
  if (!pages.length) return false;
  const xml = buildDrawio(pages, TYPE_LABEL[state.type]);
  const blob = new Blob([xml], { type: 'application/vnd.jgraph.mxfile;charset=utf-8' });
  download(blob, `Carocall Tool Box_${TYPE_LABEL[state.type]}_${stamp()}.drawio`);
  return true;
}

/** drawio 按钮文案：多页时提示页数 */
export function drawioLabel(): string {
  const n = diagrams.value.length;
  return n > 1 ? `导出 drawio（${n} 页）` : '导出 drawio';
}

/** UTF-8 字符串 → deflate-raw → base64（draw.io 的 #R 链接就吃这个格式） */
async function deflateRawBase64(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  const CH = 0x8000;                        // 分块转字符串，避免大数组爆栈
  for (let i = 0; i < buf.length; i += CH) {
    bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + CH)));
  }
  return btoa(bin);
}

/**
 * 直接在 app.diagrams.net 里打开当前图（可编辑，不用先下载）。
 *
 * 用的是 draw.io 官方的 **`#R` 链接**格式：
 *   `#R` + encodeURIComponent(base64(deflateRaw(encodeURIComponent(xml))))
 * 纯前端就能拼出来，不需要任何服务器。
 * ⚠️ 不要改用 `#create=`：draw.io 加载后会把 hash 重写成它自己的压缩结果，
 * 和我们算的不是逐字节一致，于是会弹「All changes will be lost!」。
 */
export async function openInDrawio(): Promise<{ ok: boolean; msg: string }> {
  const pages = currentScenes();
  if (!pages.length) return { ok: false, msg: '当前没有可打开的内容' };
  if (typeof CompressionStream === 'undefined') {
    return { ok: false, msg: '这个浏览器不支持在线压缩，请改用「导出 drawio」' };
  }
  const xml = buildDrawio(pages, TYPE_LABEL[state.type]);
  const b64 = await deflateRawBase64(encodeURIComponent(xml));
  const url = `https://app.diagrams.net/?grid=0#R${encodeURIComponent(b64)}`;
  // 浏览器地址栏一般能扛到 ~2MB，留点余量
  if (url.length > 1500000) {
    return { ok: false, msg: '这张图太大，链接会超出浏览器长度限制，请改用「导出 drawio」' };
  }
  const w = window.open(url, '_blank');
  if (w) { try { w.opener = null; } catch { /* 跨域时设不了，忽略 */ } }
  return w ? { ok: true, msg: '' } : { ok: false, msg: '浏览器拦截了新窗口，请允许本页弹出窗口后重试' };
}
