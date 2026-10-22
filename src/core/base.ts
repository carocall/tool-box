/** 基础工具：转义 / 取整 / 文本量宽 / 唯一 id。改动量宽系数会影响所有图排版。 */

export const SVGNS = 'http://www.w3.org/2000/svg';
export const FONT  = "'Microsoft YaHei','PingFang SC','Hiragino Sans GB','Source Han Sans SC','Helvetica Neue',Arial,sans-serif";
let UID = 0;
export const uid = (p) => (p || 'x') + (++UID).toString(36);

export function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export function isCJK(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x1100 && c <= 0x115F) || (c >= 0x2E80 && c <= 0x9FFF) ||
         (c >= 0xA960 && c <= 0xA97F) || (c >= 0xAC00 && c <= 0xD7FF) ||
         (c >= 0xF900 && c <= 0xFAFF) || (c >= 0xFE30 && c <= 0xFE4F) ||
         (c >= 0xFF00 && c <= 0xFF60) || (c >= 0xFFE0 && c <= 0xFFE6);
}
/** 估算文本像素宽度 */
export function tw(s: unknown, fs: number): number {
  let w = 0;
  for (const ch of String(s == null ? '' : s)) w += /\s/.test(ch) ? fs * 0.30 : (isCJK(ch) ? fs : fs * 0.56);
  return w;
}
export function num(v: unknown, d: number): number { const n = Number(v); return Number.isFinite(n) ? n : d; }
