# 《原神·千星奇域》节点图模拟器

本项目重现了《原神·千星奇域》的节点图编辑器，以便在不打开原神时对节点图进行原型设计。具有导入/导出JSON格式的节点图的功能。

> [!WARNING]  
> **声明：** 该项目为个人制作，与米哈游无关联。所有引用的素材归其原始版权所有者所有。

## 仓库结构

- `web/` – 基于Vite的React的网页应用。
- `iconsWorkingDir/` - 个人制作的官方节点图种类图标的拙劣模仿。`Drawing1.dwg`包含所有五种图标，推荐使用AutoCAD Electrical 2023 打开。<small>P.S.: 本人从未系统学习过CAD/PS，图标仅为拙劣的模仿。</small>
- `web/src/data/nodeDefinitions.ts` – 基于官方编辑器中节点图的节点定义。
- `web/src/types/node.ts` – 节点系统的定义。
- `web/public/tutorial/` - 本地存储的官方综合指南HTML文件及目录JSON。

## 快速上手

### 使用已搭建版本

访问 https://miliastra.columbina.dev/ 。

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

## UGC教程相关
此项目也可查看保存在本地的官方综合指南，点击主页底部的 ![Tutorial](web/src/assets/icons/tutorial.png) 图标，或在节点图编辑页面点击右上角的教程按钮即可打开教程页面。

灵感来源于 [https://milidocs.tiiny.site/](https://milidocs.tiiny.site/) 。

所有指南均从本地加载，因此可能需要[更新](#通过官方源更新教程)。

### 通过官方源更新教程

#### 获取目录文件

```bash
cd web/public/tutorial/catalog
curl -o knowledge.json https://act-webstatic.hoyoverse.com/ugc-tutorial/knowledge/sea/zh-cn/catalog.json 
curl -o course.json https://act-webstatic.hoyoverse.com/ugc-tutorial/course/sea/zh-cn/catalog.json
```
<small>如果需要其他语言版本，请将 `zh-cn` 替换为所需的语言代码。</small>  

#### 获取官方的教程HTML文件
按需修改 `scripts/fetch_tutorial_html.py` 的代码，然后**在仓库根目录**运行以下命令：

```bash
python scripts/fetch_tutorial_html.py
```

html文件将被储存到 `web/public/tutorial/knowledge` 和 `web/public/tutorial/course` 目录中。

#### 查看官方运行的WebApp版本号
访问 [国际服链接](https://act.hoyoverse.com/ys/ugc/tutorial/) / [国服链接](https://act.hoyoverse.com/ys/ugc/tutorial/)，在网页源代码中 `window.__APP_VERSION__` 的值即为当前官方运行的版本号。

### 局限性
1. 所有官方提供的html只有简中版，如需获取其他语言，可 `curl https://act-webstatic.hoyoverse.com/ugc-tutorial/knowledge/sea/<语言码>/textMap.json` 获取对应语言的 `textMap.json`，并对 `web/src/components/TutorialPage.tsx` 及 `web/src/app.tsx` 进行相应修改，可参考 [https://milidocs.tiiny.site/](https://milidocs.tiiny.site/)，此镜像站采用了与官方相同的处理方法（使用text map替换简中html中的所有文字），由于此修改较为复杂，这里不会详细展开做法，请自行研究。
2. 由于代码局限性，目前仅能保证`知识库`及`课程`可以显示出来，如果官方在未来更新了更多类别，则需对 `web/src/components/TutorialPage.tsx`及 `web/src/app.tsx` 进行相应修改，新增相应的逻辑。

### 图文档模式

(介绍由AI生成)  
编辑器读写的 JSON 文档需要符合 `GraphDocument`：
```
    {
      "schemaVersion": 1,
      "name": "Example Graph",
      "nodes": [
        {
          "id": "node_1",
          "type": "action.printString",
          "label": "日志输出",
          "position": { "x": 320, "y": 180 },
          "data": {
            "overrides": {
              "text": "Hello BeyondAssist"
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
      ]
    }
```
节点通过 `type` 字段引用一个定义，并存储画布位置、可选的标签覆盖以及位于 `data.overrides` 的字面输入值。边（edges）可以连接流程端口或数据端口。编辑器会自动强制检查端口种类和数据类型的兼容性。

导入图时会使用 zod 进行 JSON 验证，以防止加载损坏的数据。

### 节点定义模式

(介绍由AI生成)  
`web/src/data/nodeDefinitions.ts` 中的每一项遵循 `NodeDefinition` 接口（定义位于 `web/src/types/node.ts`）。下面给出简化版：
```
    interface NodeDefinition {
      id: string;
      displayName: string;
      category: string;
      kind: 'event' | 'action' | 'query' | 'flow-control' | 'logic' | 'math' | 'data';
      headerColor?: string;
      ports: PortDefinition[];
      controls?: NodeControlDefinition[];
    }

    interface DataPortDefinition {
      id: string;
      label: string;
      kind: 'data-in' | 'data-out';
      valueType: 'bool' | 'int' | 'float' | 'string' | 'vector3' | 'entity' | 'guid' | 'list' | 'enum' | 'any';
      enumValues?: Array<{ label: string; value: string | number }>;
      defaultValue?: unknown;
      allowMultipleConnections?: boolean;
    }

    interface FlowPortDefinition {
      id: string;
      label: string;
      kind: 'flow-in' | 'flow-out';
      allowMultipleConnections?: boolean;
    }
```

## 扩展节点目录

> [!IMPORTANT]  
> 注意：`web/src/data/nodeDefinitions.ts`文件中**所有**节点的定义均由AI根据官方节点图编辑器截图推断，可能存在错误或不完整之处，如有任何问题，请在Issue中提出

在 `web/src/data/nodeDefinitions.ts` 中 `export const nodeDefinitions: NodeDefinition[] = [` 这一行之下添加或调整节点定义。  
例：

```ts
  {
    id: "action.printString",
    displayName: "打印字符串",
    category: "执行节点/通用",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "text",
        label: "字符串",
        kind: "data-in",
        valueType: "string",
        defaultValue: "",
        ui: { placeholder: "输入字符串" },
      },
    ],
  },
```