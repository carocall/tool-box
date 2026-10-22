<script setup lang="ts">
/** 应用外壳：顶栏（品牌 + 外链 + 页签）+ 左右两栏 */
import { state, switchType } from './ui/store';
import EditorPane from './ui/EditorPane.vue';
import PreviewPane from './ui/PreviewPane.vue';
import type { DiagramType } from './core/types';

const TABS: { type: DiagramType; label: string }[] = [
  { type: 'er', label: 'ER 图' },
  { type: 'usecase', label: '用例图' },
  { type: 'functional', label: '功能模块图' },
  { type: 'arch', label: '系统架构图' },
  { type: 'sequence', label: '时序图' },
  { type: 'flow', label: '流程图' },
  { type: 'swim', label: '泳道图' }
];

/**
 * 顶栏右侧的外链区（以后还会加，往这个数组里追加就行）。
 * icon 目前只有 'drawio'：SVG 内联在模板里，保证构建产物仍是单个自包含 HTML。
 */
const LINKS: { href: string; title: string; label: string; icon: string }[] = [
  {
    href: 'https://app.diagrams.net/',
    title: '在 draw.io 里打开（app.diagrams.net）',
    label: 'draw.io',
    icon: 'drawio'
  }
];
</script>

<template>
  <header>
    <div class="logo">Carocall Tool Box</div>

    <div class="tabs">
      <button
        v-for="t in TABS"
        :key="t.type"
        :class="{ on: state.type === t.type }"
        @click="switchType(t.type)"
      >{{ t.label }}</button>
    </div>

    <div class="spacer"></div>

    <!-- 顶栏右侧：外链区（第一个是 draw.io，以后还可以放主人的 Bilibili 主页） -->
    <nav class="top-links">
      <a
        v-for="l in LINKS"
        :key="l.href"
        class="icon-link"
        :href="l.href"
        :title="l.title"
        :aria-label="l.label"
        target="_blank"
        rel="noopener noreferrer"
      >
        <!-- draw.io logo：内联 SVG，别换成外部图片 -->
        <svg v-if="l.icon === 'drawio'" viewBox="0 0 225 225" aria-hidden="true">
          <path fill="#F08705" d="M225,215.4c0,5.3-4.3,9.6-9.5,9.6l0,0H9.6c-5.3,0-9.6-4.3-9.6-9.5l0,0V9.6C0,4.3,4.3,0,9.5,0l0,0h205.9 c5.3,0,9.6,4.3,9.6,9.5l0,0V215.4z"/>
          <path fill="#DF6C0C" d="M225,215.4c0,5.3-4.3,9.6-9.5,9.6l0,0H77.1l-44.8-45.5L60.2,134l82.7-102.7l82.1,84.5V215.4z"/>
          <path fill="#FFFFFF" d="M184.6,125.8h-23.7l-25-42.7c5.7-1.2,9.8-6.2,9.7-12V39c0-6.8-5.4-12.3-12.2-12.3h-0.1H91.6 c-6.8,0-12.3,5.4-12.3,12.2V39v32.1c0,5.8,4,10.8,9.7,12l-25,42.7H40.4c-6.8,0-12.3,5.4-12.3,12.2v0.1v32.1 c0,6.8,5.4,12.3,12.2,12.3h0.1h41.7c6.8,0,12.3-5.4,12.3-12.2v-0.1v-32.1c0-6.8-5.4-12.3-12.2-12.3h-0.1h-4l24.8-42.4h19.3 l24.9,42.4H143c-6.8,0-12.3,5.4-12.3,12.2v0.1v32.1c0,6.8,5.4,12.3,12.2,12.3h0.1h41.7c6.8,0,12.3-5.4,12.3-12.2v-0.1v-32.1 c0-6.8-5.4-12.3-12.2-12.3C184.7,125.8,184.7,125.8,184.6,125.8z"/>
        </svg>
      </a>
    </nav>
  </header>

  <main>
    <EditorPane />
    <PreviewPane />
  </main>
</template>
