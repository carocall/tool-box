/**
 * 全局状态（唯一数据源）。
 *
 * 设计要点：
 * - 四种图各自保存一份数据，切换页签不丢编辑；
 * - `data` 用 reactive 包裹，表单直接改它，预览由 computed 自动重算 —— 不需要手动“刷新”；
 * - 折叠状态不写进数据（避免污染 JSON 导出）：卡片用 Map<对象, boolean>，分区用 key 字典；
 * - **默认全部折叠**：折叠表里没有记录 = 折叠。只有显式写 false 才是展开，
 *   这样首次打开不会一屏塞满输入框，加新条目时再单独展开它。
 */
import { computed, reactive, ref } from 'vue';
import { SAMPLES, render, layout } from '../core';
import type { DiagramType, DiagramData, Diagram } from '../core/types';
import type { ScenePage } from '../core/scene';

export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

export const TYPE_LABEL: Record<DiagramType, string> = {
  er: 'ER图',
  usecase: '用例图',
  functional: '功能模块图',
  arch: '系统架构图',
  sequence: '时序图',
  flow: '流程图',
  swim: '泳道图'
};

/** 各类型的大分区 key（用于“全部折叠”） */
export const SECTION_KEYS: Record<DiagramType, string[]> = {
  er: ['er:实体', 'er:联系'],
  usecase: ['usecase:用例'],
  functional: ['functional:角色'],
  arch: ['arch:层次'],
  sequence: ['sequence:生命线', 'sequence:消息'],
  flow: ['flow:节点', 'flow:连线'],
  swim: ['swim:泳道', 'swim:阶段', 'swim:节点', 'swim:连线']
};

export const state = reactive({
  type: 'er' as DiagramType,
  zoom: 1,
  data: {
    er: clone(SAMPLES.er),
    usecase: clone(SAMPLES.usecase),
    functional: clone(SAMPLES.functional),
    arch: clone(SAMPLES.arch),
    sequence: clone(SAMPLES.sequence),
    flow: clone(SAMPLES.flow),
    swim: clone(SAMPLES.swim)
  } as Record<DiagramType, any>
});

/** 当前类型的数据（表单直接改这个对象） */
export const currentData = computed<any>(() => state.data[state.type]);

/* ------------------------------------------------------------------ *
 * 渲染结果
 * ------------------------------------------------------------------ */
export function isEmptyData(t: DiagramType, d: any): boolean {
  if (!d) return true;
  if (t === 'er') return !(d.entities || []).length;
  if (t === 'usecase') return !(d.usecases || []).length;
  if (t === 'functional') return !(d.roles || []).length;
  if (t === 'arch') return !(d.layers || []).length;
  if (t === 'flow' || t === 'swim') return !(d.nodes || []).length;
  return !(d.lifelines || []).length;
}

export const renderResult = computed<{ list: Diagram[]; error: string; empty: boolean }>(() => {
  const t = state.type;
  const d = state.data[t];
  if (!d) return { list: [], error: '', empty: true };
  if (isEmptyData(t, d)) return { list: [], error: '', empty: true };
  try {
    return { list: render(t, d as DiagramData), error: '', empty: false };
  } catch (e: any) {
    return { list: [], error: String(e?.message ?? e), empty: false };
  }
});

/** 当前所有图（ER 是多张） */
export const diagrams = computed<Diagram[]>(() => renderResult.value.list);

/** 当前所有场景（drawio 导出用；与 SVG 同源） */
export function currentScenes(): ScenePage[] {
  const t = state.type;
  const d = state.data[t];
  if (!d || isEmptyData(t, d)) return [];
  return layout(t, d as DiagramData);
}

/* ------------------------------------------------------------------ *
 * 折叠状态（默认折叠）
 * ------------------------------------------------------------------ */
export const collapsedSections = reactive<Record<string, boolean>>({});
export const collapsedItems = reactive(new Map<object, boolean>());
export const foldAllOn = ref(true);

