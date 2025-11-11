# 《原神·千星奇域》节点图模拟器

本项目重现了《原神·千星奇域》的节点图编辑器，以便在不打开原神时对节点图进行原型设计。支持在浏览器中创建、导入、导出及整理节点图工程。

> [!WARNING]  
> **声明：** 该项目为个人制作，与米哈游无关联。所有引用的素材归其原始版权所有者所有。

## 仓库结构

- `web/` – 基于Vite的React的网页应用。
- `iconsWorkingDir/` - 个人制作的官方节点图种类图标的拙劣模仿。`Drawing1.dwg`包含所有五种图标，推荐使用AutoCAD Electrical 2023 打开。<small>P.S.: 本人从未系统学习过CAD/PS，图标仅为拙劣的模仿。</small>
- `web/src/data/` – 基于官方编辑器中节点图的节点定义。
- `web/src/types/node.ts` – 节点系统的定义。
- `web/src/utils/` – IO、校验、拖拽、设备类型检测等额外工具函数。 
- `web/public/tutorial/` - 本地存储的官方综合指南HTML文件及目录JSON。
- `web/src/external/` - 一些已授权的第三方资源，目前含有特效预览（原网址：https://ys.keqizu.com/）

## 快速上手

### 使用已搭建版本

正式版 https://miliastra.columbina.dev/ 。  
测试版 https://beta.miliastra.columbina.dev/ 。

### 本地搭建

```bash
git clone https://github.com/Columbina-Dev/WebMiliastraNodesEditor.git
cd WebMiliastraNodesEditor/web
npm install
npm run dev
```

开发环境默认运行在 http://localhost:5173/ 。  
<small>使用 `npm run build` 以生产环境运行。</small>

### 使用编辑器

#### 主页介绍  

![Screenshot-01](/media/tut1.png)
  1. 新建节点图并打开
  2. 导入JSON节点图文件并打开
  3. 拖拽JSON文件到此处导入并打开
  4. 历史记录，展示所有手动/自动保存到浏览器本地储存的节点图
  5. 压缩并导出所有保存在浏览器本地储存的JSON节点图文件

#### 编辑器界面截图介绍

