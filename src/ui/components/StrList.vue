<script setup lang="ts">
/**
 * 可增删的字符串列表（属性 / 用例 / 功能模块 / 生命线 / 二级功能）。
 * 用 v-model 双向绑定，新增后自动聚焦到新输入框。
 *
 * 注意：`modelValue` 可能是 undefined —— 手写的 JSON 里可选字段常常省略
 * （比如只写 `{ "name": "注册账号" }` 不写 includes），这里必须容错。
 */
import { computed, nextTick, ref } from 'vue';

const props = defineProps<{
  modelValue: string[] | undefined;
  addLabel?: string;
  placeholder?: string;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: string[]): void;
  (e: 'removed', index: number): void;
}>();

const root = ref<HTMLElement | null>(null);
const items = computed<string[]>(() => props.modelValue || []);

function setAt(i: number, ev: Event) {
  const next = [...items.value];
  next[i] = (ev.target as HTMLInputElement).value;
  emit('update:modelValue', next);
}

async function add() {
  emit('update:modelValue', [...items.value, '']);
  await nextTick();
  const inputs = root.value?.querySelectorAll<HTMLInputElement>('.strlist-row .inp');
  inputs?.[inputs.length - 1]?.focus();
}

function removeAt(i: number) {
  const next = [...items.value];
  next.splice(i, 1);
  emit('update:modelValue', next);
  emit('removed', i);
}
</script>

<template>
  <div ref="root" class="strlist">
    <div v-for="(v, i) in items" :key="i" class="strlist-row">
      <input class="inp" :value="v" :placeholder="placeholder" @input="setAt(i, $event)" />
      <button class="del-btn sm" type="button" title="删除这一项" @click="removeAt(i)">✕</button>
    </div>
    <div v-if="!items.length" class="fempty">（暂无）</div>
    <button class="add-line" type="button" @click="add">{{ addLabel || '＋ 添加一项' }}</button>
  </div>
</template>
