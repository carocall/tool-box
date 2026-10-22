/** 竖排文字：CJK 逐字正立自上而下，连续西文整串旋转 90°。 */
import { tw, FONT, esc } from './base';
import { r2, svgText } from './svg';

export const V_ASCII = /[A-Za-z0-9_.\-+%]/;
export const V_ASCII_RUN = /^[A-Za-z0-9_.\-+%]+$/;
/** 把一行拆成「单字」与「连续西文串」两类 token */
export function tokenizeV(line: string): string[] {
  const out = [];
  let buf = '';
  for (const ch of String(line)) {
    if (V_ASCII.test(ch)) buf += ch;
    else { if (buf) { out.push(buf); buf = ''; } out.push(ch); }
  }
  if (buf) out.push(buf);
  return out;
}
export function vAdv(tk: string, fs: number): number {
  return (V_ASCII_RUN.test(tk) && tk.length > 1) ? tw(tk, fs) : fs * 1.14;
}
/** 竖排文本高度（不含外框留白） */
export function vTextHeight(text: unknown, fs: number): number {
  const lines = String(text == null ? '' : text).split(/\r?\n|<br\s*\/?>/i);
  const gap = fs * 0.06;
  let h = 0;
  lines.forEach((ln, li) => {
    if (li > 0) h += fs * 0.55;
    tokenizeV(ln).forEach(tk => { h += vAdv(tk, fs) + gap; });
  });
  return h;
}
/** 竖排绘制：中日韩逐字正立自上而下；连续西文整串旋转 90°（保持可读） */
export function svgTextVertical(cx: number, yTop: number, text: unknown, fs: number): string {
  const lines = String(text == null ? '' : text).split(/\r?\n|<br\s*\/?>/i);
  const gap = fs * 0.06;
  const parts = [];
  let y = yTop;
  lines.forEach((ln, li) => {
    if (li > 0) y += fs * 0.55;
    tokenizeV(ln).forEach(tk => {
      const adv = vAdv(tk, fs);
      const cy = y + adv / 2;
      if (V_ASCII_RUN.test(tk) && tk.length > 1) {
        parts.push(`<text x="${r2(cx)}" y="${r2(cy)}" font-size="${fs}" fill="#000000" text-anchor="middle" ` +
          `dominant-baseline="central" font-family="${FONT}" transform="rotate(-90 ${r2(cx)} ${r2(cy)})">${esc(tk)}</text>`);
      } else {
        parts.push(svgText(cx, cy, tk, { fs: fs }));
      }
      y += adv + gap;
    });
  });
  return parts.join('');
}
