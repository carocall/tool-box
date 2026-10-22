<script setup lang="ts">
/**
 * 泳道图表单：泳道（列头）/ 阶段（行头）/ 节点 / 连线。
 * 位置用下拉选「第几条泳道 + 第几个阶段」，比填数字直观。
 */
import { computed, watch } from 'vue';
import FormSection from '../components/FormSection.vue';
import FormCard from '../components/FormCard.vue';
import FieldRow from '../components/FieldRow.vue';
import StrList from '../components/StrList.vue';
import { currentData, isSectionFolded, toggleSection, unfoldSection, isItemFolded, toggleItem, expandItem } from '../store';
import type { SwimData } from '../../core/types';

const data = computed<SwimData>(() => currentData.value as SwimData);
const KEY_L = 'swim:泳道';
const KEY_S = 'swim:阶段';
const KEY_N = 'swim:节点';
const KEY_E = 'swim:连线';

const KINDS = [
  { v: 'process', label: '处理（矩形）' },
  { v: 'decision', label: '判断（菱形）' },
  { v: 'io', label: '输入输出（平行四边形）' },
  { v: 'start', label: '开始（圆角）' },
  { v: 'end', label: '结束（圆角）' }
];
const kindLabel = (k?: string) => (KINDS.find(x => x.v === (k || 'process')) || KINDS[0]).label.replace(/（.*/, '');

// 删掉一条泳道 / 一个阶段后，把越界的节点夹回范围内
watch(() => data.value.lanes.length, n => data.value.nodes.forEach(x => { if (x.lane > n) x.lane = Math.max(1, n); }));
watch(() => data.value.stages.length, n => data.value.nodes.forEach(x => { if (x.stage > n) x.stage = Math.max(1, n); }));

function addNode() {
  unfoldSection(KEY_N);
  const n: any = {
    id: `n${data.value.nodes.length + 1}`,
    kind: 'process',
    text: '新步骤',
    lane: 1,
    stage: Math.min(data.value.stages.length, data.value.nodes.length + 1)
  };
  data.value.nodes.push(n);
  expandItem(n);
}
function removeNode(i: number) { data.value.nodes.splice(i, 1); }
function addEdge() {
  unfoldSection(KEY_E);
  const a = data.value.nodes[0], b = data.value.nodes[1] || data.value.nodes[0];
  const e: any = { from: a ? a.id : '', to: b ? b.id : '' };
  data.value.edges.push(e);
  expandItem(e);
}
function removeEdge(i: number) { data.value.edges.splice(i, 1); }
function nodeName(id: string) {
  return (data.value.nodes.find(n => n.id === id) || ({} as any)).text || id || '?';
}
function edgeTitle(e: any) {
  return `${nodeName(e.from)} → ${nodeName(e.to)}${e.label ? `（${e.label}）` : ''}`;
}
function nodeTitle(n: any) {
  const lane = data.value.lanes[n.lane - 1] || `第${n.lane}列`;
  const stage = data.value.stages[n.stage - 1] || `第${n.stage}行`;
  return `${lane} · ${stage}｜${n.text || '（未填）'}`;
}
</script>