export const isSectionFolded = (key: string): boolean => collapsedSections[key] !== false;
export function toggleSection(key: string) {
  collapsedSections[key] = !isSectionFolded(key);
}
export function unfoldSection(key: string) {
  collapsedSections[key] = false;
}
export function foldSection(key: string) {
  collapsedSections[key] = true;
}

export const isItemFolded = (obj: object): boolean => collapsedItems.get(obj) !== false;
export function toggleItem(obj: object) {
  collapsedItems.set(obj, !isItemFolded(obj));
}
/** 新建的条目要立刻展开（否则用户加完看不到输入框） */
export function expandItem(obj: object) {
  if (obj) collapsedItems.set(obj, false);
}

/** 全部折叠 / 全部展开 */
export function toggleFoldAll() {
  const next = !foldAllOn.value;
  foldAllOn.value = next;
  SECTION_KEYS[state.type].forEach(k => { collapsedSections[k] = next; });
  const d = state.data[state.type] || {};
  const mark = (arr: any[] = []) => arr.forEach(o => { if (o && typeof o === 'object') collapsedItems.set(o, next); });
  if (state.type === 'er') { mark(d.entities); mark(d.relations); }
  else if (state.type === 'functional') mark(d.roles);
  else if (state.type === 'arch') mark(d.layers);
  else if (state.type === 'usecase') mark(d.usecases);
  else if (state.type === 'sequence') mark(d.messages);
  else if (state.type === 'flow' || state.type === 'swim') { mark(d.nodes); mark(d.edges); }
}

/** 切到某类型时恢复“全部折叠”的初始观感 */
function resetFold(t: DiagramType) {
  foldAllOn.value = true;
  SECTION_KEYS[t].forEach(k => { collapsedSections[k] = true; });
}

/* ------------------------------------------------------------------ *
 * 类型切换 / 重置
 * ------------------------------------------------------------------ */
export function emptyData(t: DiagramType): any {
  if (t === 'er') return { title: '系统E-R图', entities: [], relations: [] };
  if (t === 'usecase') return { title: '用户用例图', actor: '用户', usecases: [] };
  if (t === 'functional') return { title: '系统', roles: [], layout: 'bottom' };
  if (t === 'arch') return { title: '系统总体架构', layers: [] };
  if (t === 'flow') return { title: '流程图', nodes: [], edges: [] };
  if (t === 'swim') return { title: '泳道图', lanes: ['角色A', '角色B'], stages: ['阶段一', '阶段二'], nodes: [], edges: [] };
  return { title: '时序图', actor: '用户', lifelines: [], messages: [] };
}

export function switchType(t: DiagramType) {
  if (state.type === t) return;
  state.type = t;
  resetFold(t);
}

export function loadSample() {
  state.data[state.type] = clone(SAMPLES[state.type]);
  resetFold(state.type);
}

export function clearCurrent() {
  state.data[state.type] = emptyData(state.type);
  resetFold(state.type);
}

/* ------------------------------------------------------------------ *
 * JSON 手动编辑
 * ------------------------------------------------------------------ */
const isStrArr = (v: any): boolean => Array.isArray(v) && v.every(x => typeof x === 'string');

/**
 * 校验并规整外部 JSON。
 * 只对「结构性问题」报错（用户能从提示里改），能补的字段就补默认值 —— 因为
 * 这段 JSON 往往是网页 AI 生成的，过于严格会让用户反复碰壁。
 */
