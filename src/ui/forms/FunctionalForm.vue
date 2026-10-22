<script setup lang="ts">
/** 功能模块图表单：系统名 + 角色（每个角色挂一串模块） */
import { computed } from 'vue';
import FormSection from '../components/FormSection.vue';
import FormCard from '../components/FormCard.vue';
import StrList from '../components/StrList.vue';
import FieldRow from '../components/FieldRow.vue';
import { currentData, isSectionFolded, toggleSection, unfoldSection, isItemFolded, toggleItem, expandItem } from '../store';
import type { FunctionalData } from '../../core/types';

const data = computed<FunctionalData>(() => currentData.value as FunctionalData);
const KEY = 'functional:角色';

/** 布局方式：默认全部向下；split = 模块分列系统上下两侧 */
const layoutMode = computed({
  get: () => (data.value.layout === 'split' ? 'split' : 'bottom'),
  set: (v: string) => { data.value.layout = v === 'split' ? 'split' : 'bottom'; }
});

function addRole() {
  unfoldSection(KEY);
  const r = { name: `分组${data.value.roles.length + 1}`, modules: [] };
  data.value.roles.push(r);
  expandItem(r);
}
function removeRole(i: number) {
  data.value.roles.splice(i, 1);
}
</script>

<template>
  <FieldRow label="系统名称">
    <input v-model="data.title" class="inp" placeholder="例如：基于Spring Boot+Vue的电商系统" />
  </FieldRow>

  <FieldRow label="布局方式">
    <select v-model="layoutMode" class="inp sel">
      <option value="bottom">全部向下（系统在上，模块在下）</option>
      <option value="split">上下布局（模块分列系统两侧）</option>
    </select>
  </FieldRow>

  <FormSection
    title="分组与功能模块"
    :count="data.roles.length"
    add-label="＋ 添加分组"
    :folded="isSectionFolded(KEY)"
    @toggle="toggleSection(KEY)"
    @add="addRole"
  >
    <div class="fsec-tip">第二层可以按<b>用户角色</b>分（学生端 / 教师端 / 管理端），也可以按<b>功能模块</b>分（用户管理 / 设备管理）；
        每组下方挂一排竖排方块，就是该组的功能模块。</div>
    <div v-if="!data.roles.length" class="fempty">还没有分组，点右上角「＋ 添加分组」。</div>
    <FormCard
      v-for="(role, i) in data.roles"
      :key="i"
      :title="role.name || `分组 ${i + 1}`"
      :folded="isItemFolded(role)"
      @toggle="toggleItem(role)"
      @remove="removeRole(i)"
    >
      <FieldRow label="分组名称">
        <input v-model="role.name" class="inp" placeholder="例如：管理员 / 学生端 / 用户管理" />
      </FieldRow>
      <FieldRow label="功能模块">
        <StrList v-model="role.modules" add-label="＋ 添加模块" placeholder="例如：账号管理" />
      </FieldRow>
    </FormCard>
  </FormSection>
</template>
