<script setup lang="ts">
/** 可折叠分区：标题 + 计数 + 右上角添加按钮 */
defineProps<{
  title: string;
  count?: number;
  addLabel?: string;
  folded: boolean;
}>();
const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'add'): void;
}>();
</script>

<template>
  <div class="fsec" :class="{ folded }">
    <div class="fsec-head" @click="emit('toggle')">
      <button class="fold-btn" type="button" :title="folded ? '展开' : '折叠'">{{ folded ? '▸' : '▾' }}</button>
      <div class="fsec-title">
        {{ title }}
        <span v-if="count != null" class="fsec-count">{{ count }}</span>
      </div>
      <button v-if="addLabel" class="add-btn" type="button" @click.stop="emit('add')">{{ addLabel }}</button>
    </div>
    <div v-show="!folded" class="fsec-body"><slot /></div>
  </div>
</template>
