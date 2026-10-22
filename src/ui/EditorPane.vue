<script setup lang="ts">
/** 左侧：可视化编辑器（表单 + 可编辑 JSON 面板 + 提示词） */
import { computed, ref } from 'vue';
import ERForm from './forms/ERForm.vue';
import UsecaseForm from './forms/UsecaseForm.vue';
import FunctionalForm from './forms/FunctionalForm.vue';
import ArchForm from './forms/ArchForm.vue';
import SequenceForm from './forms/SequenceForm.vue';
import FlowForm from './forms/FlowForm.vue';
import SwimForm from './forms/SwimForm.vue';
import JsonPanel from './JsonPanel.vue';
import PromptDialog from './PromptDialog.vue';
import { HINTS } from '../core/samples';
import type { DiagramType } from '../core/types';
import {
  state, renderResult, foldAllOn,
  loadSample, clearCurrent, toggleFoldAll
} from './store';

const FORMS: Record<DiagramType, any> = {
  er: ERForm,
  usecase: UsecaseForm,
  functional: FunctionalForm,
  arch: ArchForm,
  sequence: SequenceForm,
  flow: FlowForm,
  swim: SwimForm
};
const formComp = computed(() => FORMS[state.type]);

const jsonOpen = ref(false);
const promptOpen = ref(false);

const status = computed(() => {
  const r = renderResult.value;
  if (r.empty) return { text: '等待输入…', cls: '' };
  if (r.error) return { text: '渲染失败：' + r.error, cls: 'bad' };
  return { text: `渲染完成 · 共 ${r.list.length} 张图`, cls: 'good' };
});

const hint = computed(() => HINTS[state.type] ?? '');
</script>

<template>
  <section class="pane editor-pane">
    <div class="pane-head">
      <div class="title"><span class="ico">▤</span>可视化编辑</div>
      <button class="btn" @click="toggleFoldAll">{{ foldAllOn ? '全部展开' : '全部折叠' }}</button>
      <button class="btn" @click="loadSample">示例</button>
      <button class="btn" @click="clearCurrent">清空</button>
      <button class="btn" :class="{ primary: jsonOpen }" @click="jsonOpen = !jsonOpen">JSON</button>
      <button class="btn ai" title="复制该图类型的 JSON 书写规范，贴给网页版 AI 生成数据" @click="promptOpen = true">复制提示词</button>
    </div>

    <div class="form-wrap">
      <component :is="formComp" :key="state.type" />
    </div>

    <JsonPanel v-if="jsonOpen" :key="'json-' + state.type" />

    <div class="statusbar"><span :class="status.cls">{{ status.text }}</span></div>
    <!-- HINTS 是本项目自带的静态文案，内含 <b> 标签 -->
    <div class="hintbox" v-html="hint"></div>

    <PromptDialog v-model="promptOpen" :type="state.type" />
  </section>
</template>
