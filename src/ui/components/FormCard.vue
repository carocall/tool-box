<script setup lang="ts">
/** 可折叠条目卡片：标题条（点任意处折叠）+ 右上角删除 */
withDefaults(defineProps<{
  title: string;
  folded: boolean;
  removable?: boolean;
}>(), { removable: true });
const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'remove'): void;
}>();
</script>

<template>
  <div class="fcard" :class="{ folded }">
    <div class="fcard-head" @click="emit('toggle')">
      <button class="fold-btn" type="button" :title="folded ? '展开' : '折叠'">{{ folded ? '▸' : '▾' }}</button>
      <span class="fcard-title">{{ title }}</span>
      <button v-if="removable" class="del-btn" type="button" title="删除" @click.stop="emit('remove')">✕</button>
    </div>
    <div v-show="!folded" class="fcard-body"><slot /></div>
  </div>
</template>
