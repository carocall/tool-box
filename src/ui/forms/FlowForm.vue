<script setup lang="ts">
/**
 * 流程图表单：节点（网格坐标）+ 连线。
 * 位置用手填的「列 / 行」，不提供拖拽 —— 觉得不好看就导进 draw.io 自己拖。
 */
import { computed } from 'vue';
import FormSection from '../components/FormSection.vue';
import FormCard from '../components/FormCard.vue';
import FieldRow from '../components/FieldRow.vue';
import { currentData, isSectionFolded, toggleSection, unfoldSection, isItemFolded, toggleItem, expandItem } from '../store';
import type { FlowData } from '../../core/types';

const data = computed<FlowData>(() => currentData.value as FlowData);
const KEY_N = 'flow:节点';
const KEY_E = 'flow:连线';

const SHAPES = [
  { v: 'start', label: '开始 / 结束（圆角）' },
  { v: 'process', label: '处理（矩形）' },
  { v: 'decision', label: '判断（菱形）' },
  { v: 'io', label: '输入输出（平行四边形）' }
];

/** 节点显示名：按形状给个前缀，一眼能认出是开始还是判断 */
function shapeLabel(s?: string) {
  return ({ start: '开始', end: '结束', decision: '判断', io: '输入输出' } as any)[s || 'process'] || '处理';
}

function addNode() {
  unfoldSection(KEY_N);
  const rows = data.value.nodes.map(n => Number(n.row) || 0);
  const nextRow = rows.length ? Math.max(...rows) + 2 : 1;
  const n: any = { id: `n${data.value.nodes.length + 1}`, shape: 'process', text: '新步骤', col: 5, row: nextRow };
  data.value.nodes.push(n);
  expandItem(n);
}
function removeNode(i: number) {
  data.value.nodes.splice(i, 1);
}
function addEdge() {
  unfoldSection(KEY_E);
  const a = data.value.nodes[0], b = data.value.nodes[1] || data.value.nodes[0];
  const e: any = { from: a ? a.id : '', to: b ? b.id : '' };
  data.value.edges.push(e);
  expandItem(e);
}
function removeEdge(i: number) {
  data.value.edges.splice(i, 1);
}
/** 连线标题：从哪到哪 + 标注 */
function edgeTitle(e: any) {
  const nm = (id: string) => (data.value.nodes.find(n => n.id === id) || ({} as any)).text || id || '?';
  return `${nm(e.from)} → ${nm(e.to)}${e.label ? `（${e.label}）` : ''}`;
}
</script>

<template>
  <FieldRow label="图标题">
    <input v-model="data.title" class="inp" placeholder="例如：用户下单流程" />
  </FieldRow>

  <FormSection
    title="节点"
    :count="data.nodes.length"
    add-label="＋ 添加节点"
    :folded="isSectionFolded(KEY_N)"
    @toggle="toggleSection(KEY_N)"
    @add="addNode"
  >
    <div class="fsec-tip">
      位置用<b>网格坐标</b>：同一行的节点填同一个行号、同一列的填同一个列号，引擎会自动对齐；<b>框的大小按文字自动算</b>。
      相邻节点行号至少差 2（判断框前后差 3），分支横向错开 6 列。
    </div>
    <div v-if="!data.nodes.length" class="fempty">还没有节点，点右上角「＋ 添加节点」。</div>
    <FormCard
      v-for="(n, i) in data.nodes"
      :key="i"
      :title="`${shapeLabel(n.shape)}：${n.text || '（未填）'}`"
      :folded="isItemFolded(n)"
      @toggle="toggleItem(n)"
      @remove="removeNode(i)"
    >
      <FieldRow label="文字">
        <input v-model="n.text" class="inp" placeholder="例如：审核学生预约" />
      </FieldRow>
      <FieldRow label="形状">
        <select v-model="n.shape" class="inp sel">
          <option v-for="s in SHAPES" :key="s.v" :value="s.v">{{ s.label }}</option>
        </select>
      </FieldRow>
      <FieldRow label="位置">
        <div class="grid-xy">
          <label>列 <input v-model.number="n.col" class="inp num" type="number" step="1" /></label>
          <label>行 <input v-model.number="n.row" class="inp num" type="number" step="1" /></label>
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
    <div class="fsec-tip">判断框出来的两条线记得填「是」「否」。箭头默认从上往下，反过来画就自动朝上。</div>
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
        <span style="color: var(--text-3); font-size: 12px; margin-left: 6px;">用于「重试 / 返回」这类非主流程</span>
      </FieldRow>
    </FormCard>
  </FormSection>
</template>
