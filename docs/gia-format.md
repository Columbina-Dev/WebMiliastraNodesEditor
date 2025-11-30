# 以下为 AI 汇总的 GIA 研究结果（参考 `web/src/lib/gia/gia.proto` 与子模块工具）

状态：仍在整理阶段。GIA 的容器格式与 `.gil` 类似，但 `Root` → `NodeUnit` → `NodeGraph` 的层级、节点/引脚的泛型映射、以及组合资产元数据更加复杂。本文整理了当前掌握的结构、web 项目需要的依赖、以及导入/导出落地计划与风险。

---

## 1. 研究范围与引用

- `.gia` 的协议定义、辅助脚本来源于子模块 `Genshin-Impact-Miliastra-Wonderland-Code-Node-Editor-Pack/`，并以 MIT 许可形式镜像在 `web/src/lib/gia`（`gia.proto` 与 `LICENSE`）。
- 子模块中的关键信息：
  - `utils/protobuf/gia.proto` / `decode.ts`：文件头、Root、节点结构，以及 `wrap_gia`/`unwrap_gia` 的编码方式。
  - `utils/gia_gen/graph.ts` / `nodes.ts` / `node_data/*.ts`：`Graph`/`Node` OO 封装、泛型节点定义、引脚具体化、`node_id`/`enum_id`/`concrete_map` 等静态资源。
  - `utils/node_data/index.json`：同一份 JSON 汇总（类型、节点、枚举、泛型映射），比当前 `web/src/data/nodeDefinitions.ts` 完整。
- 后续在 web 端集成时，所有对协议或数据集的引用都应通过 `web/src/lib/gia/*` 或把 `index.json` 复制到 `web/src/data` 后再消费，以满足许可证与构建需求。

---

## 2. 容器头与 Root 结构

与 `.gil` 一样，`.gia` 文件的 20B 头 + proto payload + 4B 尾由 `utils/protobuf/decode.ts` 描述：

| 偏移 | 字段                      | 说明 |
| ---- | ------------------------- | ---- |
| 0x00 | `totalSizeMinusHeader`    | `fileSize - 4`，大端 u32 |
| 0x04 | `schemaVersion`           | 恒为 `1` |
| 0x08 | `magic`                   | `0x00000326`，必须匹配 |
| 0x0C | `fileType`                | `3` 代表 `.gia`（`1`/`2`/`4` 分别是 `.gip`/`.gil`/`.gir`） |
| 0x10 | `payloadLength`           | 后续 protobuf payload 长度 |
| …    | payload (`Root` message)  | 参考 `web/src/lib/gia/gia.proto` |
| 尾部 | `0x00000679`              | 固定尾标 |

`Root` message：

```proto
message Root {
  NodeUnit graph = 1;          // 主图（节点图 / 组合节点 / 结构体等）
  repeated NodeUnit utils = 2; // 附属定义（结构体、输入输出描述等）
  string filePath = 3;         // "{UID}-{TIME}-{GRAPH_ID}-\{NAME}.gia"
}
```

`filePath` 决定 UID、graphId、文件名（`Graph.decode()` 利用它恢复元信息）。为兼容官方工具，导出时必须生成同样的格式。

---

## 3. NodeUnit → NodeGraph 的层级

`NodeUnit` 同时承担“资产包的一个条目”与“节点图本体”的角色：

- `NodeUnit.Id`（`type`, `kind`, `id`）决定当前条目的类别（服务器实体图、客户端过滤图、复合节点、结构体等）。
- `NodeUnit.type` 的取值与环境映射：
  - `EntityNode(9)` → 服务器实体节点图（`environment=server`）。
  - `BooleanFilter(10)` / `IntegerFilter(47)` → 客户端布尔/整数判定节点图（`environment=client:boolean|integer`）。
  - `Skills(11)` → 客户端技能图（`client:skill`）。
  - 其他类型（`CompositeGraph`, `StructureDefinition`, `ItemNode`, `StatusNode` …）当前 web 项目尚未涉及，但 `.gia` 导入会遇到，需保留原结构。
- `NodeUnit.graph` 是 `NodeGraphWrapper`，内部只有一个 `NodeGraph`，结构在 `gia.proto` → `NodeGraph` 中定义。

`NodeGraph`：

```proto
message NodeGraph {
  message Id {
    enum Class { UserDefined = 10000, SystemDefined = 10001; }
    enum Type { BasicNode = 20000, BooleanFilter = 20001, Skills = 20002, ... }
    enum Kind { NodeGraph = 21001, CompositeGraph = 21002, SysCall = 22000, SysGraph = 22001; }
    Class class = 1;
    Type type = 2;
    Kind kind = 3;
    int64 id = 5; // graphId
  }
  Id id = 1;
  string name = 2;
  repeated GraphNode nodes = 3;
  repeated CompositePin compositePins = 4; // 复合节点专用
  repeated GraphVariable graphValues = 6;  // 图内变量
  repeated GraphAffiliation affiliations = 7; // 组合资产引用
}
```

对 web 项目而言：

