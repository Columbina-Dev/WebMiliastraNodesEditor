# [简体中文](README.md) | [English](README_EN.md)

# 《原神·千星奇域》节点图模拟器

本项目重现了《原神·千星奇域》的节点图编辑器，以便在不打开原神时对节点图进行原型设计。支持在浏览器中创建、导入、导出及整理节点图工程。

> [!WARNING]  
> **声明：** 该项目为同人制作，与米哈游无关联。所有引用的素材归其原始版权所有者所有。

> [!WARNING]  
> 默认情况下，此应用不会允许导出为GIA节点图及GIL存档文件。用户将本应用生成的GIA/GIL导入《原神》时违反 COGNOSPHERE PTE. LTD. 的**任何条款**（包括但不限于[奇匠条款](./docs/Craftsperson_Terms_EN.md)、[原神千星奇域创作者中心使用条款](https://act.hoyoverse.com/miliastra_wonderland/agreement?id=157329)和[原神服务条款](https://genshin.hoyoverse.com/en/company/terms)）造成的后果均与项目创建者**无关**。启用这些功能需自行承担风险。

> [!WARNING]  
> 该项目90%以上代码均由AI生成。

## 仓库结构

- `web/` – 基于Vite的React的网页应用。
- `iconsWorkingDir/` - 个人制作的官方节点图种类图标的拙劣模仿。`Drawing1.dwg`包含所有五种图标，推荐使用AutoCAD Electrical 2023 打开。<small>P.S.: 本人从未系统学习过CAD/PS，图标仅为拙劣的模仿。</small>
- `web/src/data/` – 基于官方编辑器中节点图的节点定义。
- `web/src/types/node.ts` – 节点系统的定义。
- `web/src/utils/` – IO、校验、拖拽、设备类型检测等额外工具函数。 
- `web/public/tutorial/` - 本地存储的官方综合指南HTML文件及目录JSON。
- `web/src/external/` - 一些已授权的第三方资源，目前含有特效预览（原网址：[https://ys.keqizu.com/](https://ys.keqizu.com/)）

## 仓库分支相关
| 分支名 | 说明 | 版本号示例 |
| :---: | :--- | :---: |
| [main](https://github.com/Columbina-Dev/WebMiliastraNodesEditor/tree/main) | 主分支，稳定版。约等于原神REL版本。 | v1.0.0 |
| [beta](https://github.com/Columbina-Dev/WebMiliastraNodesEditor/tree/beta) | 测试分支，会尽量保证 `npm run build` 可正常运行。不会有存档更新适配。重要项目请尽量使用正式版编辑器。 | v1.0.50 |
| [canary](https://github.com/Columbina-Dev/WebMiliastraNodesEditor/tree/canary) | 小更新分支，任何小更新将推送到此分支。`npm run build` 可能会报错，没有公测地址。 | v1.0.49.C1 |

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
  1. 编辑器版本信息。如未经修改，提交Issue时请附上此版本信息。如有较大修改，请自行解决。
  2. 新建节点图项目并打开
  3. 导入Zip节点图项目文件并打开
  4. 解码GIA文件为"预览Json文件"，并可选下载预览Json、转换为节点图Json并导入至已有的项目或下载
  5. 转换节点图Json为GIA文件并下载，此功能也可在节点图编辑时使用
  6. 拖拽Zip节点图项目文件到此处导入并打开
  7. 历史记录，展示所有手动/自动保存到浏览器本地储存的节点图项目
  8. 压缩并导出所有保存在浏览器本地储存的Zip节点图项目文件
  9. 项目列表，点击即可打开
  10. 局域网共享项目列表，点击可加入
  11. 刷新局域网共享项目列表
  12. 协作服务器列表，添加后可点击连接并搜寻服务器内的公开项目
  13. 添加协作服务器地址
  14. <img src="web/src/assets/icons/setting.png" width="20" alt="Settings" /> 打开设置页面
  15. <img src="web/src/assets/icons/github.svg" width="20" alt="GitHub" /> 前往此GitHub仓库页面  
  16. <img src="web/src/assets/icons/tutorial.png" width="20" alt="Tutorial" /> 打开[官方综合指南](#ugc教程相关)页面  
  17. <img src="web/src/assets/icons/effects.png" width="20" alt="Effects" /> 打开[特效预览](#特效预览)页面  


#### 编辑器界面-资源管理器介绍

![Screenshot-02](/media/tut2.png)  
  1. 窗口：  
      - 服务器节点图资源管理器：切换到`服务器节点图资源管理器`标签
      - 客户端节点图资源管理器：切换到`客户端节点图资源管理器`标签
      - 高级数据管理：切换到`高级数据管理`标签
      - 返回主页：返回到[主页](#主页介绍)
  2. 文件：  
      - 保存项目：手动保存当前打开的节点图项目到浏览器本地储存（在非节点图标签使用`Ctrl+S`）
      - 编辑项目信息：修改当前打开的节点图项目名称
      - 导出为Zip项目：导出当前打开的节点图项目为Zip文件，可切换设备导入到此**网页应用**
      - 导出为GIL存档：上传一份从官方编辑器导出的.gil模板存档，使用当前打开的节点图项目覆盖.gil模板存档内的节点图数据，完成后可导入到官方编辑器（此功能未完成，请暂时使用导出为Zip项目。此功能需在设置中启用）
  3. 节点版本信息，提交Issue时请附上此版本信息。如有修改，请提供修改所基于的原神版本号
  4. <img src="web/src/assets/icons/setting.png" width="20" alt="Settings" /> 打开设置页面
  5. <img src="web/src/assets/icons/github.svg" width="20" alt="GitHub" /> 前往此GitHub仓库页面  
  6. <img src="web/src/assets/icons/tutorial.png" width="20" alt="Tutorial" /> 打开[官方综合指南](#ugc教程相关)页面  
  7. <img src="web/src/assets/icons/effects.png" width="20" alt="Effects" /> 打开[特效预览](#特效预览)页面  
  8. `服务器节点图资源管理器`标签
  9. `客户端节点图资源管理器`标签
  10. `节点图`标签，停留0.5s会显示此节点图文件的路径
  11. `分享`按钮，点击可将当前项目进行局域网或通过协作服务器的协作编辑分享
  12. `交流`按钮，打开协作编辑的聊天面板
  13. 节点图分类
  14. 节点图文件夹/页签
  15. 返回上一次停留的路径
  16. 重置`15-返回上一次停留的路径`的操作
  17. 路径显示，可通过点击快速跳转路径
  18. 搜索当前路径的页签/节点图
  19. 页签/节点图列表  
      页签：
      - 左键
        - 双击页签可在当前标签页打开此页签
      - 右键：
        - 打开：在当前标签页打开此页签
        - 重命名：重命名此页签
        - 复制：复制此页签，包括其下所有节点图。可在同类型节点图路径内的其他路径粘贴。
        - 删除：删除此页签及其下所有节点图
        - 导出：压缩导出此页签内的所有JSON节点图文件为Zip文件
      - 类型：显示为`文件夹`（有点屎山了，官方使用的名称为`页签`，但webapp内大部分时候为`文件夹`，望谅解。）
      - 信息：显示此页签下节点图的数量  

      节点图：
      - 左键
        - 双击节点图可在新的标签页打开节点图
      - 右键：
        - 打开：在新的标签页打开此节点图
        - 重命名：重命名此节点图
        - 复制：在当前路径复制此节点图
        - 删除：删除此节点图
        - 导出：导出此节点图为 `.server.json` / `.client.json` 文件
        - 复制节点图ID：将此节点图的ID复制到剪贴板
      - 类型：显示为`节点图`
      - 信息：
        - 如有红色标注则表示存在错误，无法直接打开。可将其导出为 `.server.json` 或 `.client.json` 进行离线修复，请根据出错原因修改 Json 内的 `environment`键 的值至正确的值。
        - 否则将显示节点图分配的id。

#### 编辑器界面-节点编辑器介绍
![Screenshot-03](/media/tut3.png)  
(节点图乱做的，仅供展示style)
  1. 节点库窗口  
  2. 点击`⇤`按钮可收起节点库窗口
  3. 可通过关键词筛选节点库内的节点
  4. 节点类型，点击可展开。选择需要的节点并拖拽到5号区域（画布）以添加此节点
  5. 画布区域  
      - 右键拖拽以平移视图
      - 鼠标滚轮缩放视图
      - 左键拖动可多选节点
      - Del键删除所有选中节点
      - 右键空白处可新建节点
      - 右键节点可复制/删除节点
  6. 节点详情窗口  
      - 可查看当前选中节点的详情
      - 可修改当前节点标题
      - 可修改当前节点可输入数值
      - 可查看当前节点的入/出连接
      - 可删除当前节点
  7. 点击`⇥`按钮可收起节点详情窗口
  8. 折叠操作栏
  9. 进入注释模式：单击画布区域的节点或空白处添加注释。
  10. 调整执行间隔时间
  11. 编辑此节点图的名称
  12. 调整画布缩放
  13. 撤销上一步操作（Ctrl+Z）
  14. 重做上一步操作（Ctrl+Shift+Z）
  15. 保存此次所有编辑过的节点图到浏览器本地储存（在任何节点图标签使用`Ctrl+S`）
  16. 另存为：复制此节点图到当前项目的其他路径
  17. 导出此节点图为 `.server.json` / `.client.json` 文件
  18. 导出此节点图为GIA节点图文件以便在官方编辑器中直接加载（需在设置中启用）

#### 联机编辑

**自行使用[CollabServer](https://github.com/Columbina-Dev/WebMiliastraNodesEditor-CollabServer) websocket服务器 (实验性且不推荐，尽量使用局域网联机编辑)**

1. 使用以下命令:
    ```bash
    git clone https://github.com/Columbina-Dev/WebMiliastraNodesEditor-CollabServer.git
    cd WebMiliastraNodesEditor-CollabServer/
    npm install
    npm start
    ```

2. 或者按照 [CollabServer 仓库](https://github.com/Columbina-Dev/WebMiliastraNodesEditor-CollabServer) 中的Docker指令操作

3. 打开本地管理面板（默认为 `http://localhost:51983`）并配置API密钥和最大房间数量
4. 将服务器暴露为 `wss://<host>:<port>`（反向代理 / Cloudflared 等）
5. 在编辑器中选择 `Anyone with the link`，填写服务器地址/端口/API密钥并分享，生成的链接类似于 `https://miliastra.columbina.dev/join?server=wss%3A%2F%2Fsignal.example.com%3A51982&roomId=......&pwd=......`  

此设置适用于已发布的版本（miliastra.columbina.dev 或 beta.miliastra.columbina.dev）或自行搭建的同版本

**Local dev / 局域网 (`npm run dev`)**

1. 运行 `npm install` 一次，然后运行 `npm run dev`，将会默认使用 `--host` 运行
2. 在需要的设备上打开 `http://<局域网IP>:5173`
3. 确保运行 `npm run` 的设备允许局域网设备的入站`5173`的TCP端口

### 额外页面

#### UGC教程相关
![Screenshot-04](/media/tut4.png)  

此项目也可查看保存在本地的官方综合指南，点击主页底部的 <img src="web/src/assets/icons/tutorial.png" width="20" alt="Tutorial" />  图标，或在节点图编辑页面点击右上角的教程按钮即可打开教程页面。

灵感来源于 [https://milidocs.tiiny.site/](https://milidocs.tiiny.site/) 。

所有指南均从本地加载，因此可能需要[更新](#通过官方源更新教程)。

提交Issue时请附上顶部的版本号信息，如有修改，请提供修改所基于的[官方千星奇域指南版本号](#查看官方运行的webapp版本号)。

#### 特效预览
![Screenshot-05](/media/tut5.png)  

此项目包含了一个千星沙盒的特效预览功能，点击主页底部的 <img src="web/src/assets/icons/effects.png" width="20" alt="Effects" /> 图标，或在节点图编辑页面点击右上角的特效预览按钮即可打开特效预览页面。

此特效预览原作者为[B站：Ayaya小王](https://space.bilibili.com/2448140)。修改了部分css以保证网站的整体风格统一。

## 存档管理

### 自动保存与迁移

应用会将最近的项目和草稿存储在浏览器 `localStorage`：

- 首次打开新版*时，会自动扫描旧版仅包含单个节点图的存档，并转换成完整工程，统一放置在 `server/entity/default` 目录下。  
- 自动保存与历史项目会按照时间排序，支持一键导出所有项目的Zip。  
- 可在 "文件/编辑项目信息" 为项目重命名，不需要导出修改并导入。

\* - 新版指 v0.9.70 及之后版本。早期版本仅支持单个节点图的存档。

### 资源管理器校验

资源管理器按 `服务器 <或> 客户端 → 分类 → 页签（文件夹） → Json节点图` 的层级展示：

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

### 节点定义文件

> [!IMPORTANT]  
> 注意：`web/src/data/nodeDefinitions.ts`文件中**所有**节点的定义均由AI根据官方节点图编辑器截图推断，可能存在错误或不完整之处，如有任何问题，请在Issue中提出

- 需将服务器节点图和客户端节点图可使用的所有节点列表分别写入 `web/src/data/nodeDefinitions.server.ts` 和 `web/src/data/nodeDefinitions.client.ts`。
- 两个文件若暂时为空，两种节点图均可使用 `nodeDefinitions.ts` 中所有已定义的节点。

列表示例：

```ts
export const serverNodeList = [
  "action.printString", 
  "action.setLocalVariable",
  // ...
] as const;
```

## MCP服务器
此项目提供了一个允许AI代理自动生成节点图和项目的MCP服务器。详情请查看 [MCP服务器仓库](https://github.com/Columbina-Dev/WebMiliastraNodesEditor-MCPServer)

## 许可
本项目采用 **GPL V3** 许可证，详情请见 [LICENSE](LICENSE) 文件  

## 特别鸣谢
- [hackermdch](https://github.com/hackermdch) - 提供 UgcUtil.dll 帮助编码/解码 .gil 存档文件
- [Wu-Yijun](https://github.com/Wu-Yijun) - 提供 gia.proto及其他工具 帮助编码/解码 .gia 文件
