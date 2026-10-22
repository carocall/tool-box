/**
 * core 的统一出口。
 * 这一层不依赖 Vue、不依赖 DOM（zip/drawio 也是纯字符串拼装），
 * 因此既能在浏览器里跑，也能在 Node 里跑测试。
 */
import type { DiagramType, DiagramData, Diagram } from './types';
import { renderER, layoutER } from './renderers/er';
import { renderUsecase, layoutUsecase } from './renderers/usecase';
import { renderFunctional, layoutFunctional } from './renderers/functional';
import { renderArchitecture, layoutArchitecture } from './renderers/arch';
import { renderSequence, layoutSequence } from './renderers/sequence';
import { renderFlow, layoutFlow } from './renderers/flow';
import { renderSwim, layoutSwim } from './renderers/swim';
import { renderClass, layoutClass } from './renderers/class';
import type { ScenePage } from './scene';

export * from './types';
export type { Scene, SceneItem, ScenePage } from './scene';
export { SAMPLES, HINTS } from './samples';
export { PROMPTS } from './prompts';
export { buildZip, crc32 } from './zip';
export { buildDrawio } from './drawio';
export { paintSvg } from './paint-svg';
export { renderER, renderUsecase, renderFunctional, renderArchitecture, renderSequence, renderFlow, renderSwim, renderClass };
export { layoutERTotal, layoutERAttr, layoutER } from './renderers/er';
export { layoutUsecase } from './renderers/usecase';
export { layoutFunctional } from './renderers/functional';
export { layoutArchitecture } from './renderers/arch';
export { layoutSequence } from './renderers/sequence';
export { layoutFlow } from './renderers/flow';
export { layoutSwim } from './renderers/swim';
export { layoutClass } from './renderers/class';

/** 类型 → 渲染函数（SVG） */
export const RENDERERS: Record<DiagramType, (d: any) => Diagram[]> = {
  er: renderER,
  usecase: renderUsecase,
  functional: renderFunctional,
  arch: renderArchitecture,
  sequence: renderSequence,
  flow: renderFlow,
  swim: renderSwim,
  class: renderClass
};

/** 类型 → 布局函数（场景图，drawio 导出用） */
export const LAYOUTS: Record<DiagramType, (d: any) => ScenePage[]> = {
  er: layoutER,
  usecase: layoutUsecase,
  functional: layoutFunctional,
  arch: layoutArchitecture,
  sequence: layoutSequence,
  flow: layoutFlow,
  swim: layoutSwim,
  class: layoutClass
};

/** 按类型渲染，返回 1..N 张图 */
export function render(type: DiagramType, data: DiagramData): Diagram[] {
  const fn = RENDERERS[type];
  if (!fn) return [];
  return fn(data);
}

/** 按类型布局，返回 1..N 个场景 */
export function layout(type: DiagramType, data: DiagramData): ScenePage[] {
  const fn = LAYOUTS[type];
  if (!fn) return [];
  return fn(data);
}
