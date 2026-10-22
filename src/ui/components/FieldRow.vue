<script setup lang="ts">
/** 一行「标签 + 控件」 */
defineProps<{ label: string }>();
</script>

<template>
  <div class="fld">
    <label class="fld-label">{{ label }}</label>
    <slot />
  </div>
</template>