export function normalizeData(t: DiagramType, raw: any): any {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('顶层必须是一个 JSON 对象 { … }');
  const out: any = {};

  if (t === 'er') {
    if (!Array.isArray(raw.entities)) throw new Error('缺少 entities 数组');
    out.title = String(raw.title ?? '系统E-R图');
    out.entities = raw.entities.map((e: any, i: number) => {
      if (typeof e === 'string') return { name: e, attributes: [] };
      if (!e || typeof e !== 'object' || typeof e.name !== 'string' || !e.name) {
        throw new Error(`entities[${i}] 缺少 name 字段`);
      }
      return { name: e.name, attributes: isStrArr(e.attributes) ? e.attributes : [] };
    });
    out.relations = Array.isArray(raw.relations) ? raw.relations.map((r: any, i: number) => {
      if (!r || typeof r !== 'object') throw new Error(`relations[${i}] 必须是对象`);
      if (typeof r.from !== 'string' || typeof r.to !== 'string') throw new Error(`relations[${i}] 缺少 from / to`);
      return {
        name: String(r.name ?? '关联'),
        from: r.from,
        to: r.to,
        fromCard: String(r.fromCard ?? '1'),
        toCard: String(r.toCard ?? 'n')
      };
    }) : [];
    return out;
  }

  if (t === 'usecase') {
    if (!Array.isArray(raw.usecases)) throw new Error('缺少 usecases 数组');
    out.title = String(raw.title ?? '用户用例图');
    out.actor = String(raw.actor ?? raw.user ?? '用户');
    out.usecases = raw.usecases.map((u: any, i: number) => {
      // 简写：直接给字符串（没有二级功能）
      if (typeof u === 'string') return { name: u, includes: [] };
      if (!u || typeof u !== 'object') throw new Error(`usecases[${i}] 必须是字符串或对象`);
      if (typeof u.name !== 'string' || !u.name) throw new Error(`usecases[${i}] 缺少 name 字段`);
      return {
        name: u.name,
        includes: isStrArr(u.includes) ? u.includes : []
      };
    });
    return out;
  }

  if (t === 'functional') {
    if (!Array.isArray(raw.roles)) throw new Error('缺少 roles 数组');
    out.title = String(raw.title ?? '系统');
    // layout 只认 split，其余一律按默认的「全部向下」处理
    out.layout = raw.layout === 'split' ? 'split' : 'bottom';
    out.roles = raw.roles.map((r: any, i: number) => {
      if (typeof r === 'string') return { name: r, modules: [] };
      if (!r || typeof r.name !== 'string') throw new Error(`roles[${i}] 缺少 name 字段`);
      return { name: r.name, modules: isStrArr(r.modules) ? r.modules : [] };
    });
    return out;
  }

  if (t === 'arch') {
    if (!Array.isArray(raw.layers)) throw new Error('缺少 layers 数组');
    out.title = String(raw.title ?? '系统架构图');
    out.layers = raw.layers.map((l: any, i: number) => {
      if (typeof l === 'string') return { name: l, items: [] };
      if (!l || typeof l.name !== 'string' || !l.name) throw new Error(`layers[${i}] 缺少 name 字段`);
      const items = Array.isArray(l.items) ? l.items.map((x: any) => {
        if (typeof x === 'string') return x;
        if (x && typeof x === 'object') return String(x.name ?? x.text ?? '');
        return String(x ?? '');
      }).filter(Boolean) : [];
      return { name: l.name, items };
    });
    return out;
  }

  if (t === 'flow') {
    if (!Array.isArray(raw.nodes)) throw new Error('缺少 nodes 数组');
    out.title = String(raw.title ?? '流程图');
    if (Number(raw.unit) > 0) out.unit = Number(raw.unit);
    // 故意宽松：坐标只做数字兜底，重叠之类交给 drawio 自己调
    const used = new Set<string>();
    out.nodes = raw.nodes.filter((n: any) => n && typeof n === 'object').map((n: any, i: number) => {
      let id = String(n.id ?? `n${i + 1}`);
      while (used.has(id)) id += '_';
      used.add(id);
      const shape = String(n.shape ?? n.type ?? 'process').toLowerCase();
      return {
        id,
        text: String(n.text ?? n.name ?? n.label ?? ''),
        shape: ['start', 'end', 'process', 'decision', 'io'].includes(shape) ? shape : 'process',
        col: Number.isFinite(Number(n.col)) ? Number(n.col) : 5,
        row: Number.isFinite(Number(n.row)) ? Number(n.row) : 1 + i * 2,
        ...(Number(n.w) > 0 ? { w: Number(n.w) } : {})
      };
    });
    out.edges = (Array.isArray(raw.edges) ? raw.edges : [])
      .filter((e: any) => e && typeof e === 'object' && e.from != null && e.to != null)
      .map((e: any) => ({
        from: String(e.from),
        to: String(e.to),
        ...(e.label ? { label: String(e.label) } : {}),
        ...(e.dash ? { dash: true } : {})
      }));
    return out;
  }

  if (t === 'swim') {
    if (!Array.isArray(raw.nodes)) throw new Error('缺少 nodes 数组');
    out.title = String(raw.title ?? '泳道图');
    const names = (arr: any, fallback: string[]) => {
      const list = (Array.isArray(arr) ? arr : [])
        .map((x: any) => (typeof x === 'string' ? x : String(x?.name ?? x?.text ?? '')))
        .filter(Boolean);
      return list.length ? list : fallback;
    };
    out.lanes = names(raw.lanes, ['角色A', '角色B']);
    out.stages = names(raw.stages, ['阶段一', '阶段二']);
    const used = new Set<string>();
    out.nodes = raw.nodes.filter((n: any) => n && typeof n === 'object').map((n: any, i: number) => {
      let id = String(n.id ?? `n${i + 1}`);
      while (used.has(id)) id += '_';
      used.add(id);
      const kind = String(n.kind ?? n.shape ?? 'process').toLowerCase();
      const lane = Math.round(Number(n.lane) || 1);
      const stage = Math.round(Number(n.stage) || 1);
      return {
        id,
        text: String(n.text ?? n.name ?? ''),
        kind: ['start', 'end', 'process', 'decision', 'io'].includes(kind) ? kind : 'process',
        lane: Math.min(Math.max(lane, 1), out.lanes.length),
        stage: Math.min(Math.max(stage, 1), out.stages.length)
      };
    });
    out.edges = (Array.isArray(raw.edges) ? raw.edges : [])
      .filter((e: any) => e && typeof e === 'object' && e.from != null && e.to != null)
      .map((e: any) => ({
        from: String(e.from),
        to: String(e.to),
        ...(e.label ? { label: String(e.label) } : {}),
        ...(e.dash ? { dash: true } : {})
      }));
    return out;
  }

  // sequence
  if (!Array.isArray(raw.lifelines)) throw new Error('缺少 lifelines 数组');
  if (!Array.isArray(raw.messages)) throw new Error('缺少 messages 数组');
  out.title = String(raw.title ?? '时序图');
  out.actor = String(raw.actor ?? '用户');
  out.lifelines = raw.lifelines.map((l: any, i: number) => {
    if (typeof l === 'string') return l;
    if (l && typeof l.name === 'string') return l.name;
    throw new Error(`lifelines[${i}] 必须是字符串`);
  });
  const max = out.lifelines.length;
  out.messages = raw.messages.map((m: any, i: number) => {
    if (!m || typeof m !== 'object') throw new Error(`messages[${i}] 必须是对象`);
    const from = Number(m.from), to = Number(m.to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) throw new Error(`messages[${i}] 的 from / to 必须是数字`);
    if (from < 0 || from > max || to < 0 || to > max) {
      throw new Error(`messages[${i}] 的 from/to 超出范围（合法值 0~${max}）`);
    }
    const kind = String(m.kind ?? 'request').toLowerCase();
    return {
      from, to,
      text: String(m.text ?? ''),
      kind: kind === 'return' || kind === 'reply' || kind === 'resp' ? 'return'
        : kind === 'self' ? 'self' : 'request'
    };
  });
  return out;
}

/** 把 JSON 文本应用到当前类型（失败抛错，由调用方展示） */
export function applyJson(text: string): void {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch (e: any) {
    throw new Error('JSON 语法错误：' + (e?.message ?? e));
  }
  state.data[state.type] = normalizeData(state.type, raw);
  resetFold(state.type);
}

/** 当前数据 → 可编辑的 JSON 文本 */
export function currentJson(): string {
  return JSON.stringify(currentData.value, null, 2);
}
