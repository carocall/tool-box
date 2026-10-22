<script setup lang="ts">
/** 时序图表单：生命线 + 消息 */
import { computed } from 'vue';
import FormSection from '../components/FormSection.vue';
import FormCard from '../components/FormCard.vue';
import StrList from '../components/StrList.vue';
import FieldRow from '../components/FieldRow.vue';
import { currentData, isSectionFolded, toggleSection, unfoldSection, isItemFolded, toggleItem, expandItem } from '../store';
import type { SequenceData } from '../../core/types';

const data = computed<SequenceData>(() => currentData.value as SequenceData);
const L_KEY = 'sequence:生命线';
const M_KEY = 'sequence:消息';

const KIND_OPTS = [
  { value: 'request', label: '请求（实线实心箭头）' },
  { value: 'return', label: '返回（虚线空心箭头）' },
  { value: 'self', label: '自调用（自己指向自己）' }
];

/** 参与方下拉：0 = 角色，1..n = 各生命线 */
const participants = computed(() => {
  const arr: { value: number; label: string }[] = [
    { value: 0, label: `角色：${data.value.actor || '（未命名）'}` }
  ];
  data.value.lifelines.forEach((n, i) => {
    arr.push({ value: i + 1, label: `${i + 1}. ${n || '（未命名）'}` });
  });
  return arr;
});

/** 删掉第 i 条生命线后，修正所有消息的参与方索引 */
function onLifelineRemoved(i: number) {
  const d = data.value;
  const max = d.lifelines.length; // 已删除后的合法最大索引
  d.messages.forEach(m => {
    (['from', 'to'] as const).forEach(p => {
      let v = Number(m[p]);
      if (!Number.isFinite(v)) v = 0;
      if (v === i + 1) v = 0;
      else if (v > i + 1) v -= 1;
      m[p] = Math.max(0, Math.min(max, v));
    });
  });
}

function addMessage() {
  unfoldSection(M_KEY);
  const m = {
    from: 0,
    to: Math.min(1, data.value.lifelines.length),
    text: `${data.value.messages.length + 1}.`,
    kind: 'request' as const
  };
  data.value.messages.push(m);
  expandItem(m);
}
function removeMessage(i: number) {
  data.value.messages.splice(i, 1);
}
</script>

<template>
  <FieldRow label="图标题">
    <input v-model="data.title" class="inp" placeholder="例如：用户登录模块时序图" />
  </FieldRow>
  <FieldRow label="角色名称（固定在最左列）">
    <input v-model="data.actor" class="inp" placeholder="例如：用户" />
  </FieldRow>

  <FormSection
    title="生命线"
    :count="data.lifelines.length"
    :folded="isSectionFolded(L_KEY)"
    @toggle="toggleSection(L_KEY)"
  >
    <div class="fsec-tip">生命线是参与交互的对象，从角色右侧开始依次排列。</div>
    <StrList
      v-model="data.lifelines"
      add-label="＋ 添加生命线"
      placeholder="例如：登录页"
      @removed="onLifelineRemoved"
    />
  </FormSection>

  <FormSection
    title="消息"
    :count="data.messages.length"
    add-label="＋ 添加消息"
    :folded="isSectionFolded(M_KEY)"
    @toggle="toggleSection(M_KEY)"
    @add="addMessage"
  >
    <div v-if="!data.lifelines.length" class="fsec-tip">请先添加生命线，再添加消息。</div>
    <template v-else>
      <div class="fsec-tip">「类型」决定箭头：请求＝实线实心，返回＝虚线空心，自调用＝自己指向自己。</div>
      <FormCard
        v-for="(m, i) in data.messages"
        :key="i"
        :title="`${i + 1}. ${m.text || '消息'}`"
        :folded="isItemFolded(m)"
        @toggle="toggleItem(m)"
        @remove="removeMessage(i)"
      >
        <FieldRow label="消息文字">
          <input v-model="m.text" class="inp" placeholder="例如：1.输入账号密码" />
        </FieldRow>
        <div class="f-grid2">
          <FieldRow label="从">
            <select v-model.number="m.from" class="inp sel">
              <option v-for="o in participants" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </FieldRow>
          <FieldRow label="到">
            <select v-model.number="m.to" class="inp sel">
              <option v-for="o in participants" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </FieldRow>
        </div>
        <FieldRow label="类型">
          <select v-model="m.kind" class="inp sel">
            <option v-for="o in KIND_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </FieldRow>
      </FormCard>
    </template>
  </FormSection>
</template>
