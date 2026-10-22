/**
 * 全项目唯一的数据契约。
 *
 * 约定：
 * - 表单层产出、渲染器消费的都是这里定义的形状；
 * - 新增字段必须同时更新：本文件、表单、示例数据、提示词（core/prompts.ts）；
 * - 渲染器是纯函数，不允许修改传入的数据。
 */

export type DiagramType = 'er' | 'usecase' | 'functional' | 'arch' | 'sequence' | 'flow' | 'swim';

/** 一张渲染好的图 */
export interface Diagram {
  /** 图名，用于预览标题与导出文件名 */
  name: string;
  /** 完整 <svg>…</svg> 字符串 */
  svg: string;
  /** 逻辑像素宽（渲染前） */
  w: number;
  /** 逻辑像素高（渲染前） */
  h: number;
}

/** 布局用的包围盒（中心点 + 尺寸） */
export interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/* ------------------------------------------------------------------ *
 * SVG 图元选项
 * ------------------------------------------------------------------ */
export interface SvgTextOpts {
  fs?: number;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
  weight?: string;
  family?: string;
  ls?: string;
  /** 旋转角度（度），绕自身坐标点旋转 */
  rotate?: number;
  /** 多行文本行高，默认 fs * 1.28 */
  lh?: number;
}

export interface ShapeOpts {
  fill?: string;
  stroke?: string;
  /** stroke-width */
  sw?: number;
  rx?: number;
  ry?: number;
  /** stroke-dasharray，如 '6 4' */
  dash?: string;
}

export interface LineOpts {
  stroke?: string;
  sw?: number;
  dash?: string;
  /** marker-end，如 `url(#pid-arrowSolid)` */
  marker?: string;
}

/* ------------------------------------------------------------------ *
 * 1. ER 图（分离式）
 * ------------------------------------------------------------------ */
export interface EREntity {
  /** 实体名，同时作为联系 from/to 的外键 */
  name: string;
  /** 属性名列表，顺序即属性图的扇面顺序 */
  attributes: string[];
}

export interface ERRelation {
  /** 联系名（菱形里的文字） */
  name: string;
  /** 起点实体名，必须能在 entities 里找到 */
  from: string;
  /** 终点实体名 */
  to: string;
  /** 起点基数：'1' 或 'n' */
  fromCard?: string;
  /** 终点基数：'1' 或 'n' */
  toCard?: string;
}

export interface ERData {
  title: string;
  entities: EREntity[];
  relations: ERRelation[];
}

/* ------------------------------------------------------------------ *
 * 2. 用例图（每次只画一个角色）
 * ------------------------------------------------------------------ */
/**
 * 一个用例。
 * `includes` 是它的**二级功能**：画在右侧一列，用带 `<<include>>` 的虚线连过来。
 */
export interface UsecaseItem {
  name: string;
  includes?: string[];
}

export interface UsecaseData {
  title: string;
  /** 角色名，画在左侧火柴人下方 */
  actor: string;
  /** 用例列表，每个画成一个椭圆；带 includes 的会在右边再挂一列二级功能 */
  usecases: UsecaseItem[];
}

/* ------------------------------------------------------------------ *
 * 3. 功能模块图
 * ------------------------------------------------------------------ */
export interface FuncRole {
  name: string;
  /** 功能模块名，画成竖排方块；文字竖排正立 */
  modules: string[];
}

export interface FunctionalData {
  title: string;
  roles: FuncRole[];
  /**
   * 布局方式：
   * - `bottom`（默认）系统在上，所有角色/模块向下排；
   * - `split` 上下布局：角色分成两半分列系统上下，上半部分的模块挂在角色上方。
   */
  layout?: 'bottom' | 'split';
}

/* ------------------------------------------------------------------ *
 * 4. 时序图
 * ------------------------------------------------------------------ */
export type SeqMsgKind = 'request' | 'return' | 'self';

export interface SeqMessage {
  /** 参与方索引：0 = 角色，1..n = lifelines[i-1] */
  from: number;
  to: number;
  text: string;
  /** request=实线实心 / return=虚线空心 / self=自调用 */
  kind?: SeqMsgKind;
}

export interface SequenceData {
  title: string;
  /** 最左列的角色名 */
  actor: string;
  /** 生命线名称，从左到右 */
  lifelines: string[];
  messages: SeqMessage[];
}

/* ------------------------------------------------------------------ *
 * 5. 系统架构图（分层）
 * ------------------------------------------------------------------ */
export interface ArchLayer {
  /** 层名，如 表现层 / 业务层 / 数据层；画在每条横带的左侧 */
  name: string;
  /** 该层包含的组件/技术，画成横带里的小方块 */
  items: string[];
}

export interface ArchitectureData {
  title: string;
  /** 从上层到下层排列（数组顺序即上下顺序，第一条画在最上面） */
  layers: ArchLayer[];
}

export type DiagramData =
  | ERData | UsecaseData | FunctionalData | SequenceData | ArchitectureData | FlowData | SwimData;

/* ------------------------------------------------------------------ *
 * 7. 泳道图（跨职能流程图）
 * ------------------------------------------------------------------ */

/**
 * 一个泳道节点。
 * - `lane`  —— 第几列（从 1 开始）= 谁负责
 * - `stage` —— 第几行（从 1 开始）= 流程走到哪一步
 * 一个格子里可以放多个节点，按数组顺序从上往下叠。
 */
export interface SwimNode {
  id: string;
  text: string;
  kind?: FlowShape;
  lane: number;
  stage: number;
}

export interface SwimData {
  title: string;
  /** 列头：角色 / 部门 / 参与方 */
  lanes: string[];
  /** 行头：阶段 / 环节 */
  stages: string[];
  nodes: SwimNode[];
  edges: FlowEdge[];
}

/* ------------------------------------------------------------------ *
 * 6. 流程图（坐标由 AI 直接给，引擎只按网格换算，不做自动布局）
 * ------------------------------------------------------------------ */
export type FlowShape = 'process' | 'start' | 'end' | 'decision' | 'io';

/**
 * 一个流程节点。
 * `col` / `row` 是**网格坐标**（节点中心落在哪一格），不是像素 ——
 * 同一 row 的节点 y 绝对对齐，同一 col 的节点 x 绝对对齐。
 * 宽高不用给：引擎按文字长度算（想更宽可以用 `w` 覆盖，单位同样是格）。
 */
export interface FlowNode {
  /** 连线用它引用；缺省时按 n1、n2… 自动编号 */
  id: string;
  text: string;
  shape?: FlowShape;
  col: number;
  row: number;
  /** 覆盖宽度（网格单位）；不填则按文字自动算 */
  w?: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  /** 线上的文字，如「是」「否」 */
  label?: string;
  dash?: boolean;
}

export interface FlowData {
  title: string;
  /** 一格等于多少像素，默认 40 */
  unit?: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

