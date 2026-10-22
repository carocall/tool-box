/** 复制到剪贴板：优先 Clipboard API，file:// 或旧浏览器回退到 execCommand。 */
export async function copyText(t: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(t); return; } catch { /* 继续走回退 */ }
  }
  await new Promise<void>((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.style.position = 'fixed';
    ta.style.top = '-2000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      const ok = document.execCommand('copy');
      ta.remove();
      ok ? resolve() : reject(new Error('复制失败'));
    } catch (e) {
      ta.remove();
      reject(e);
    }
  });
}
