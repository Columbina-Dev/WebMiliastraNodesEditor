# GIA File Notes（持续更新版）

以下为 AI 汇总的 GIA 研究与实现结果，主要参考子模块  
`Genshin-Impact-Miliastra-Wonderland-Code-Node-Editor-Pack/`（下称 *子模块*）中的协议与工具实现。

当前状态：  
- 子模块已经完整实现 `.gia` 的读写，包括节点、连接、泛型端口映射以及注释系统。  
- `web/` 侧已经拥有一版可用的 **服务器实体图导出** 实现，导入仍在规划中。  
- `web/src/lib/gia/giaProtoText.ts` 镜像了最新的 `gia.proto`；  
  `nodeDefinitions` 携带官方 `ID/端口顺序`；  
  `web/src/lib/gia/exporter.ts` 在浏览器内生成官方工具可读的 `.gia`。
- 已知问题 [#5](https://github.com/Columbina-Dev/WebMiliastraNodesEditor/issues/5#issuecomment-3600425997)：
```
[ // 未能正确匹配
  { name: 'set node graph variable', wrong_id: 22, real_id: 323 },
  { name: 'set custom variable', wrong_id: 323, real_id: 22 },
  { name: 'set node graph variable', wrong_id: 22, real_id: 323 },
  { name: 'set loot drop content', wrong_id: 724, real_id: 725 },
  { name: 'trigger loot drop', id: 724, wrong_name: 'set loot drop type' }, // 这个似乎是官方文档的锅, 英文的文档中的截图也是前者, 但标题写错了.
],
[ // 缺少 ID 字段(此仓库的数据中为暂时为0)
  [ 9, 'split 3d vector' ],
  [ 10, '3d vector addition' ],
  [ 11, '3d vector subtraction' ],
  [ 12, '3d vector zoom' ],
  [ 13, '3d vector angle' ],
  [ 14, 'equal' ],
  [ 74, '3d vector normalization' ],
  [ 169, 'assembly list' ],
  [ 180, 'data type conversion' ],
  [ 200, 'addition' ],
  [ 202, 'subtraction' ],
  [ 204, 'multiplication' ],
  [ 206, 'division' ],
  [ 208, 'modulo operation' ],
  [ 209, 'exponentiation' ],
  [ 211, 'take larger value' ],
  [ 213, 'take smaller value' ],
  [ 215, 'logarithm operation' ],
  [ 216, 'absolute value operation' ],
  [ 218, 'sign operation' ],
  [ 220, '3d vector modulo operation' ],
  [ 221, 'arithmetic square root operation' ],
  [ 222, 'range limiting operation' ],
  [ 224, 'round to integer operation' ],
  [ 225, 'create 3d vector' ],
  [ 226, 'logical and operation' ],
  [ 227, 'logical or operation' ],
  [ 228, 'logical xor operation' ],
  [ 229, 'logical not operation' ],
  [ 230, 'less than' ],
  [ 231, 'less than or equal to' ],
  [ 232, 'greater than' ],
  [ 233, 'greater than or equal to' ],
  [ 244, 'distance between two coordinate points' ],
  [ 291, 'sine function' ],
  [ 292, 'cosine function' ],
  [ 293, 'tangent function' ],
  [ 294, 'arcsine function' ],
  [ 295, 'arccosine function' ],
  [ 296, 'arctangent function' ],
  [ 321, 'radians to degrees' ],
  [ 322, 'degrees to radians' ],
  [ 474, '3d vector rotation' ],
  [ 475, 'enumerations equal' ],
  [ 505, '3d vector dot product' ],
  [ 506, '3d vector cross product' ],
  [ 519, 'direction vector to rotation' ],
  [ 752, 'calculate formatted time from timestamp' ],
  [ 753, 'calculate timestamp from formatted time' ],
  [ 754, 'calculate day of the week from timestamp' ],
  [ 778, 'left shift operation' ],
  [ 779, 'right shift operation' ],
  [ 780, 'bitwise and' ],
  [ 781, 'bitwise or' ],
  [ 782, 'xor (exclusive or)' ],
  [ 783, 'bitwise complement' ],
  [ 784, 'write by bit' ],
  [ 785, 'read by bit' ],
  [ 1088, 'create dictionary' ],
  [ 1788, 'assembly dictionary' ]
],
[ //隐藏节点 (不在列表和文档中, 但是可以通过 id 创建)
  [ 262, 'activate entity camera' ],
  [ 263, 'disable entity camera' ],
  [ 264, 'activate focus camera' ],
  [ 265, 'disable focus camera' ],
  [ 266, 'activate screen shake' ],
  [ 366, 'activate/disable character disruptor device' ],
  [ 428, 'when native custom value changes' ],
  [ 445, 'native setting custom value' ],
  [ 459, 'native query custom value' ],
  [ 615, 'add entity active nameplate' ],
  [ 616, 'delete entity active nameplate' ],
  [ 678, 'update player leaderboard score' ]
],
```

本文整理当前掌握的结构、web 项目需要的依赖、导出/导入流水线、以及已知限制与下一步计划。

---

## 1. 研究范围与引用来源

- `.gia` 的协议定义与辅助脚本均来自子模块：

  - `utils/protobuf/gia.proto` / `decode.ts`：  
    描述 `.gia` 文件头、`Root`、`NodeUnit`、节点结构，以及 `wrap_gia` / `unwrap_gia` 的编码方式。
  - `utils/gia_gen/graph.ts` / `nodes.ts` / `node_data/*.ts`：  
    提供 `Graph`/`Node` OO 封装、泛型节点定义、引脚具体化、`node_id`/`enum_id`/`concrete_map` 等静态资源与运行时逻辑。
  - `utils/node_data/index.json`：  
    官方 Types / Nodes / Enums 的统一 JSON 汇总，比早期 `web/src/data/nodeDefinitions.ts` 简单版更完整。

- Web 侧目前做法：

  - 构建时使用子模块中的 `index.json`、`node_pin_records.ts`、`concrete_map.ts`、`helpers.ts` 生成  
    `web/src/data/nodeDefinitions.ts`，在浏览器端只消费构建好的 `nodeDefinitions`，避免直接依赖 Node-only 模块。
  - 协议文本通过 `web/src/lib/gia/giaProtoText.ts` 打包，再由 `protobufjs/light` 动态解析。

> 许可证：子模块中与 GIA 相关的内容以兼容许可（MIT）镜像到 web 项目中使用，所有协议或数据集在 web 侧应通过 `web/src/lib/gia/*` 与 `web/src/data/*` 的镜像版本间接引用。

---

## 2. 容器头与 Root 结构

与 `.gil` 相同，`.gia` 是一个二进制容器文件，而不是 ZIP：

| 偏移 | 字段                  | 说明 |
| --- | --------------------- | --- |
| 0x00 | `totalSizeMinusHeader` | `fileSize - 4`，大端 u32 |
| 0x04 | `schemaVersion`        | 固定为 `1` |
| 0x08 | `magic`                | `0x00000326` |
| 0x0C | `fileType`             | `3` 代表 `.gia`（`1/2/4` 为 `.gip/.gil/.gir`） |
| 0x10 | `payloadLength`        | protobuf payload 长度 |
| 0x14.. | payload（`Root` message） | |
| 末尾 | `0x00000679`           | 固定尾标 |

`Root` 结构只有三个字段：

```proto
message Root {
  NodeUnit graph = 1;          // 主节点图 / 组合节点 / 结构体定义等
  repeated NodeUnit utils = 2; // 附属定义：结构体、输入/输出描述等
  string filePath = 3;         // "{UID}-{TIME}-{GRAPH_ID}-\{NAME}.gia"
}
````

说明：

* `filePath`：

  * 决定 UID、`graphId`、文件名，子模块中的 `Graph.decode()` 会利用它恢复元信息。
  * 官方编辑器会严格校验该格式；web 导出时沿用
    `UID-时间戳-graphId-\\文件名.gia` 的规则（详见 `GiaRootBuilder.buildFilePath`）。
* `utils`：

  * 在官方文件中通常承载结构定义、复合节点相关资产等。
  * Web 当前实现 **不写入** `utils`，但解码时需要保留，防止信息丢失。

---

## 3. NodeUnit → NodeGraph 层级

### 3.1 NodeUnit

`NodeUnit` 同时承担“资产包中的一个条目”和“节点图本体”的角色：

* `NodeUnit.id` 结构（简化）：

  ```proto
  message NodeUnit {
    message Id {
      enum Type {
        EntityNode = 9;
        BooleanFilter = 10;
        Skills = 11;
        IntegerFilter = 47;
        // 其他类型：CompositeGraph, StructureDefinition, ItemNode, StatusNode…
      }
      Type type = 1;
      int64 kind = 2; // 详细枚举在子模块中
      int64 id   = 3;
    }
    Id id = 1;
    // ...
  }
  ```

* `NodeUnit.id.type` 决定当前条目的类别（服务器实体图 / 客户端过滤图 / 技能图 / 复合节点 / 结构体等），并映射到 web 侧的 `GraphEnvironment`：

  | `NodeUnit.type`                                                         | GraphEnvironment          |
  | ----------------------------------------------------------------------- | ------------------------- |
  | `EntityNode (9)`                                                        | `server`                  |
  | `BooleanFilter (10)`                                                    | `client:boolean`          |
  | `IntegerFilter (47)`                                                    | `client:integer`          |
  | `Skills (11)`                                                           | `client:skill`            |
  | 其他（`CompositeGraph`, `StructureDefinition`, `ItemNode`, `StatusNode` …） | 暂未在 web 中支持，但导入/导出时需保持原结构 |

> 当前 web 实现 **只导出服务器实体图**，其余环境仍会报错。

### 3.2 NodeGraph

`NodeUnit.graph` 内部实际是一个 `NodeGraphWrapper`，只包含单一 `NodeGraph`。`NodeGraph` 的 ID 决定其所属类别：

```proto
message NodeGraph {
  message Id {
    enum Class {
      UserDefined  = 10000;
      SystemDefined = 10001;
    }
    enum Type {
      BasicNode      = 20000; // 服务器基础图
      BooleanFilter  = 20001;
      Skills         = 20002;
      // ... 其他客户端/系统图类型
    }
    enum Kind {
      NodeGraph      = 21001;
      CompositeGraph = 21002;
      SysCall        = 22000;
      SysGraph       = 22001;
    }
    Class class = 1;
    Type  type  = 2;
    Kind  kind  = 3;
    int64 id    = 5; // graphId
  }
  Id id = 1;
  string name = 2;
  repeated GraphNode nodes = 3;
  repeated CompositePin compositePins = 4;
  repeated GraphVariable graphValues = 6;
  repeated GraphAffiliation affiliations = 7;
  repeated GraphComment comments = 8;
}
```

当前 web 中的约定：

* 导出时重点关注：

  * `id`：

    * 服务器图：`class=UserDefined`、`type=BasicNode`、`kind=NodeGraph`、`id=graphId`。
    * 客户端图未来会设置 `type` 为 `BooleanFilter` / `Skills` 等。
  * `nodes`：节点主体结构。
  * `comments`：图级注释。
* `compositePins` / `graphValues` / `affiliations`：

  * 目前尚未解析，统一保持为空数组；未来用于变量、组合资产引用等信息。

`GiaRootBuilder.buildNodeGraph` 负责根据 `GraphDocument` 生成上述字段。

---

## 4. 节点、端口与连接结构

### 4.1 GraphNode

在子模块与 web 的抽象中，`GraphNode` 形式大致为：

```ts
interface GraphNode {
  nodeIndex: number;        // 图内唯一索引（proto 中的节点序号）
  genericId: NodeGraph.Id;  // 泛型 ID（基类 ID）
  concreteId?: NodeGraph.Id;// 派生 ID（具体类型），目前常与 generic 相同
  pins: NodePin[];          // 输入/输出端口
  x: number;
  y: number;
  comment?: { content: string }; // 节点注释（无坐标）
}
```

实现要点：

1. **官方 ID 映射**
   `GiaGraphNodeEncoder` 会通过 `nodeDefinitions` 查找节点的 `officialID`，并写入 `genericId` / `concreteId`。
   `nodeDefinitions` 本身由子模块的 `index.json` + `node_pin_records.ts` + `concrete_map.ts` 构建而来。

2. **坐标**

   * 早期版本中，官方实现会用 `300/200` 缩放在编辑器坐标与 proto 坐标之间转换。
   * 当前 web 实现简化为：**直接使用 web 编辑器坐标写入 `x/y`**，交由官方编辑器自动布局/展示（已验证可正常打开）。
   * 如后续发现官方对坐标有强依赖，可再考虑恢复缩放逻辑。

3. **节点注释**
   绑定到特定节点的注释会写入 `GraphNode.comment`（见下文注释章节）。

### 4.2 NodePin

`NodePin` 是 `.gia` 中唯一的端口表示方式，所有 flow/data in/out 都会被编码为 `NodePin`：

```proto
message NodePin {
  message Index {
    NodePin_Index_Kind kind = 1; // 端口种类
    int32 index = 2;             // 在该种类中的序号
  }
  Index i1 = 1;
  VarBase value = 2;                // 常量或 enum 值
  NodePin_Type type = 3;            // VarType / 节点逻辑类型
  int32 indexOfConcrete = 7;        // 泛型端口具体化索引
  repeated NodeConnect connects = 8;// 连接信息
  bool reflective = 10;             // 是否为“反射”(泛型)端口
}
```

各字段说明（结合当前实现）：

* `i1.kind`：官方使用的端口种类枚举，web 中约定映射为：

  | kind | 含义             |
  | ---- | -------------- |
  | `1`  | InFlow         |
  | `2`  | OutFlow        |
  | `3`  | InParam（数据输入）  |
  | `4`  | OutParam（数据输出） |

* `type`：VarType 枚举，由 web 侧的 `valueTypeToVarType` 从节点端口的 valueType 映射而来（string/int/bool/vector/entity/guid/list/any…）。

* `indexOfConcrete`：

  * 用于**泛型节点**的具体化索引。
  * 通过子模块中的 `get_concrete_index` 计算：
    基于 `node_pin_records` / `concrete_map` 的 `reflectMap`，将 web 的节点类型 + 端口类型映射到具体索引。

* `connects`：保存连接信息的列表，结构约等同于：

  ```proto
  message NodeConnect {
    int32 id = 1;    // 指向的 nodeIndex
    int32 index = 2; // 指向的端口序号（通常是 data-out 或 flow-out index）
  }
  ```

  * 对于 **数据输入端口**，`connects` 指向数据来源节点及其 data-out 序号。
  * 对于 **控制流**，子模块通过 `Connect.encode_flows` / `decode_flows` 把 `node_connect_to` / `node_connect_from` 编码到对应的 flow 端口。

* `value`：输入端口的常量值（`VarBase`）。

  * 当前 web 导出实现仍留空（只有当 `GraphDocument` 中存在 overrides/controls 映射时才会写入）。
  * 对于复杂类型（Struct/Map/Enum 等），需要结合 `VarBase` 的嵌套结构与 `nodeDefinitions` 才能正确反序列化/序列化。

* `reflective`：标记该端口是否是“泛型端口”（即其 VarType 依赖节点泛型参数）。
  当前 web 侧未对其做额外逻辑处理，但在构建 `nodeDefinitions` 时已经利用 `reflectMap` 决定 `indexOfConcrete`。

### 4.3 端口顺序与连接映射

端口顺序是 `.gia` 的关键点之一：协议层面只记录“端口序号”，并不存储字符串 ID，因此需要静态数据来对齐顺序。

* 端口顺序来源：

  * 子模块中的 `utils/node_data/node_pin_records.ts` 提供
    每个节点的 `inputs[]` / `outputs[]` 以及 `reflectMap` 信息；
  * 构建脚本借此生成 web 侧的 `nodeDefinitions`，保证端口顺序与官方一致。

* web → `.gia` 的连接映射（当前实现）：

  | Web 端口组合            | `.gia` 行为                                                                           |
  | ------------------- | ----------------------------------------------------------------------------------- |
  | flow-out → flow-in  | 通过 `flowConnections` 写入源/目标节点对应的 flow 端 `NodePin.connects`                          |
  | data-out → data-in  | 通过 `dataConnections` 写入目标 data-in pin 的 `connects`，携带源 `nodeIndex` + data-out index |
  | 其他组合（data → flow 等） | 记录警告并跳过                                                                             |

* 实现细节：

  * `GiaGraphNodeEncoder` 在构建 `pins` 时，会以“端口序号”为主，逐一填充 `NodePin`。
  * 对每条 `GraphDocument.edge`，通过 `nodeDefinitions` 查找 source/target 的端口序号，再写入相应 `NodePin.connects`。
  * 子模块的 `Graph.connect()` 已封装了“将连接挂在目标端口上”的具体行为。

---

## 5. 注释（Comments）

子模块已经完整支持 GIA 注释系统，web 侧现已同步导出行为：

1. `GraphDocument.comments` 拆分规则：

   * **节点注释**：
     若 `GraphComment` 中存在 `nodeId`，则视为绑定在某个节点上：

     * 导出时写入 `GraphNode.comment = { content }`。
     * 不携带坐标，由节点本身位置决定。
   * **图级注释**：
     若不存在 `nodeId`，则视为独立图级注释：

     * 导出为 `NodeGraph.comments = [{ content, x, y }]`。
     * `x,y` 为图上坐标（像素），用于在官方编辑器中展示文本块。

2. 解码约定（来自子模块的 `Comment.decode`）：

   * 节点注释：仅有 `content`。
   * 图级注释：包含 `content + x + y`。

3. 多注释情况：

   * 若同一节点在 `GraphDocument` 中有多条注释，当前导出仅保留第一条，其余产生日志警告。
   * 图级注释则全部写入 `NodeGraph.comments`。

> 注意：目前 **导入 `.gia` → `GraphDocument` 时尚未把注释还原为 `GraphComment`**，仅导出路径实现完备。

---

## 6. 静态数据与依赖

为了对齐官方 ID / 端口顺序 / 枚举信息，web 侧依赖以下静态数据与构建过程：

| 资源                                        | 用途                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------- |
| 子模块 `utils/node_data/index.json`          | 官方 TypesList / NodesList / EnumList 汇总，构建时作为“事实来源”。                 |
| 子模块 `utils/node_data/node_pin_records.ts` | 节点原型与端口顺序、`reflectMap` 信息，用于生成 `nodeDefinitions`。                   |
| 子模块 `utils/node_data/concrete_map.ts`     | 泛型端口具体化索引表，提供 `get_concrete_index` 等逻辑。                             |
| 子模块 `utils/node_data/helpers.ts`          | `get_node_record` / `get_concrete_index` / `is_concrete_pin` 等辅助函数。 |
| `web/src/data/nodeDefinitions.ts`         | 构建产物，包含 `officialID` 与端口 id/顺序，浏览器端导出时直接使用。                         |
| `web/src/lib/gia/giaProtoText.ts`         | 将 `gia.proto` 以文本形式打包进入浏览器，避免额外 loader。                             |
| `protobufjs/light`                        | 在浏览器中解析 `giaProtoText`，用于编码/解码 `Root`。                              |

设计原则：

* **以 index.json 为“真”**：

  * 构建时以 `index.json` 为权威数据源，生成 `nodeDefinitions` 等 UI 友好结构。
  * 若后续官方更新节点/枚举，只需更新子模块并重新构建。
* 浏览器端只加载必要的 JSON/TS 片段，可采用按需 `import()` 或 Worker 以避免一次性加载所有 GIA 静态数据。

---

## 7. Web 侧导出流水线（当前实现）

当前导出实现集中在 `web/src/lib/gia/exporter.ts` 中，主要流程：

1. **入口：`exportGiaDocument(GraphDocument)`**

   * 从 `GraphDocument` 中收集 `nodes` / `edges` / `comments`。
   * 校验每个节点在 `nodeDefinitions` 中是否存在 `officialID`，否则报错终止。
   * 验证环境：目前只能处理 `environment = server` 的图，其余环境直接报错。

2. **环境映射 → NodeUnit**

   * 根据 `GraphEnvironment` 写入：

     * `NodeUnit.type = EntityNode`（服务器实体图）。
     * `NodeGraph.Id.Type = BasicNode`，`Class = UserDefined`，`Kind = NodeGraph`。
   * 客户端图（`client:boolean` / `client:integer` / `client:skill`）的映射已在文档中记录，但尚未在实现中放开。

3. **节点转换**

   * 利用 `nodeDefinitions` 查找每个 web 节点的 `officialID`：

     * 写入 `GraphNode.genericId` / `concreteId`。
     * 按 flow/data in/out 类别计算端口顺序，构造 `NodePin[]`。
   * 端口与连接：

     * 使用 `valueTypeToVarType` 写入 `NodePin.type`。
     * 利用 `nodeDefinitions` + `node_pin_records` 映射 web 端口 ID → 端口序号，填充 `NodePin.connects`。
   * 注释：

     * 节点级注释写入 `GraphNode.comment`；
     * 图级注释写入 `NodeGraph.comments`。

4. **图结构构建**

   * `GiaRootBuilder.buildNodeGraph` 根据上述节点信息构造 `NodeGraph`：
     设置 `id/name/nodes/comments`，并维持 `compositePins/graphValues/affiliations` 为默认空值。

5. **封装容器**

   * `wrapGiaPayload`：

     * 接收 `Root` 的 protobuf 编码结果；
     * 在前面写入 20B 头，末尾追加 `0x00000679` 尾标；
     * 返回 `Blob`，供浏览器下载（或上传到后端）。

6. **UI 集成**

   * 编辑器的 action dock 中有 “导出 GIA（实验）” 按钮：

     * 调用 `exportGiaDocument()` 并展示可能的 `warnings`（例如不支持的连接类型）。
     * 若导出中出现错误，会在 UI 中弹窗提示。

验证现状：

* 已用官方示例 `.gia` 与 web 导出的结果对比，确认：

  * 节点 ID、连接结构与官方导出一致。
  * 文本注释可以在官方编辑器中正常展示。
* 仍未写入 `graphValues` / `CompositePin` / 结构体相关字段。

---

## 8. Web 侧导入计划

导入部分尚未实现，但预计流程如下（基于子模块能力）：

1. **读文件与校验头部**

   * 浏览器读取 `.gia` 为 `ArrayBuffer`，用 `DataView` 读取 20B header：
     校验 `totalSizeMinusHeader`、`schemaVersion`、`magic`、`fileType`、`payloadLength`。
   * 校验尾部 4B 固定值 `0x00000679`，确保文件完整性。

2. **protobuf 解码**

   * 使用与导出相同的 `giaProtoText` + `protobufjs/light` 解码得到 `Root`。
   * 解码后保留原始 `Root` 供“原样下载”或调试使用。

3. **NodeUnit 筛选**

   * 仅处理 `NodeUnit.type ∈ {EntityNode, BooleanFilter, IntegerFilter, Skills}` 的条目：

     * `EntityNode` → `GraphEnvironment=server`。
     * `BooleanFilter`/`IntegerFilter`/`Skills` → 对应 `client:boolean` / `client:integer` / `client:skill`（待实现）。
   * 其他类型（如 `CompositeGraph`, `StructureDefinition` 等）暂不在 web 中展开结构，原样保留在 `utils` 或附件信息中，让用户可单独下载。

4. **NodeGraph → GraphDocument**

   * 通过 `graph.nodes[].genericId/concreteId` 与端口信息反查 web 节点类型：

     * 使用 `nodeDefinitions` + `index.json` 的匹配逻辑，获得 web 端节点的 string ID。
   * 根据 `pins[].connects` 重建 `edges`：

     * flow 连接 → web 的 flow-edge；
     * data 连接 → web 的 data-edge。
   * 注释：

     * `GraphNode.comment` → 带 `nodeId` 的 `GraphComment`；
     * `NodeGraph.comments[{content,x,y}]` → 无 `nodeId` 的图级 `GraphComment`。
   * 数据值：

     * `NodePin.value` 的基础类型（int/bool/float/string/vector/GUID…）写回 `GraphDocument.nodes[].data.overrides/controls`。
     * 复杂类型（Struct/Map/Enum）留待后续迭代。

5. **环境推断与存储**

   * 根据 `NodeUnit.type` / `NodeGraph.Id.Type` 推断 web `GraphEnvironment`，填充至 `GraphDocument.meta`。
   * 将生成的 `GraphDocument` 写入 `projectStore`/`graphStore`，供编辑器展示与进一步编辑。

6. **风险提示**

   * 若某个 `NodeUnit` 含有组合资产或结构体依赖（`NodeUnit.relatedIds` / `GraphAffiliation` 非空）：

     * 在 UI 中提示“此图含有额外依赖，当前版本仅导入主图结构”；
     * 保留原始 `.gia` 数据，让用户可以单独下载和手工检查。

---

## 9. 已知限制与未解字段

| 区域                         | 现状      | 说明                                                                                                   |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| 客户端/结构体图                   | 未实现     | `GiaGraphNodeEncoder` 目前只接受 `server`，`BooleanFilter`/`IntegerFilter`/`Skills` 以及组合/结构体图仅在文档中规划，尚未放开。 |
| 节点常量（基础类型）                 | 暂不导出    | `GraphDocument.nodes[].data` 尚未转换为 `VarBase` 写入 `NodePin.value`；导出时该字段为空。                            |
| 节点常量（复杂类型）                 | 未解      | `VarBase` 中的 Struct/Map/Enum 等复杂值还未研究清楚，初期版本将拒绝导出/导入含这类常量的节点或记录警告。                                   |
| 组合资产字段                     | 使用默认值   | `graphValues`、`GraphAffiliation`、`NodeUnit.relatedIds` 等仍保持空数组或默认值，只在文档中记录含义。                        |
| 端口类型枚举                     | 基础类型已覆盖 | `valueTypeToVarType` 已覆盖 string/int/bool/vector/entity/guid/list/any，更多类型需要在使用时增补并测试。                |
| 注释导入                       | TODO    | 导出路径已完整实现；导入 `.gia` 时尚未把注释恢复成 `GraphComment` 对象。                                                     |
| 客户端图 `graph.100/graph.101` | 未实现     | 子模块文档确认存在 100/101 两个图字段（可能与入口/出口或变量有关），当前仅在导入/导出里占位，尚未在 web 中显式建模。                                   |
| 静态数据体积                     | 需按需加载   | `index.json` + `node_pin_records` 体积较大，浏览器端避免一次性加载，建议使用懒加载或 Worker。                                  |

---

## 10. 当前成果 vs 下一步

**目前已经完成：**

* 梳理 `.gia` 容器结构、`Root` / `NodeUnit` / `NodeGraph` 层级，以及文件头/尾格式。
* 对齐 `nodeDefinitions` 与官方 GIA 静态数据（`index.json` / `node_pin_records` / `concrete_map`），实现节点 ID 与端口顺序的映射。
* 在 web 中实现服务器实体图的 `.gia` 导出：

  * 节点 ID / 连接结构与官方导出一致；
  * 支持节点与图级注释导出；
  * 官方编辑器可正常打开并展示。

**下一步工作：**

1. **数据值导出**

   * 解析 `GraphDocument.nodes[].data`（`overrides` / `controls`），实现基础类型到 `NodePin.value`（`VarBase`）的映射。
   * 规划复杂类型（Struct/Map/Enum）的支持策略，必要时限制为只读/只导入。

2. **客户端/复合节点支持**

   * 完成 `NodeUnit.type` 与 `GraphEnvironment` 的映射，支持 `client:boolean` / `client:integer` / `client:skill`。
   * 研究并实现 `graph.100` / `graph.101` 字段的写入与读取。
   * 逐步引入组合图（`CompositeGraph`）与结构体图（`StructureDefinition`）的导出/导入。

3. **导入流水线落地**

   * 实现 `.gia` → `GraphDocument` 全路径，包括节点、连接、注释、常量。
   * 对于含有复杂常量或组合资产依赖的 GIA，提供合理的降级行为和 UI 提示。

4. **测试与文档**

   * 引入若干官方示例 `.gia` 文件，做 round-trip（导入 → 导出 → 对比）测试，保证结构一致。
   * 持续更新协议文档，将 `docs/gia-format.md` 作为 GIA 唯一可信文档，并保持与子模块同步。
   * 与 `.gil` 文档（`docs/gil-node-format.md`）对照，统一术语与结构说明。

---

## 11. 参考文件

> 可用于进一步查阅实现细节的文件（web 子项目与子模块）：

* `web/src/lib/gia/exporter.ts` —— 导出实现（`exportGiaDocument` / `GiaRootBuilder` / `GiaGraphNodeEncoder`）。
* `web/src/lib/gia/giaProtoText.ts` —— 按文本打包的 `gia.proto`。
* `web/src/data/nodeDefinitions.ts` —— web 侧节点定义（含 officialID 与端口顺序）。
* 子模块 `utils/gia_gen/graph.ts` —— Graph/Node/Pin 的编码与注释实现。
* 子模块 `utils/node_data/index.json` / `node_pin_records.ts` / `concrete_map.ts` / `helpers.ts` —— 官方节点/类型/枚举与泛型映射的静态数据与工具。
* `docs/gil-node-format.md` —— `.gil` 结构说明，便于与 `.gia` 对比。
* `docs/gia-format.md` —— GIA 专用格式说明（计划作为单一可信来源持续维护）。
