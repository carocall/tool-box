<script setup lang="ts">
/**
 * 左侧底部：JSON 查看面板（**只读**）。
 *
 * 为什么要只读：这份 JSON 是实时驱动预览的数据本体，
 * 让用户在上面直接敲字很容易把结构改坏（少个括号整张图就白了）。
 * 需要整段替换时走「导入 JSON」—— 那里有暂存区和校验，失败不会影响现有数据。
 */
import { computed, ref } from 'vue';
import { state, currentJson, TYPE_LABEL } from './store';
import { copyText } from './clipboard';
import ImportJsonDialog from './ImportJsonDialog.vue';

const text = computed(() => currentJson());
const msg = ref('');
const msgCls = ref('');
const importOpen = ref(false);

function say(t: string, cls = '') {
  msg.value = t;
  msgCls.value = cls;
  setTimeout(() => { if (msg.value === t) { msg.value = ''; msgCls.value = ''; } }, 2600);
}

async function copy() {
  try { await copyText(text.value); say('已复制到剪贴板', 'good'); }
  catch { say('复制失败，请手动全选复制', 'bad'); }
}

function onImported() {
  say('已导入并更新表单', 'good');
}
</script>

<template>
  <div class="json-view open">
    <div class="json-view-head">
      <span>{{ TYPE_LABEL[state.type] }} JSON（只读，作为数据源与对接用）</span>
      <span class="json-msg" :class="msgCls">{{ msg }}</span>
      <button class="btn" @click="copy">复制</button>
      <button class="btn primary" @click="importOpen = true">导入 JSON</button>
    </div>
    <pre class="json-read">{{ text }}</pre>
    <ImportJsonDialog v-model="importOpen" @imported="onImported" />
  </div>
</template>
