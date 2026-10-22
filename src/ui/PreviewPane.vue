<script setup lang="ts">
/** 右侧：预览 + 缩放 + 单张导出 + 整体导出 */
import { nextTick, onMounted, ref, watch } from 'vue';
import { state, diagrams, renderResult } from './store';
import { exportPNG, exportSVG, exportPack, exportDrawio, openInDrawio, drawioLabel, packLabel } from './export';
import type { Diagram } from '../core/types';

const wrap = ref<HTMLElement | null>(null);

function zoomBy(delta: number) {
  state.zoom = Math.min(3, Math.max(0.2, +(state.zoom + delta).toFixed(2)));
}
function fit() {
  const el = wrap.value;
  const list = diagrams.value;
  if (!el || !list.length) return;
  const avail = el.clientWidth - 48;
  const maxW = Math.max(...list.map(d => d.w));
  state.zoom = Math.min(1, Math.max(0.2, avail / maxW));
}

// 首屏与切换类型时自动适应宽度（与旧版行为保持一致）
onMounted(() => nextTick(() => setTimeout(fit, 0)));
watch(() => state.type, () => nextTick(() => setTimeout(fit, 0)));

/** 按当前缩放比改写 svg 的 width/height（保留 viewBox） */
function shownSvg(d: Diagram): string {
  const z = state.zoom;
  return d.svg.replace(
    /<svg([^>]*?)width="[\d.]+"\s+height="[\d.]+"/,
    `<svg$1width="${Math.round(d.w * z * 100) / 100}" height="${Math.round(d.h * z * 100) / 100}"`
  );
}

function emptyText(): string {
  const r = renderResult.value;
  if (r.error) return '渲染失败：' + r.error;
  const tip = state.type === 'flow' ? '先添加节点'
    : state.type === 'er' ? '先添加实体'
    : state.type === 'usecase' ? '先添加用例'
    : state.type === 'functional' ? '先添加角色' : '先添加生命线';
  return '暂无可渲染的内容，' + tip;
}

/** 去 drawio 在线编辑：把当前 XML 压进 URL 的 #R 段，新标签页直接打开 */
async function goDrawio() {
  const r = await openInDrawio();
  if (!r.ok) window.alert(r.msg);
}
</script>

<template>
  <section class="pane preview-pane">
    <div class="pane-head">
      <div class="title">
        <span class="ico">◨</span>预览
        <span style="color: var(--text-3); font-weight: 400;">{{ diagrams.length ? `（${diagrams.length} 张）` : '' }}</span>
      </div>
      <span class="head-sep"></span>
      <button class="btn" :disabled="!diagrams.length" title="导出可在 draw.io 里继续编辑的多页文件" @click="exportDrawio()">{{ drawioLabel() }}</button>
      <button class="btn go-drawio" :disabled="!diagrams.length" title="在 app.diagrams.net 里直接打开当前图（新标签页，可编辑）" @click="goDrawio()">去 drawio 编辑 ↗</button>
      <button class="btn" :disabled="!diagrams.length" title="打包成 zip 下载（多张图一次拿走）" @click="exportPack('svg')">{{ packLabel('SVG') }}</button>
      <button class="btn primary" :disabled="!diagrams.length" title="打包成 zip 下载（多张图一次拿走）" @click="exportPack('png')">{{ packLabel('PNG') }}</button>
      <div class="spacer"></div>
      <button class="btn ghost" title="缩小" @click="zoomBy(-0.15)">−</button>
      <button class="btn ghost" style="min-width: 56px" @click="state.zoom = 1">{{ Math.round(state.zoom * 100) }}%</button>
      <button class="btn ghost" title="放大" @click="zoomBy(0.15)">＋</button>
      <button class="btn" @click="fit">适应宽度</button>
    </div>

    <div ref="wrap" class="canvas-wrap">
      <div v-if="!diagrams.length" class="empty">
        <div class="big">◈</div>
        <div>{{ emptyText() }}</div>
      </div>

      <div v-for="(d, i) in diagrams" :key="i" class="diagram">
        <div class="diagram-head">
          <span class="dname">{{ d.name }}</span>
          <span class="dops">
            <button class="btn" @click="exportSVG(d)">SVG</button>
            <button class="btn" @click="exportPNG(d, 2)">PNG</button>
          </span>
        </div>
        <div
          class="paper"
          :style="{ width: d.w * state.zoom + 'px', height: d.h * state.zoom + 'px' }"
          v-html="shownSvg(d)"
        ></div>
      </div>
    </div>
  </section>
</template>
