<script setup lang="ts">
/** 用例图表单：一个角色 + 若干用例（每个用例可以挂若干"二级功能"） */
import { computed } from 'vue';
import FormSection from '../components/FormSection.vue';
import FormCard from '../components/FormCard.vue';
import StrList from '../components/StrList.vue';
import FieldRow from '../components/FieldRow.vue';
import { currentData, isSectionFolded, toggleSection, unfoldSection, isItemFolded, toggleItem, expandItem } from '../store';
import type { UsecaseData } from '../../core/types';

const data = computed<UsecaseData>(() => currentData.value as UsecaseData);
const KEY = 'usecase:用例';

function addUsecase() {
  unfoldSection(KEY);
  const u = { name: `用例${data.value.usecases.length + 1}`, includes: [] as string[] };
  data.value.usecases.push(u);
  expandItem(u);
}
function removeUsecase(i: number) {
  data.value.usecases.splice(i, 1);
}
const childCount = (u: any) => (u && u.includes ? u.includes.length : 0);
</script>

<template>
  <FieldRow label="图标题">
    <input v-model="data.title" class="inp" placeholder="例如：用户用例图" />
  </FieldRow>
  <FieldRow label="角色名称">
    <input v-model="data.actor" class="inp" placeholder="例如：用户" />
  </FieldRow>

  <FormSection
    title="用例"
    :count="data.usecases.length"
    add-label="＋ 添加用例"
    :folded="isSectionFolded(KEY)"
    @toggle="toggleSection(KEY)"
    @add="addUsecase"
  >
    <div class="fsec-tip">
      每个用例画成一个椭圆，角色与每个用例相连。<br />
      「二级功能」会画在右边一列，用带 <code>&lt;&lt;include&gt;&gt;</code> 的虚线连过来；不填就是单列。
    </div>
    <div v-if="!data.usecases.length" class="fempty">还没有用例，点右上角「＋ 添加用例」。</div>
    <FormCard
      v-for="(u, i) in data.usecases"
      :key="i"
      :title="(u.name || `用例 ${i + 1}`) + (childCount(u) ? `（${childCount(u)} 项二级功能）` : '')"
      :folded="isItemFolded(u)"
      @toggle="toggleItem(u)"
      @remove="removeUsecase(i)"
    >
      <FieldRow label="用例名称">
        <input v-model="u.name" class="inp" placeholder="例如：实验室预约审批" />
      </FieldRow>
      <FieldRow label="二级功能（可选）">
        <StrList v-model="u.includes" add-label="＋ 添加二级功能" placeholder="例如：审核学生实验室预约" />
      </FieldRow>
    </FormCard>
  </FormSection>
</template>