- 首轮导出只需 **`nodes`** 与 `id/name`；`compositePins`/`graphValues`/`affiliations` 可保持空数组或沿用模板。
- `Id` 中的 `Class/Type/Kind` 直接决定 `.gia` 的分类，必须与 `GraphEnvironment` 对应：
  - 服务器图：`Class=UserDefined`, `Type=BasicNode`, `Kind=NodeGraph`.
  - 布尔过滤图：`Type=BooleanFilter`.
  - 技能图：`Type=Skills`.
  - 复合节点/结构体暂不支持。

---

## 4. GraphNode / NodePin / 连接结构

`GraphNode`（在 `utils/gia_gen/graph.ts` 内部建模，node_data 支持）：

```
interface GraphNode {
  nodeIndex: number;          // 图内唯一索引（自增即可）
  genericId: NodeGraph.Id;    // 泛型 ID（基类 ID）
  concreteId?: NodeGraph.Id;  // 派生 ID（具体类型）
  pins: NodePin[];            // 输入输出引脚
  x: number;                  // 坐标，官方编辑器使用 300/200 缩放
  y: number;
}
```

`NodePin`：

```
message NodePin {
  message Index { NodePin_Index_Kind kind = 1; int32 index = 2; }
  Index i1 = 1;                     // kind(3=输入,4=输出) + 序号
  VarBase value = 2;                // 常量或 enum 值
  NodePin_Type type = 3;            // 逻辑类型节点（NodeType）
  int32 indexOfConcrete = 7;        // 反射引脚的具体类型索引
  repeated NodeConnect connects = 8;// 连接（nodeIndex + pin index）
  bool reflective = 10;             // 是否为泛型引脚
}
```

关键点：

- **泛型节点**：使用 `node_data/node_pin_records.ts` + `concrete_map.ts` 的 `reflectMap` 信息，将 `GraphDocument` 节点的类型（string ID + 端口类型）映射到游戏内部的 `(genericId, concreteId)` 与 `indexOfConcrete`。在子模块中 `Node.setConcrete()`、`Pin.updateConcreteIndex()` 已给出完整实现。
- **端口顺序**：`.gia` 只基于“端口序号”定位，不存储字符串 ID。需要 `node_pin_records` 中的 `inputs[]`/`outputs[]` 顺序来匹配 web 端 `ports`。
- **连接**：`Connect` 结构只保存 `(from nodeIndex, outputIndex)`，写入时必须选择“当前 pin 的连接”并放在 `NodePin.connects`。`graph.ts` 的 `Graph.connect()` 已处理单向连接。
- **坐标**：官方坐标系统是 300/200 缩放。`Graph.decode()` 会把 `proto.x/300`、`proto.y/200` 还原成编辑器坐标；导出时执行反向缩放即可（`node_body` 已按 `graph.encode()` 的值写入）。

---

## 5. 静态数据：节点/类型/枚举映射

为了让 web 导出/导入对齐 `.gia`：

| 数据源 | 作用 | Web 侧处理 |
| ------ | ---- | ---------- |
| `utils/node_data/index.json` | TypesList / NodesList / EnumList 的 JSON 汇总 | 拷贝至 `web/src/data/nodeData.json`（或按需切分），在构建时懒加载 |
| `utils/node_data/node_pin_records.ts` | 节点原型与端口顺序 -> `reflectMap` | 建议转成 JSON，供浏览器使用（TS 版依赖 Node） |
| `utils/node_data/concrete_map.ts` | 引脚具体化索引表 | 同上 |
| `utils/node_data/helpers.ts` | `get_node_record`, `get_concrete_index`, `is_concrete_pin` | 这些逻辑可直接移植到 web（无需 Node-only API） |

当前 `web/src/data/nodeDefinitions.ts` 只是一份 UI 友好的定义，不包含完整 ID/Port 序列。实现 `.gia` 导出时需要**以 `index.json` 为真**，然后派生 UI 所需的额外字段。

---

## 6. Web 侧导出计划

### 6.1 基础组件

1. **协议类型**：将 `web/src/lib/gia/gia.proto` 通过 `protobufjs/minimal` 生成 runtime 类型，或复用子模块输出的 `gia.proto.ts`（需改造成 ES module + tree-shaking 友好版本）。
2. **节点定义数据**：把 `index.json` 拆分为 `types`, `nodes`, `enums`，放到 `web/src/data/gia`。
3. **运行时工具**：在 `web/src/lib/gia` 新增纯浏览器版本的：
   - `helpers.ts`：`get_node_record`, `get_generic_id`, `get_concrete_index`.
   - `graph.ts`：删去 `assert`/`fs` 依赖后即可直接使用（Graph、Node、Pin、Connect）。

### 6.2 GraphDocument → GIA 流程

1. **收集 GraphDocument**（`useGraphStore.exportGraph()`），确保 `schemaVersion >= 2`。
2. **环境映射**：
   - `server` → `NodeUnit.type = EntityNode`, `NodeGraph.Id.Type = BasicNode`.
   - `client:boolean` → `BooleanFilter`.
   - `client:integer` → `IntegerFilter`.
   - `client:skill` → `Skills`.
   - 其余 `client` 子类型暂不支持，直接报错。
