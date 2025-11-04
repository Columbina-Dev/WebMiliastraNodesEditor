# 《原神·千星奇域》节点图模拟器

本项目用 React + Vite 复刻《原神·千星奇域》的节点图编辑器，支持在浏览器中创建、导入、导出及整理节点图工程，方便在离开游戏客户端时进行原型设计与协作。

> [!WARNING]  
> **免责声明：** 本项目为个人非商业作品，与米哈游无关。所有外部资源与素材版权归其原始作者所有。

## 仓库结构概览

- `web/` – 前端主工程。  
- `web/src/App.tsx` – 应用入口，处理项目管理、视图路由及顶层 UI。  
- `web/src/components/` – 功能组件（GraphCanvas、NodePalette、ResourceExplorer、EffectsPage 等）。  
- `web/src/state/` – 使用 zustand 的状态仓库，区分项目级与画布级状态。  
- `web/src/utils/` – IO、校验、拖拽、设备检测等工具方法。  
- `web/src/data/nodeDefinitions.ts` – 默认节点定义（当服务器/客户端定义为空时作为回退）。  
- `web/src/data/nodeDefinitions.server.ts` / `nodeDefinitions.client.ts` – 服务器 / 客户端节点专属定义占位文件。  
- `web/src/assets/` – 图标、字体及自定义鼠标指针资源。  
- `web/public/tutorial/` – 官方教程 HTML 与目录缓存。  
- `web/scripts/` – 教程抓取及转换脚本。  
- `README.md` – 主仓库说明；`README_NEW.md` 为开发分支的最新说明（即本文档）。

## 快速开始

### 在线版本

- 正式版：https://miliastra.columbina.dev/  
- 测试版：https://beta.miliastra.columbina.dev/

### 本地开发

```bash
git clone https://github.com/Columbina-Dev/WebMiliastraNodesEditor.git
cd WebMiliastraNodesEditor/web
npm install
npm run dev
```

默认开发地址为 http://localhost:5173/ 。构建生产包可执行 `npm run build`。

### 运行效果速览

#### 主页

![Screenshot-01](/media/tut1.png)

1. 新建节点图工程（基于默认模板）。  
2. 导入或拖放 `.zip` 工程文件。  
3. 查看 / 导出浏览器中保存的历史项目。  
4. 打开使用说明、特效预览、GitHub 仓库等快捷入口。

#### 编辑器

![Screenshot-02](/media/tut2.png)

1. 顶部显示当前页面版本信息，便于提交 Issue。  
2. “文件 → 编辑项目信息” 可随时修改项目名称并更新 manifest。  
3. 支持撤销 / 重做（按钮或快捷键 `Ctrl+Z` / `Ctrl+Shift+Z`）。  
4. 快捷操作：返回主页、保存、导入 JSON、导出 JSON、打开教程。  
5. 左侧节点库：支持搜索与分类折叠；可鼠标拖拽或触控拖放到画布；在移动端长按 2 秒也会插入节点。  
6. 右侧检查面板：展示节点详情、端口连接、控件配置等内容。  
7. 画布交互：  
   - 单指 / 鼠标左键拖拽平移，滚轮缩放；移动端禁用了浏览器层级的双指缩放。  
   - Shift / Ctrl 多选节点；右键对多选集执行删除、复制、断开连接等操作。  
   - 将流程连线拖到空白处会弹出候选节点，鼠标与触控均可用。  
   - 长按节点 2 秒（无论过程中是否发生轻微拖动）会在当前位置打开上下文菜单，方便移动端用户操作。

## 项目与资源管理

### 自动保存与迁移

应用会将最近的项目和草稿存储在浏览器 `localStorage`：

- 首次打开新版时，会自动扫描旧版仅包含单个节点图的存档，并转换成完整工程，统一放置在 `server/entity/default` 目录下。  
- 自动保存与历史项目会按照时间排序，支持一键导出 ZIP。  
- “编辑项目信息” 对话框支持即时重命名，不需要重新导出。

### 资源管理器校验

资源管理器按“服务器 / 客户端 → 分类 → 组 → 图”的层级展示：

- 同时加载 `nodeDefinitions.server.ts` / `nodeDefinitions.client.ts` 中的节点定义（若为空则回退到 `nodeDefinitions.ts`）。  
- 打开节点图时会验证 `GraphDocument.environment` 是否与所在目录一致，并确保节点类型存在于当前环境允许的列表。  
- 若发现问题，列表会以红色标注并给出详细原因；该节点图被禁止直接打开，但可导出为 `.server.json` / `.client.json` 进行离线修复。

## 触控与移动端优化

- 除非处于教程页面，主界面始终保持固定视口高度，不会再出现底部黑色溢出。  
- 禁止浏览器默认的双指缩放，画布使用原生手势处理缩放。  
- 两指轻点等效于桌面端右键，可在画布任意位置弹出菜单。  
- 节点库及检查面板在折叠时会彻底隐藏自身滚动区域，展开后滚动仅作用于组件内部。

## 特效预览（/effects/）

`/effects/` 页面整合了 https://ys.keqizu.com/ 的 GIF 资源，特点：

- 除分类筛选与搜索外，可快速复制特效名称与 ID。  
- 图片懒加载，自动回退大小写不同的资源目录。  
- 页面顶部提供版本信息与“返回主页”按钮，便于在新窗口查看参考动画。

## UGC 教程镜像

主页与编辑器右上角的教学入口指向本地缓存的官方教程：

