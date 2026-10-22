/**
 * 场景图：渲染器唯一的中间产物。
 *
 * 为什么要有这一层：
 * - 几何布局（谁在哪、多宽多高）与「画成什么」是两件事；
 * - SVG 和 drawio 两种 painter 都只消费场景图 —— 两条输出永远同源，
 *   不会出现"改了 SVG 忘了改 drawio"的漂移；
 * - 场景图是纯数据，可以在 Node 里断言，也能以后接别的后端（如 PDF）。
 *
 * 坐标约定：左上角原点，y 向下，单位与 SVG 的 px 一致。
 * `id` 只在 drawio 里用于连线的 source/target，SVG 侧忽略。
 */

/** 矩形（可带居中文字；`vtext` 表示竖排正立文字，二者互斥） */
export interface SceneRect {
  k: 'rect';
  x: number; y: number; w: number; h: number;
  rx?: number; ry?: number; dash?: string;
  fill?: string; stroke?: string; sw?: number;
  /** 图形内居中文字 */
  text?: string; fs?: number; weight?: string;
  /** 文字水平对齐：默认居中；'start' 表示左对齐（架构图的层名靠左） */
  textAlign?: 'start' | 'middle';
  /** 左对齐时的左内边距 */
  textPad?: number;
  /** 竖排正立文字（CJK 逐字自上而下） */
  vtext?: string;
  id?: string;
  /** drawio 侧作为某个图形的子元素（坐标仍写绝对值，painter 会换算成相对坐标） */
  parent?: string;
}
export interface SceneEllipse {
  k: 'ellipse';
  cx: number; cy: number; rx: number; ry: number;
  fill?: string; stroke?: string; sw?: number;
  text?: string; fs?: number;
  id?: string;
}
/** 菱形（ER 联系 / 流程图判断） */
export interface SceneDiamond {
  k: 'diamond';
  cx: number; cy: number; w: number; h: number;
  fill?: string; stroke?: string; sw?: number;
  text?: string; fs?: number; weight?: string;
  id?: string;
}
/** 多边形（流程图的输入输出框用平行四边形；文字画在包围盒中心） */
export interface ScenePoly {
  k: 'polygon';
  pts: number[][];
  fill?: string; stroke?: string; sw?: number;
  text?: string; fs?: number;
  id?: string;
  /** drawio 侧的等效形状：目前只支持平行四边形 */
  shape?: 'parallelogram';
}
/** 连线两端的相对连接点（0~1，相对图形包围盒）；drawio 用来钉死出入口 */
export interface EdgePorts {
  /** [x, y]：从图形哪一点出发（1,0.5 = 右边中点） */
  exit?: [number, number];
  /** [x, y]：连到图形哪一点（0,0.5 = 左边中点） */
  entry?: [number, number];
}

export interface SceneLine {
  k: 'line';
  x1: number; y1: number; x2: number; y2: number;
  sw?: number; stroke?: string; dash?: string;
  /** drawio 里两端连到哪些图形（填场景图里的 id）；SVG 侧忽略 */
  link?: [string | null, string | null];
  id?: string;
  ports?: EdgePorts;
}
/** 折线（正交折线 / 自调用回路），点序列即路径 */
export interface ScenePath {
  k: 'path';
  pts: number[][];
  sw?: number; stroke?: string; dash?: string;
  arrow?: 'solid' | 'open';
  link?: [string | null, string | null];
  id?: string;
  ports?: EdgePorts;
  /** drawio 走正交路由：拖动端点后自动保持直角（ER/用例的直线仍用默认） */
  route?: 'ortho';
}
/** 独立文字（无白底） */
export interface SceneText {
  k: 'text';
  x: number; y: number; text: string; fs: number;
  anchor?: 'start' | 'middle' | 'end';
  weight?: string; rotate?: number;
}
/**
 * 带白底的标注（基数 1/n、消息文字）。
 * `owner` 指向某条边的 id：drawio 侧不再单独建单元格，而是把文字挂到那条边上
 * ——这样拖动图形时文字跟着线走，不会留在原地。SVG 侧照旧画白底标签。
 */
export interface SceneLabel {
  k: 'label';
  x: number; y: number; text: string; fs: number;
  owner?: string;
  /** 挂到边上时的位置：x 为沿边比例（0=中点），y 为垂直像素偏移 */
  ownerX?: number;
  ownerY?: number;
  /** 是否画白色底衬（默认 true）；自调用消息的文字在回路外侧，不需要底衬 */
  bg?: boolean;
  /** bg=false 时的水平对齐 */
  anchor?: 'start' | 'middle' | 'end';
}
/** UML 火柴人（角色名可作为图形自身的 label，drawio 里就等于图形文字） */
export interface SceneActor {
  k: 'actor';
  cx: number; top: number; scale?: number;
  /** 角色名（画在火柴人下方） */
  label?: string;
  labelFs?: number;
  /** 角色名基线的 y（与 SVG 的历史坐标保持一致） */
  labelY?: number;
  labelWeight?: string;
  id?: string;
}

/**
 * 不可见的连接锚点。
 *
 * 存在的唯一理由：让"必须有一端固定"的线（如时序图生命线的下端）也能两端都连到图形上。
 * 它挂在某个图形下面（`parent`），所以拖动图形时锚点跟着走，线不会歪。
 * SVG 侧不画任何东西。
 */
export interface SceneAnchor {
  k: 'anchor';
  id: string;
  x: number;
  y: number;
  parent?: string;
}

export type SceneItem =
  | SceneRect | SceneEllipse | SceneDiamond | ScenePoly
  | SceneLine | ScenePath | SceneText | SceneLabel | SceneActor | SceneAnchor;

export interface Scene {
  w: number;
  h: number;
  items: SceneItem[];
}

/** 一张图的完整场景（含图名，供 drawio 分页与导出文件名使用） */
export interface ScenePage {
  name: string;
  scene: Scene;
}
