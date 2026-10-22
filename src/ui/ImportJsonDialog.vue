<script setup lang="ts">
/**
 * 「导入 JSON」弹窗。
 *
 * 为什么要有这一步：JSON 面板本身（`JsonPanel.vue`）是**只读**的，
 * 用户不能对着实时数据直接敲键盘 —— 一不小心删个引号，整张图就没了。
 * 这里是一个**暂存区**：粘进来、校验通过才替换数据，失败就什么都不改。
 */
import { ref, watch } from 'vue';
import { state, applyJson, currentJson, TYPE_LABEL } from './store';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'imported'): void }>();

const draft = ref('');
const err = ref('');
const ok = ref('');

watch(() => props.modelValue, open => {
  if (!open) return;
  draft.value = currentJson();   // 打开时带上当前数据，方便在现有基础上改
  err.value = '';
  ok.value = '';
});

function close() { emit('update:modelValue', false); }

function doImport() {
  err.value = '';
  ok.value = '';
  try {
    applyJson(draft.value);
    ok.value = '导入成功 ✓ 表单与预览已按新数据重建';
    emit('imported');
    setTimeout(close, 420);
  } catch (e: any) {
    err.value = (e?.message ?? String(e)) + '';
  }
}

function resetToCurrent() {
  draft.value = currentJson();
  err.value = '';
  ok.value = '';
}

function onKey(ev: KeyboardEvent) {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); doImport(); }
}
</script>

<template>
  <div class="mask" :class="{ show: modelValue }" @click.self="close">
    <div class="modal import-modal">
      <div class="modal-head">
        <h3>导入 {{ TYPE_LABEL[state.type] }} JSON</h3>
        <span class="sub">校验通过才会替换当前数据；失败不会改动任何东西</span>
      </div>
      <div class="modal-body">
        <textarea
          v-model="draft"
          class="import-area"
          spellcheck="false"
          placeholder="把 JSON 粘贴到这里…"
          @keydown="onKey"
        ></textarea>
        <div class="import-tip">
          支持网页版 AI 生成的 JSON。字段缺失会自动补默认值，结构错误会指出具体位置。
        </div>
      </div>
      <div class="modal-foot">
        <span class="msg" :class="{ bad: !!err, good: !!ok }">{{ err || ok }}</span>
        <button class="btn" @click="resetToCurrent">还原当前数据</button>
        <button class="btn" @click="close">取消</button>
        <button class="btn primary" @click="doImport">校验并导入</button>
      </div>
    </div>
  </div>
</template>