<template>
  <FieldRow label="图标题">
    <input v-model="data.title" class="inp" placeholder="例如：员工报销审批流程" />
  </FieldRow>

  <FormSection
    title="泳道（列 = 谁负责）"
    :count="data.lanes.length"
    :folded="isSectionFolded(KEY_L)"
    @toggle="toggleSection(KEY_L)"
  >
    <div class="fsec-tip">从左到右的顺序就是泳道顺序，建议填角色 / 部门（员工、主管、财务），不要填动作。</div>
    <StrList v-model="data.lanes" add-label="＋ 添加泳道" placeholder="例如：主管" />
  </FormSection>

  <FormSection
    title="阶段（行 = 走到哪一步）"
    :count="data.stages.length"
    :folded="isSectionFolded(KEY_S)"
    @toggle="toggleSection(KEY_S)"
  >
    <div class="fsec-tip">从上到下的顺序就是流程顺序，建议填阶段名（提交申请、审核审批、付款归档）。</div>
    <StrList v-model="data.stages" add-label="＋ 添加阶段" placeholder="例如：审核审批" />
  </FormSection>

  <FormSection
    title="节点"
    :count="data.nodes.length"
    add-label="＋ 添加节点"
    :folded="isSectionFolded(KEY_N)"
    @toggle="toggleSection(KEY_N)"
    @add="addNode"
  >
    <div class="fsec-tip">每个节点选一个「泳道 + 阶段」，落在对应格子里；同一个格子可以放多个节点，按列表顺序自上而下叠。</div>
    <div v-if="!data.nodes.length" class="fempty">还没有节点，点右上角「＋ 添加节点」。</div>
    <FormCard
      v-for="(n, i) in data.nodes"
      :key="i"
      :title="nodeTitle(n)"
      :folded="isItemFolded(n)"
      @toggle="toggleItem(n)"
      @remove="removeNode(i)"
    >
      <FieldRow label="文字">
        <input v-model="n.text" class="inp" placeholder="例如：主管审批" />
      </FieldRow>
      <FieldRow label="类型">
        <select v-model="n.kind" class="inp sel">
          <option v-for="k in KINDS" :key="k.v" :value="k.v">{{ k.label }}</option>
        </select>
      </FieldRow>
      <FieldRow label="位置">
        <div class="grid-xy">
          <label>泳道 <select v-model.number="n.lane" class="inp sel sm">
            <option v-for="(name, li) in data.lanes" :key="li" :value="li + 1">{{ name || `第${li + 1}列` }}</option>
          </select></label>
          <label>阶段 <select v-model.number="n.stage" class="inp sel sm">
            <option v-for="(name, si) in data.stages" :key="si" :value="si + 1">{{ name || `第${si + 1}行` }}</option>
          </select></label>
        </div>
      </FieldRow>
      <FieldRow label="编号">
        <input v-model="n.id" class="inp" placeholder="连线用它引用，如 n1" />
      </FieldRow>
    </FormCard>
  </FormSection>

  <FormSection
    title="连线"
    :count="data.edges.length"
    add-label="＋ 添加连线"
    :folded="isSectionFolded(KEY_E)"
    @toggle="toggleSection(KEY_E)"
    @add="addEdge"
  >
    <div class="fsec-tip">跨泳道的线会自动走成正交折线；判断框出来的两条线记得填「是」「否」。</div>
    <div v-if="!data.edges.length" class="fempty">还没有连线，点右上角「＋ 添加连线」。</div>
    <FormCard
      v-for="(e, i) in data.edges"
      :key="i"
      :title="edgeTitle(e)"
      :folded="isItemFolded(e)"
      @toggle="toggleItem(e)"
      @remove="removeEdge(i)"
    >
      <FieldRow label="从">
        <select v-model="e.from" class="inp sel">
          <option v-for="n in data.nodes" :key="n.id" :value="n.id">{{ n.text || n.id }}（{{ n.id }}）</option>
        </select>
      </FieldRow>
      <FieldRow label="到">
        <select v-model="e.to" class="inp sel">
          <option v-for="n in data.nodes" :key="n.id" :value="n.id">{{ n.text || n.id }}（{{ n.id }}）</option>
        </select>
      </FieldRow>
      <FieldRow label="线上文字">
        <input v-model="e.label" class="inp" placeholder="例如：是 / 否" />
      </FieldRow>
      <FieldRow label="虚线">
        <input v-model="e.dash" type="checkbox" />
        <span style="color: var(--text-3); font-size: 12px; margin-left: 6px;">用于「驳回 / 退回」这类非主流程</span>
      </FieldRow>
    </FormCard>
  </FormSection>
</template>