1. 运行 `web/scripts/fetch_tutorial_html.py` 可一次性抓取最新 HTML。  
2. `web/public/tutorial/catalog/*.json` 存放知识库与课程的目录。  
3. 若需要多语言，请另外抓取对应的 `textMap.json` 并在 `TutorialPage.tsx` 内处理文本映射。  
4. 目前仅支持官方已开放的知识库与课程模块，如需扩展请自行调整组件逻辑。

## JSON 节点图文档格式

编辑器读写的节点图遵循 `GraphDocument` 结构（定义见 `web/src/types/node.ts`）：

```jsonc
{
  "schemaVersion": 2,
  "name": "Example Graph",
  "environment": "server",          // 可选：server | client，不填时导入会根据目录自动补上
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-02T00:00:00.000Z",
  "nodes": [
    {
      "id": "node_1",
      "type": "action.printString",
      "label": "打印字符串",
      "position": { "x": 320, "y": 180 },
      "data": {
        "overrides": {
          "text": "Hello Miliastra!"
        },
        "controls": {
          "loop": false
        }
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": { "nodeId": "node_event", "portId": "flowOut" },
      "target": { "nodeId": "node_1", "portId": "flowIn" }
    }
  ],
  "comments": [
    {
      "id": "comment_1",
      "text": "可在此填写备注",
      "nodeId": "node_1",
      "pinned": true
    }
  ]
}
```

导入时会执行以下验证：

1. 使用 `zod` 解析并校验必填字段、枚举值、坐标等格式。  
2. 若 `environment` 缺失，会根据所属目录补全；若与目录冲突则提示错误。  
3. 检查节点类型是否存在于当前环境的节点定义集合中；不合法的类型会列入错误清单。  
4. 连接边会校验端口种类（流程 / 数据）与数据类型兼容性。  

当校验失败时，资源管理器会在“备注”列展示原因，用户需要导出 JSON 手动修复后重新导入。

## 节点定义格式

节点定义使用 `NodeDefinition` 接口（见 `web/src/types/node.ts`）。核心字段：

```ts
interface NodeDefinition {
  id: string;                     // 唯一标识，建议使用“类型.功能”格式
  displayName: string;            // UI 展示名称
  category: string;               // 以 / 分隔的层级目录，例如 "执行节点/通用"
  kind: 'event' | 'action' | 'query' | 'flow-control' | 'logic' | 'math' | 'data';
  headerColor?: string;           // 节点头部配色，可选
  ports: PortDefinition[];        // 端口定义（见下方）
  controls?: NodeControlDefinition[];  // 面板控件，如下拉框、输入框等
  description?: string;           // 可选：在检查面板显示的说明
}

interface FlowPortDefinition {
  id: string;
  label: string;
  kind: 'flow-in' | 'flow-out';
  allowMultipleConnections?: boolean;
}

interface DataPortDefinition {
  id: string;
  label: string;
  kind: 'data-in' | 'data-out';
  valueType: ValueType;           // 定义于 types/node.ts，例如 'bool' | 'string' | 'vector3'
  allowMultipleConnections?: boolean;
  defaultValue?: unknown;
  enumValues?: Array<{ label: string; value: string | number }>;
}
```

### 定义文件划分

- 服务器节点：建议写入 `web/src/data/nodeDefinitions.server.ts`。  
- 客户端节点：建议写入 `web/src/data/nodeDefinitions.client.ts`。  
- 两个文件若暂时为空，系统会回退到 `nodeDefinitions.ts` 中的默认集合，但不利于环境区分。

添加节点后请确认：

1. `id` 不与现有节点重复。  
2. 端口 `id` 与节点图 JSON 中使用的端口完全一致。  
3. 若为枚举端口，请提供 `enumValues` 以便检查面板渲染下拉选项。  
4. 如需自定义控件（输入框、开关、下拉），需同步更新 `NodeControlDefinition`。

## 扩展节点目录与工程结构

### 1. 新增节点定义

1. 根据适用环境，分别在 `nodeDefinitions.server.ts` 或 `nodeDefinitions.client.ts` 中添加节点。  
2. 若节点同时适用于两个环境，可分别复制一份或将共享逻辑保留在 `nodeDefinitions.ts`，再在环境文件中按需扩展。  
3. 保存后重启开发服务器或重新加载页面即可看到新节点。

### 2. 更新工程目录

节点定义仅决定可创建哪些节点；若需要按类别管理项目，需同步调整 manifest：

1. `web/src/types/project.ts` 描述了目录结构（顶层文件夹、分类、组等）。  
2. 使用资源管理器的“新建组”“重命名”操作即可自动写入 manifest。  
3. 命名规范：服务器节点建议放在 `server/<category>/<group>/`，客户端节点放在 `client/...`。

### 3. 验证与导出

1. 每次修改节点定义后，建议导入一份包含新节点的 JSON 进行验证。  
2. 资源管理器会在元信息列显示校验结果，确保无跨环境引用。  
3. 导出单个节点图时，文件名会自动追加 `.server.json` 或 `.client.json`，便于区分。

### 4. 提交变更

1. 更新节点定义的同时请修改相应的 README 说明和示例 JSON。  
2. 若引入新的控件类型，请为 `NodeInspector` 编写渲染逻辑。  
3. 建议附带截图或说明文档，方便其他贡献者理解节点用途。

---

如需进一步了解“使用编辑器”章节中提到的互动细节，可参考 `Notes.txt` 或项目 Issue 中的说明。欢迎通过 PR / Issue 反馈 BUG、提出功能建议。谢谢！
