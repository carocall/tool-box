<script setup lang="ts">
/** ER 图（分离式）表单：实体 + 联系 */
import { computed } from 'vue';
import FormSection from '../components/FormSection.vue';
import FormCard from '../components/FormCard.vue';
import StrList from '../components/StrList.vue';
import FieldRow from '../components/FieldRow.vue';
import { currentData, isSectionFolded, toggleSection, unfoldSection, isItemFolded, toggleItem, expandItem } from '../store';
import type { ERData, EREntity } from '../../core/types';

const data = computed<ERData>(() => currentData.value as ERData);
const ENT_KEY = 'er:实体';
const REL_KEY = 'er:联系';

const CARD_OPTS = [
  { value: '1', label: '1（一）' },
  { value: 'n', label: 'n（多）' }
];

const entityOptions = computed(() =>
  data.value.entities.map(e => ({ value: e.name, label: e.name || '（未命名实体）' }))
);

function addEntity() {
  unfoldSection(ENT_KEY);
  const e = { name: `实体${data.value.entities.length + 1}`, attributes: [] };
  data.value.entities.push(e);
  expandItem(e);          // 新建的卡片直接展开，省一次点击
}

function removeEntity(i: number) {
  const gone = data.value.entities[i];
  data.value.entities.splice(i, 1);
  if (gone) {
    // 删实体时同步清掉悬空联系
    data.value.relations = data.value.relations.filter(r => r.from !== gone.name && r.to !== gone.name);
  }
}

/** 改名要联动更新联系里引用的实体名 */
function renameEntity(e: EREntity, ev: Event) {
  const v = (ev.target as HTMLInputElement).value;
  const old = e.name;
  e.name = v;
  if (old === v) return;
  data.value.relations.forEach(r => {
    if (r.from === old) r.from = v;
    if (r.to === old) r.to = v;
  });
}

function addRelation() {
  unfoldSection(REL_KEY);
  const names = data.value.entities.map(e => e.name);
  const r: any = {
    name: '关联',
    from: names[0] || '',
    to: names[1] || names[0] || '',
    fromCard: '1',
    toCard: 'n'
  };
  data.value.relations.push(r);
  expandItem(r);
}

function removeRelation(i: number) {
  data.value.relations.splice(i, 1);
}
</script>

<template>
  <FieldRow label="图标题">
    <input v-model="data.title" class="inp" placeholder="例如：系统E-R图" />
  </FieldRow>

  <FormSection
    title="实体"
    :count="data.entities.length"
    add-label="＋ 添加实体"
    :folded="isSectionFolded(ENT_KEY)"
    @toggle="toggleSection(ENT_KEY)"
    @add="addEntity"
  >
    <div v-if="!data.entities.length" class="fsec-tip">还没有实体，点右上角「＋ 添加实体」开始。</div>
    <FormCard
      v-for="(e, i) in data.entities"
      :key="i"
      :title="e.name || `实体 ${i + 1}`"
      :folded="isItemFolded(e)"
      @toggle="toggleItem(e)"
      @remove="removeEntity(i)"
    >
      <FieldRow label="实体名称">
        <input class="inp" :value="e.name" placeholder="例如：用户" @input="renameEntity(e, $event)" />
      </FieldRow>
      <FieldRow label="属性（每条一个）">
        <StrList v-model="e.attributes" add-label="＋ 添加属性" placeholder="例如：用户编号" />
      </FieldRow>
    </FormCard>
  </FormSection>

  <FormSection
    title="联系"
    :count="data.relations.length"
    add-label="＋ 添加联系"
    :folded="isSectionFolded(REL_KEY)"
    @toggle="toggleSection(REL_KEY)"
    @add="addRelation"
  >
    <div v-if="!data.entities.length" class="fsec-tip">请先在上方添加实体，再回来添加联系。</div>
    <template v-else>
      <div class="fsec-tip">联系是连接两个实体的菱形；基数选「1」表示一对一，选「n」表示多。</div>
      <FormCard
        v-for="(r, i) in data.relations"
        :key="i"
        :title="r.name || `联系 ${i + 1}`"
        :folded="isItemFolded(r)"
        @toggle="toggleItem(r)"
        @remove="removeRelation(i)"
      >
        <FieldRow label="联系名称">
          <input v-model="r.name" class="inp" placeholder="例如：拥有 / 下达" />
        </FieldRow>
        <div class="f-grid2">
          <FieldRow label="起点实体">
            <select v-model="r.from" class="inp sel">
              <option v-for="o in entityOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </FieldRow>
          <FieldRow label="终点实体">
            <select v-model="r.to" class="inp sel">
              <option v-for="o in entityOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </FieldRow>
        </div>
        <div class="f-grid2">
          <FieldRow label="起点基数">
            <select v-model="r.fromCard" class="inp sel">
              <option v-for="o in CARD_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </FieldRow>
          <FieldRow label="终点基数">
            <select v-model="r.toCard" class="inp sel">
              <option v-for="o in CARD_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </FieldRow>
        </div>
      </FormCard>
    </template>
  </FormSection>
</template>