3. **节点转换**：
   - `node.type`（字符串） → 在节点数据集中查询 `genericId`/`concreteId`。
   - `ports`：根据 `node_pin_records` 的顺序把 `GraphDocument` 的 `edges` 映射到 `Pin` index；若找不到匹配端口 → 报错。
   - `overrides`/`controls`：尚未找到与 `.gia` 直接对应的字段，暂设为空或 TODO。
4. **`Graph.connect()`**：对每条 `edge`（flow/data）查找 source/target 节点 & 端口序号，调用 `graph.connect(fromNode, toNode, fromIndex, toIndex)` 生成 `NodePin.connects`。
5. **`graph.encode()`**：获得 `Root` 风格结构。
6. **`wrap_gia`**：浏览器端需要一个纯 TypeScript 版的 `wrap_gia`（`DataView` 即可），再把结果 `Blob`+`URL.createObjectURL` 下载。

### 6.3 渐进式策略

- **阶段 1（当前原型）**：仅支持服务器图 + 极少量节点类型（通过白名单），其余情况报错；连接以“仅控制流”或“无连接”输出。
- **阶段 2**：补齐 `node_pin_records` → `GraphDocument` 的端口映射表，支持全部服务器节点。
- **阶段 3**：加入客户端图（start/end 节点、布尔/整数输出），实现 `graphValues`、`graph.100/101` 的同步。
- **阶段 4**：支持 `.gia` → `.json` 的 round-trip，允许导入官方图并映射到 web UI。

---

## 7. Web 侧导入计划

1. **读文件**：浏览器读取 `ArrayBuffer`，按 header 校验长度/魔数；提取 payload。
2. **protobuf 解码**：用 `protobufjs/minimal` + 预编译的 `Root` 类型解码。若后续希望减少体积，可写“部分字段解析”的手写 decoder。
3. **NodeUnit 筛选**：仅处理 `type` 为 `EntityNode/BooleanFilter/IntegerFilter/Skills` 的图；其他条目保留原始信息供用户下载。
4. **GraphNode 转换**：
   - 通过 `graph.nodes` 的 `genericId/concreteId` 在 `node_data` 记录中查找 web 节点类型 ID。
   - 根据 `pins` 中的连接重建 `edges`；`nodeIndex` 与 web `node.id` 建立映射。
   - `VarBase` → `overrides/controls`：需要结合 `node_def` 的控件定义再恢复（初版可仅保留 `GraphDocument.nodes[].data.overrides`，其余 TODO）。
5. **环境推断**：由 `NodeUnit.type`/`NodeGraph.Id.Type` 得出 web `GraphEnvironment`。
6. **输出**：生成新的 `GraphDocument`，并写入 `projectStore`.

风险：`.gia` 可能包含组合资产或结构体定义；我们需在 UI 提示“部分条目跳过但原始数据可另存”。

---

## 8. 未解字段与限制

| 区域 | 状态 | 处理建议 |
| ---- | ---- | -------- |
| `GraphNode.pins[].value` 的复杂结构（Struct、Map、Enum） | 需根据 `VarBase` 反序列化 | 第一期先只支持基础类型（int/bool/float/string/vector/GUID），其余拒绝导出 |
| 客户端图 `graph.100` / `graph.101` | 子模块文档确认存在，但含义未知 | 导出时从模板 `.gia` 读取并复制；导入时记录原值 |
| `NodeUnit.relatedIds` | 组合资产 / 结构体引用 | 导出初期设为空；导入若存在则在 UI 中提示“此图有额外依赖” |
| `graphValues` / `GraphAffiliation` | 影响变量与引用关系 | 目前 web UI 没有变量面板，先生成空数组 |
| `node_pin_records` 在浏览器端的体积 | index.json > 1MB | 使用 `lazy import()` / 预构建 Worker，并在导出前按需加载 |

---

## 9. 当前任务成果 vs 下一步

- 已梳理 `.gia` 容器结构、Graph/Node 层级、泛型节点解析和与 web 数据的差异。
- 明确需要把 `utils/node_data/index.json` 迁移至 web，才能正确映射 (genericId, concreteId, pin 序号) → GraphDocument。
- 规划了导出/导入流水线、阶段目标及未解字段。
- 下一步（在 `web/` 项目中）：
  1. 搭建 `web/src/lib/gia/runtime`（含 `wrap_gia`、`Graph` OO、`helpers`）。
  2. 引入 `protobufjs/minimal` 或编写轻量 encoder。
  3. 在 UI `action_dock` 添加 “导出 GIA” 按钮，调用新的 `exportGiaFromGraph()`（原型阶段可只支持 `action.printString` 等已知节点）。
  4. 设计 `GiaImportService`，利用 FileReader + proto decoder 生成临时 JSON，以便在下一轮实现真正导入。

> 与 `.gil` 文档一样，本文会随着协议理解的完善不断追加案例、字段对照与调试记录。