![Screenshot-02](/media/tut2.png)
  1. 版本信息，提交Issue时请附上此版本信息。如有修改，请提供修改所基于的原神版本号或[千星奇域指南版本号](#查看官方运行的webapp版本号)。
  2. 文件名编辑
  3. 撤回 / 重做 (点击或使用快捷键 Ctrl+Z / Ctrl+Shift+Z)
  4. 功能性按钮：返回到主页 / 手动保存当前打开的节点图到浏览器本地储存 / 导入JSON文件并覆盖当前打开的节点图 / 导出当前打开的节点图为JSON文件 / 在新的页面打开[教程](#ugc教程相关)
  5. 节点库窗口  
      - 可通过关键词筛选节点
      - 选择需要的节点并拖拽到8号区域（画布）以添加此节点
      - 点击`⇤`按钮可收起节点库窗口
  6. 节点详情窗口  
      - 可查看当前选中节点的详情
      - 可修改当前节点标题
      - 可修改当前节点可输入数值
      - 可查看当前节点的入/出连接
      - 可删除当前节点
      - 点击`⇥`按钮可收起节点详情窗口
  7. 提示信息，打开编辑器自动显示，20秒后自动关闭。再次点击可显示画布的基础用法提示，如下↓
  8. 画布区域  
      - 右键拖拽以平移视图
      - 鼠标滚轮缩放视图
      - 左键拖动可多选节点（向左上/下方向为接触选择（绿框），向右上/下方向为框选选择（蓝框），类似AutoCAD）
      - Del键删除所有选中节点
      - 右键空白处可新建节点
      - 右键节点可复制/删除节点

## 额外页面

### UGC教程相关
此项目也可查看保存在本地的官方综合指南，点击主页底部的 <img src="web/src/assets/icons/tutorial.png" width="20" alt="Tutorial" />  图标，或在节点图编辑页面点击右上角的教程按钮即可打开教程页面。

灵感来源于 [https://milidocs.tiiny.site/](https://milidocs.tiiny.site/) 。

所有指南均从本地加载，因此可能需要[更新](#通过官方源更新教程)。

### 特效预览
此项目包含了一个千星沙盒的特效预览功能，点击主页底部的 <img src="web/src/assets/icons/effects.svg" width="20" alt="Effects" /> 图标，或在节点图编辑页面点击右上角的特效预览按钮即可打开特效预览页面。

此特效预览原作者为[B站：Ayaya小王](https://space.bilibili.com/2448140)。修改了部分css以保证网站的整体风格统一。

## 存档管理

### 自动保存与迁移

应用会将最近的项目和草稿存储在浏览器 `localStorage`：

- 首次打开新版*时，会自动扫描旧版仅包含单个节点图的存档，并转换成完整工程，统一放置在 `server/entity/default` 目录下。  
- 自动保存与历史项目会按照时间排序，支持一键导出所有项目的Zip。  
- 可在 "文件/编辑项目信息" 为项目重命名，不需要重新导出并导入。

\* - 新版指 v0.9.70 及之后版本。早期版本仅支持单个节点图的存档。

### 资源管理器校验

资源管理器按 `服务器 <或> 客户端 → 分类 → 组（文件夹） → Json节点图` 的层级展示：

- 同时加载 `nodeDefinitions.server.ts` / `nodeDefinitions.client.ts` 中的节点定义（若为空则回退到 `nodeDefinitions.ts`）。  
- 打开节点图时会验证 `GraphDocument.environment` 是否与所在目录一致，并确保节点类型存在于当前环境允许的列表。  
- 若发现出错，列表会以红色标注并给出详细原因；该节点图被禁止直接打开，但可导出为 `.server.json` 或 `.client.json` 进行离线修复，请根据出错原因修改 Json 内的 `environment`键 的值至正确的值。

## 触控与移动端优化

目前制作了部分触控与移动端优化，暂无法保证完全适配：

- 禁止了浏览器默认的双指缩放，画布使用原生手势处理缩放。  
- 两指轻点等效于桌面端右键，可在画布任意位置弹出菜单。  

## 通过官方源更新教程

### 获取目录文件

```bash
cd web/public/tutorial/catalog
curl -o knowledge.json https://act-webstatic.hoyoverse.com/ugc-tutorial/knowledge/sea/zh-cn/catalog.json 
curl -o course.json https://act-webstatic.hoyoverse.com/ugc-tutorial/course/sea/zh-cn/catalog.json
```
<small>如果需要其他语言版本，请将 `zh-cn` 替换为所需的语言代码。</small>  

### 获取官方的教程HTML文件
按需修改 `scripts/fetch_tutorial_html.py` 的代码，然后**在仓库根目录**运行以下命令：

```bash
python scripts/fetch_tutorial_html.py
```

html文件将被储存到 `web/public/tutorial/knowledge` 和 `web/public/tutorial/course` 目录中。

### 查看官方运行的WebApp版本号
访问 [国际服链接](https://act.hoyoverse.com/ys/ugc/tutorial/) / [国服链接](https://act.mihoyo.com/ys/ugc/tutorial)，在网页源代码中 `window.__APP_VERSION__` 的值即为当前官方运行的版本号。

### 局限性
1. 所有官方提供的html只有简中版，如需获取其他语言，可 `curl https://act-webstatic.hoyoverse.com/ugc-tutorial/knowledge/sea/<语言码>/textMap.json` 获取对应语言的 `textMap.json`，并对 `web/src/components/TutorialPage.tsx` 及 `web/src/app.tsx` 进行相应修改，可参考 [https://milidocs.tiiny.site/](https://milidocs.tiiny.site/)，此镜像站采用了与官方相同的处理方法（使用text map替换简中html中的所有文字），由于此修改较为复杂，这里不会详细展开做法，请自行研究。
2. 由于代码局限性，目前仅能保证`知识库`及`课程`可以显示出来，如果官方在未来更新了更多类别，则需对 `web/src/components/TutorialPage.tsx`及 `web/src/app.tsx` 进行相应修改，新增相应的逻辑。


## JSON 节点图文档格式

(介绍由AI生成)  
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

当校验失败时，资源管理器会在"备注"列展示原因，用户需要导出 JSON 手动修复后重新导入。

## 节点定义格式

(介绍由AI生成)  
节点定义使用 `NodeDefinition` 接口（见 `web/src/types/node.ts`）。核心字段：

```ts
interface NodeDefinition {
  id: string;                     // 唯一标识，建议使用“类型.功能”格式
  displayName: string;            // UI 展示名称
  category: string;               // 以 / 分隔的层级目录，例如 "执行节点/通用"
  kind: 'event' | 'action' | 'query' | 'flow-control' | 'logic' | 'math' | 'data';
  headerColor?: string;           // 节点标题配色
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

> [!IMPORTANT]  
> 注意：`web/src/data/nodeDefinitions.ts`文件中**所有**节点的定义均由AI根据官方节点图编辑器截图推断，可能存在错误或不完整之处，如有任何问题，请在Issue中提出

- 需将服务器节点图和客户端节点图可使用的所有节点列表分别写入 `web/src/data/nodeDefinitions.server.ts` 和 `web/src/data/nodeDefinitions.client.ts`。
- 两个文件若暂时为空，两种节点图均可使用 `nodeDefinitions.ts` 中所有已定义的节点。

列表例子：

```ts
export const serverNodeList = [
  "action.printString", 
  "action.setLocalVariable",
  // ...
] as const;
```
