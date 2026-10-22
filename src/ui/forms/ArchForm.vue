<script setup lang="ts">
/** 系统架构图表单：一条横带 = 一层 */
import { computed } from 'vue';
import FormSection from '../components/FormSection.vue';
import FormCard from '../components/FormCard.vue';
import StrList from '../components/StrList.vue';
import FieldRow from '../components/FieldRow.vue';
import { currentData, isSectionFolded, toggleSection, unfoldSection, isItemFolded, toggleItem, expandItem } from '../store';
import type { ArchitectureData } from '../../core/types';

const data = computed<ArchitectureData>(() => currentData.value as ArchitectureData);
const KEY = 'arch:层次';

function addLayer() {
  unfoldSection(KEY);
  const l = { name: `第${data.value.layers.length + 1}层`, items: [] as string[] };
  data.value.layers.push(l);
  expandItem(l);
}
function removeLayer(i: number) {
  data.value.layers.splice(i, 1);
}
</script>

<template>
  <FieldRow label="图标题">
    <input v-model="data.title" class="inp" placeholder="例如：系统总体架构" />
  </FieldRow>

  <FormSection
    title="层次"
    :count="data.layers.length"
    add-label="＋ 添加层次"
    :folded="isSectionFolded(KEY)"
    @toggle="toggleSection(KEY)"
    @add="addLayer"
  >
    <div class="fsec-tip">顺序就是从上到下的顺序（第一个画在最上面）；带内填该层的组件或技术。</div>
    <div v-if="!data.layers.length" class="fempty">还没有层次，点右上角「＋ 添加层次」。</div>
    <FormCard
      v-for="(l, i) in data.layers"
      :key="i"
      :title="l.name || `第 ${i + 1} 层`"
      :folded="isItemFolded(l)"
      @toggle="toggleItem(l)"
      @remove="removeLayer(i)"
    >
      <FieldRow label="层名称">
        <input v-model="l.name" class="inp" placeholder="例如：表现层 / 业务层 / 数据层" />
      </FieldRow>
      <FieldRow label="该层的组件 / 技术">
        <StrList v-model="l.items" add-label="＋ 添加组件" placeholder="例如：Web 前端" />
      </FieldRow>
    </FormCard>
  </FormSection>
</template>
