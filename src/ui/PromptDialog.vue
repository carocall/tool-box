<script setup lang="ts">
/**
 * 「复制提示词」弹窗：展示当前图类型的 JSON 书写规范，
 * 一键复制后贴到任意网页版 AI，让 AI 输出可直接粘回来的 JSON。
 */
import { computed, ref } from 'vue';
import { PROMPTS } from '../core/prompts';
import { TYPE_LABEL } from './store';
import { copyText } from './clipboard';
import type { DiagramType } from '../core/types';

const props = defineProps<{ modelValue: boolean; type: DiagramType }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const tip = ref('');
const promptText = computed(() => PROMPTS[props.type] ?? '');

function close() {
  tip.value = '';
  emit('update:modelValue', false);
}
async function doCopy() {
  try {
    await copyText(promptText.value);
    tip.value = '已复制 ✓ 去网页版 AI 粘贴吧';
  } catch {
    tip.value = '复制失败，请手动全选复制';
  }
  setTimeout(() => { tip.value = ''; }, 2600);
}
</script>

<template>
  <div class="mask" :class="{ show: modelValue }" @click.self="close">
    <div class="modal prompt-modal">
      <div class="modal-head">
        <h3>复制提示词 · {{ TYPE_LABEL[type] }}</h3>
        <span class="sub">粘贴给网页版 AI → 拿回 JSON → 贴到左侧「JSON」面板</span>
      </div>
      <div class="modal-body">
        <pre class="prompt-pre">{{ promptText }}</pre>
      </div>
      <div class="modal-foot">
        <span class="msg" :class="{ good: tip.startsWith('已复制'), bad: tip.startsWith('复制失败') }">{{ tip }}</span>
        <button class="btn" @click="close">关闭</button>
        <button class="btn primary" @click="doCopy">复制提示词</button>
      </div>
    </div>
  </div>
</template>
