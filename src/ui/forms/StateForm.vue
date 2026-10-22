<script setup lang="ts">
/**
 * 状态图表单：状态（起始圆 / 圆角状态 / 终止圆）+ 迁移（事件）。
 */
import { computed } from 'vue';
import FormSection from '../components/FormSection.vue';
import FormCard from '../components/FormCard.vue';
import FieldRow from '../components/FieldRow.vue';
import { currentData, isSectionFolded, toggleSection, unfoldSection, isItemFolded, toggleItem, expandItem } from '../store';
import type { StateData } from '../../core/types';

const data = computed<StateData>(() => currentData.value as StateData);
const KEY_S = 'state:状态';
const KEY_T = 'state:迁移';

const KINDS = [
  { v: 'state', label: '状态（圆角框）' },
  { v: 'initial', label: '起始（实心圆）' },
  { v: 'final', label: '终止（双圆）' }
];
const kindLabel = (k?: string) => (KINDS.find(x => x.v === (k || 'state')) || KINDS[0]).label.replace(/（.*/, '');

function addNode(kind = 'state') {
  unfoldSection(KEY_S);
  const n: any = kind === 'state'
    ? { id: `s${data.value.nodes.length + 1}`, text: '新状态', kind: 'state', col: data.value.nodes.length + 1, row: 1 }
    : { id: `s${data.value.nodes.length + 1}`, text: '', kind, col: data.value.nodes.length + 1, row: 1 };
  data.value.nodes.push(n);
  expandItem(n);
}
function removeNode(i: number) { data.value.nodes.splice(i, 1); }
function addTrans() {
  unfoldSection(KEY_T);
  const a = data.value.nodes[0], b = data.value.nodes[1] || data.value.nodes[0];
  const t: any = { from: a ? a.id : '', to: b ? b.id : '', label: '事件' };
  data.value.transitions.push(t);
  expandItem(t);
}
function removeTrans(i: number) { data.value.transitions.splice(i, 1); }
function nameOf(id: string) {
  const n = data.value.nodes.find(x => x.id === id);
  if (!n) return id || '?';
  return n.kind === 'initial' ? '● 起始' : n.kind === 'final' ? '◉ 终止' : (n.text || n.id);
}
function nodeTitle(n: any) {
  return `${kindLabel(n.kind)}｜${n.kind === 'state' ? (n.text || '（未填）') : nameOf(n.id)}`;
}
function transTitle(t: any) {
  return `${nameOf(t.from)} → ${nameOf(t.to)}${t.label ? `（${t.label}）` : ''}`;
}
</script>

<template>
  <FieldRow label="图标题">
    <input v-model="data.title" class="inp" placeholder="例如：订单状态图" />
  </FieldRow>

  <FormSection
    title="状态"
    :count="data.nodes.length"
    add-label="＋ 添加状态"
    :folded="isSectionFolded(KEY_S)"
    @toggle="toggleSection(KEY_S)"
    @add="addNode()"
  >
    <div class="fsec-tip">
      圆角框是普通状态；<b>起始</b>是实心小圆（一个状态图只该有一个）、<b>终止</b>是双圆。
      位置填「列 / 行」，主干建议都放在行 1、列依次加 1。
    </div>
    <div v-if="!data.nodes.length" class="fempty">还没有状态，点右上角「＋ 添加状态」。</div>
    <FormCard
      v-for="(n, i) in data.nodes"
      :key="i"
      :title="nodeTitle(n)"
      :folded="isItemFolded(n)"
      @toggle="toggleItem(n)"
      @remove="removeNode(i)"
    >
      <FieldRow label="类型">
        <select v-model="n.kind" class="inp sel">
          <option v-for="k in KINDS" :key="k.v" :value="k.v">{{ k.label }}</option>
        </select>
      </FieldRow>
      <FieldRow v-if="n.kind === 'state'" label="状态名">
        <input v-model="n.text" class="inp" placeholder="例如：待付款" />
      </FieldRow>
      <FieldRow label="位置">
        <div class="grid-xy">
          <label>列 <input v-model.number="n.col" class="inp num" type="number" step="1" min="1" /></label>
          <label>行 <input v-model.number="n.row" class="inp num" type="number" step="1" min="1" /></label>
        </div>
      </FieldRow>
      <FieldRow label="编号">
        <input v-model="n.id" class="inp" placeholder="迁移用它引用，如 s1" />
      </FieldRow>
    </FormCard>
  </FormSection>

  <FormSection
    title="迁移"
    :count="data.transitions.length"
    add-label="＋ 添加迁移"
    :folded="isSectionFolded(KEY_T)"
    @toggle="toggleSection(KEY_T)"
    @add="addTrans"
  >
    <div class="fsec-tip">
      箭头上的文字是<b>触发事件</b>（「支付成功」「发货」）。从和到选同一个状态，会画成右侧的小回路（表示重试 / 催付）。
    </div>
    <div v-if="!data.transitions.length" class="fempty">还没有迁移，点右上角「＋ 添加迁移」。</div>
    <FormCard
      v-for="(t, i) in data.transitions"
      :key="i"
      :title="transTitle(t)"
      :folded="isItemFolded(t)"
      @toggle="toggleItem(t)"
      @remove="removeTrans(i)"
    >
      <FieldRow label="从">
        <select v-model="t.from" class="inp sel">
          <option v-for="n in data.nodes" :key="n.id" :value="n.id">{{ nameOf(n.id) }}（{{ n.id }}）</option>
        </select>
      </FieldRow>
      <FieldRow label="到">
        <select v-model="t.to" class="inp sel">
          <option v-for="n in data.nodes" :key="n.id" :value="n.id">{{ nameOf(n.id) }}（{{ n.id }}）</option>
        </select>
      </FieldRow>
      <FieldRow label="事件">
        <input v-model="t.label" class="inp" placeholder="例如：支付成功" />
      </FieldRow>
      <FieldRow label="虚线">
        <input v-model="t.dash" type="checkbox" />
        <span style="color: var(--text-3); font-size: 12px; margin-left: 6px;">一般不用；超时 / 异常可用</span>
      </FieldRow>
    </FormCard>
  </FormSection>
</template>
