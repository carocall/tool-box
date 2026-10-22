<script setup lang="ts">
/**
 * 类图表单：类（三段式）+ 关系（6 种 UML 关系）。
 * 位置用「列 / 行」两个数字，框的大小按内容自动算。
 */
import { computed } from 'vue';
import FormSection from '../components/FormSection.vue';
import FormCard from '../components/FormCard.vue';
import FieldRow from '../components/FieldRow.vue';
import StrList from '../components/StrList.vue';
import { currentData, isSectionFolded, toggleSection, unfoldSection, isItemFolded, toggleItem, expandItem } from '../store';
import type { ClassData } from '../../core/types';

const data = computed<ClassData>(() => currentData.value as ClassData);
const KEY_C = 'class:类';
const KEY_R = 'class:关系';

const KINDS = [
  { v: 'extends', label: '继承（实线 + 空心三角）' },
  { v: 'implements', label: '实现（虚线 + 空心三角）' },
  { v: 'composition', label: '组合（实心菱形）' },
  { v: 'aggregation', label: '聚合（空心菱形）' },
  { v: 'association', label: '关联（实线）' },
  { v: 'dependency', label: '依赖（虚线 + 箭头）' }
];
const kindLabel = (k?: string) => (KINDS.find(x => x.v === (k || 'association')) || KINDS[4]).label.replace(/（.*/, '');

function addClass() {
  unfoldSection(KEY_C);
  const rows = data.value.classes.map(c => Number(c.row) || 0);
  const nextRow = rows.length ? Math.max(...rows) + 2 : 1;
  const c: any = {
    id: `C${data.value.classes.length + 1}`,
    name: `Class${data.value.classes.length + 1}`,
    attributes: ['+ id: Long'],
    methods: ['+ doSomething(): void'],
    col: 1,
    row: nextRow
  };
  data.value.classes.push(c);
  expandItem(c);
}
function removeClass(i: number) { data.value.classes.splice(i, 1); }
function addRel() {
  unfoldSection(KEY_R);
  const a = data.value.classes[0], b = data.value.classes[1] || data.value.classes[0];
  const r: any = { from: a ? a.id : '', to: b ? b.id : '', kind: 'association' };
  data.value.relations.push(r);
  expandItem(r);
}
function removeRel(i: number) { data.value.relations.splice(i, 1); }
function nameOf(id: string) {
  return (data.value.classes.find(c => c.id === id) || ({} as any)).name || id || '?';
}
function className(c: any) { return `${c.name || '未命名'}${c.stereotype ? ' ' + c.stereotype : ''}`; }
function relTitle(r: any) { return `${nameOf(r.from)} → ${nameOf(r.to)}（${kindLabel(r.kind)}）`; }
</script>

<template>
  <FieldRow label="图标题">
    <input v-model="data.title" class="inp" placeholder="例如：订单模块类图" />
  </FieldRow>

  <FormSection
    title="类"
    :count="data.classes.length"
    add-label="＋ 添加类"
    :folded="isSectionFolded(KEY_C)"
    @toggle="toggleSection(KEY_C)"
    @add="addClass"
  >
    <div class="fsec-tip">
      三段式类框：<b>类名 / 属性 / 方法</b>，属性和方法<b>一行一条</b>（如「+ id: Long」「+ pay(): void」）。
      位置填「列 / 行」，框的宽高按内容自动算。
    </div>
    <div v-if="!data.classes.length" class="fempty">还没有类，点右上角「＋ 添加类」。</div>
    <FormCard
      v-for="(c, i) in data.classes"
      :key="i"
      :title="className(c)"
      :folded="isItemFolded(c)"
      @toggle="toggleItem(c)"
      @remove="removeClass(i)"
    >
      <FieldRow label="类名">
        <input v-model="c.name" class="inp" placeholder="例如：OrderService" />
      </FieldRow>
      <FieldRow label="构造型">
        <select v-model="c.stereotype" class="inp sel">
          <option :value="''">（普通类）</option>
          <option value="<<interface>>">接口 &lt;&lt;interface&gt;&gt;</option>
          <option value="<<abstract>>">抽象类 &lt;&lt;abstract&gt;&gt;</option>
        </select>
      </FieldRow>
      <FieldRow label="位置">
        <div class="grid-xy">
          <label>列 <input v-model.number="c.col" class="inp num" type="number" step="1" min="1" /></label>
          <label>行 <input v-model.number="c.row" class="inp num" type="number" step="1" min="1" /></label>
        </div>
      </FieldRow>
      <FieldRow label="编号">
        <input v-model="c.id" class="inp" placeholder="连线用它引用，默认等于类名" />
      </FieldRow>
      <FieldRow label="属性">
        <StrList v-model="c.attributes" add-label="＋ 属性" placeholder="+ id: Long" />
      </FieldRow>
      <FieldRow label="方法">
        <StrList v-model="c.methods" add-label="＋ 方法" placeholder="+ pay(order: Order): boolean" />
      </FieldRow>
    </FormCard>
  </FormSection>

  <FormSection
    title="关系"
    :count="data.relations.length"
    add-label="＋ 添加关系"
    :folded="isSectionFolded(KEY_R)"
    @toggle="toggleSection(KEY_R)"
    @add="addRel"
  >
    <div class="fsec-tip">
      箭头指向 <b>to</b> 那一端：继承/实现指向父类或接口；组合/聚合的菱形画在 <b>from</b> 那一端（整体）。
    </div>
    <div v-if="!data.relations.length" class="fempty">还没有关系，点右上角「＋ 添加关系」。</div>
    <FormCard
      v-for="(r, i) in data.relations"
      :key="i"
      :title="relTitle(r)"
      :folded="isItemFolded(r)"
      @toggle="toggleItem(r)"
      @remove="removeRel(i)"
    >
      <FieldRow label="类型">
        <select v-model="r.kind" class="inp sel">
          <option v-for="k in KINDS" :key="k.v" :value="k.v">{{ k.label }}</option>
        </select>
      </FieldRow>
      <FieldRow label="从">
        <select v-model="r.from" class="inp sel">
          <option v-for="c in data.classes" :key="c.id" :value="c.id">{{ c.name || c.id }}</option>
        </select>
      </FieldRow>
      <FieldRow label="到">
        <select v-model="r.to" class="inp sel">
          <option v-for="c in data.classes" :key="c.id" :value="c.id">{{ c.name || c.id }}</option>
        </select>
      </FieldRow>
      <FieldRow label="关联名">
        <input v-model="r.label" class="inp" placeholder="例如：下达 / 包含（可留空）" />
      </FieldRow>
    </FormCard>
  </FormSection>
</template>
