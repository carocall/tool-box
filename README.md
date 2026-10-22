# Carocall Tool Box

把一段结构化 JSON 渲染成**论文风格（纯黑白线框）**的架构图，再导出成可以继续编辑的 draw.io / SVG / PNG。

纯前端，构建产物是**一个自包含的 HTML** —— 双击即开、离线可用、零依赖。

## 支持的图

| 类型 | 说明 |
|---|---|
| ER 图 | 1 张总 E-R 图 + 每个实体 1 张属性图 |
| 用例图 | 单角色；可两级（用例 → 二级功能，用 `<<include>>` 虚线连过去） |
| 功能模块图 | 系统 → 分组 → 模块；两种布局：全部向下 / 上下分列 |
| 系统架构图 | 分层横带 + 层间向下箭头 |
| 时序图 | 生命线 + 激活条 + 请求 / 返回 / 自调用 |
| 流程图 | **坐标直给**：节点按网格 `col` / `row` 摆放，引擎不做自动布局 |

## 怎么用

1. 打开 `release/Carocall Tool Box.html`（没有就先 `npm run release` 生成一次）
2. 左边表单改，右边实时预览；表单默认折叠，点标题条展开
3. 不想手填数据？点「复制提示词」，粘给网页版 AI，把返回的 JSON 用「导入 JSON」贴回来
4. 导出：
   - **导出 drawio** —— 一个多页 `.drawio`（ER 是 N 页），可在 draw.io 里拖拽继续改
   - **打包 SVG / PNG** —— 多张图打成一个 zip，一次全拿走
   - **去 drawio 编辑** —— 直接把当前图送到 app.diagrams.net 在线编辑

## 开发

```bash
npm install
npm run dev        # 本地开发
npm run build      # 产物：dist/index.html
npm run release    # build + 复制成 release/Carocall Tool Box.html（分发用）
npm run check      # 类型检查 + 构建 + 两套回归，改完必跑
```

架构是「几何只有一套」：

```
数据 JSON → layoutXxx(data) → ScenePage[] → paintSvg() → SVG
                                          → buildDrawio() → 多页 .drawio
```

- `src/core/` —— 纯逻辑，零 DOM、零 Vue，可单独在 Node 里跑
- `src/ui/` —— Vue 视图（表单 / 预览 / 导出）
- `tools/selftest.mjs` —— 核心自检（渲染不报错、张数、标签不压框、坐标不出画布）
- `tools/verify.mjs` —— 端到端验收（真浏览器里跑：折叠、导入、drawio 导出、提示词…）

技术栈：Vue 3 + TypeScript + Vite（`vite-plugin-singlefile`），运行时无依赖。
