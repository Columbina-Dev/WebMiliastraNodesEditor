# 以下为AI的研究（翻译+解释版）
样本内容：
- `A.gil`：空存档
- `B.gil`：含服务器实体节点图
- `C.gil`：含所有种类的节点图各一个（server: entity/stats/profession/item, client: boolean filter/integer filter/skill），并分别写了个简单的节点图

P.S.：目前将不会上传样本文件，怀疑米可追踪创建者信息

# `.gil` 存档格式（节点图部分）

状态：仍在反推，节点图映射尚未完整。**未知字段务必从模板 `.gil` 原样保留**，尤其是 UI / 布局 / 资源等其他段落，避免破坏工程。

---

## 容器整体

- 不是 ZIP，而是自定义二进制容器。开头 5 个大端 `u32`：

  1. **总长度-4**：样本中精确等于 `fileSize - 4`。
  2. **版本**：样本恒为 `1`。
  3. **魔数**：`0x00000326`。
  4. **常量**：`2`。
  5. **payload 长度**：紧随其后 protobuf payload 的字节数。

- 接着是 `payloadLength` 字节的 **protobuf 编码顶层 message**。
- 末尾还有 4 字节 footer，样本中为 `0x00000679`。

[ImageToText](https://github.com/hackermdch/ImageToText) 使用 `UgcUtil.dll` 的 `Decode/Encode` 对 payload 进行透明读写（它只动 UI 文本节点），不会自己处理 protobuf。我们在做节点导出时也应该只替换“节点图段”，其他顶层字段一律照抄模板。

---

## 节点图段（顶层 field `10`）

顶层 protobuf message 的 `field 10` 是 “节点图” 段：

- `10` 本身是一个 message，内部结构：

  - 多个 `field 1`：每个代表**一个节点图 entry**（`C.gil` 中有 7 个，分别对应 4 个服务器图 + 3 个客户端图）。
    - 每个 `10.1` 的 value 还是一个嵌套 message（下文称为 “GraphEntry 包装”）。
  - `field 3`：一个常量 message，内容固定 `{1:2, 2:{1:<bytes>}}`，目前用途不明，样本中不随节点改变 → **原样保留**。
  - `field 7`：样本恒为 varint `1` → **原样保留**。

> 注：`B.gil` 中由于只有一个图，编码方式看起来是「在 `10` 下面只有一个 `field 1`，里面再包一层才到 graph 本体」，但展开后核心结构与 `C.gil` 完全一致：都是 `header + name + nodes`。

### GraphEntry / 图结构

每个 `10.1` 的 value（GraphEntry 包装）再套一层 message，其 `field 1` 才是真正的 **graph 核心**，结构统一如下：

```text
graph {
  1: header {              // 图头部/ID 信息
    1: 10000               // 常量
    2: categoryCode        // 图类别 code（见“已知类别码”）
    3: 21001               // 常量
    5: graphId             // 图 ID（int），样本为 10 位十进制数，自增
  }
  2: nameBytes             // 图名，UTF-8 字节（如 “新建节点图”、“新建技能节点图” 等）
  3: [ node, node, ... ]   // 节点列表（重复 field 3）
  100: ...                 // 仅在部分客户端图出现
  101: ...                 // 仅在部分客户端图出现
}
````

* `header.2`（categoryCode）与 JSON manifest 中的路径对应关系：

  * `20000`：`server/entity/...`
  * `20003`：`server/stats/...`
  * `20004`：`server/profession/...`
  * `20005`：`server/item/...`
  * `20001`：`client/boolean-filter/...`
  * `20006`：`client/integer-filter/...`
  * `20002`：`client/skill/...`

* `graph.100 / graph.101`：

  * 在 boolean / integer / skill 等客户端图中出现；
  * 例如 `graph.100 = 1`、`graph.101 = float(0.3)`；
  * 目前具体含义不明，**导出时原样照抄**（或者从模板同类型图拷贝）。

---

## 节点结构（`graph.3[]`）

`graph.3` 是节点列表：一个“重复 field 3”的 message，每个元素是一个 `node` message：

```text
node {
  1: nodeId                    // 小整数，如 1/2/4；图内唯一
  2: typeDesc {                // 类型描述 #1
    1: 10001                   // 常量
    2: categoryCode            // 与图 header 一致
    3: 22000                   // 常量
    5: typeId                  // 节点类型 ID（见下）
  }
  3: typeDesc2? { ... }        // 可选，结构与 2 相同；大部分节点存在，部分事件节点缺失
  4: [ link, ... ]             // 连线信息（见下一节）
  5: fixed32                   // X 坐标（LE float32），解出后与官方编辑器坐标对齐
  6: fixed32                   // Y 坐标（LE float32）
  8: [ config?, ... ]          // 可选，子结构 `{1:int, 103:{2:bytes}}`，用作常量 / 配置
}
```

坐标字段确认：

* `node.5` / `node.6` 是 wire type 5（32 位定长）。
* 以小端 float32 解码后，能复现官方编辑器的节点位置（`C.gil` 样本中多组对比一致）。

`node.8` 的典型形状：

```text
8: [
  {
    1: <int>                  // 索引 / slot ID？
    103: { 2: <bytes> }       // 长度不等的 Raw/Bytes
  },
  ...
]
```

目前未深入研究；导出时如果需要用到（例如获取/设置常量初始值），再补充映射规则。当前阶段建议：**复制模板节点的 8 字段或由 UI 把它当 opaque payload 管理**。

---

### typeId 映射（`.gil` ↔ webapp 节点类型）

已从 `B.gil` / `C.gil` + 对应 JSON 中对齐出部分 typeId：

> 记号：`webType → typeId`，其中 `webType` 是 WebMiliastra 中的节点类型字符串。

**服务器图（categoryCode 为 20000 / 20003 / 20004 / 20005）**

* `event.graphVariableChanged` → `351`
* `action.printString` → `1`
* `action.finishLevel` → `77`

（其他服务器节点暂未枚举，可按需补表。）

**客户端图（categoryCode 为 20001 / 20006 / 20002）**

观察到客户端 typeId 一般是在“基础 ID”前加 `200000` 左右的偏移：

* `flow.graphEndBoolean` → `200000`
* `client.query.getSelfEntity` → `200033`
* `client.query.entity.isPresent` → `200103`
* `event.graphStart` → `200042`
* `client.action.hate.addValue` → `200084`
* `client.query.entity.getAttackTarget` → `200035`

（同样，其他类型可按样本继续扩充映射表。）

> P.S.：比如 `action.printString`→1 中，`action.printString` 是 WebMiliastra 自身定义的节点类型名；`1` 为 `.gil` 中实际存储的 typeId。导出时必须从 `webType` 查到对应 `typeId`，否则该节点类型目前无法安全导出。

---

## Links（连线，仍未完全解码）

连线信息统一存放在节点的 `field 4` 中，`node.4` 是一个“重复的 message”列表，每个元素代表一条边：

```text
link {
  1: { ... 小整数 ... }
  2: { ... 小整数 ... }
  3: { ... }?         // 可选
  4: <int>?           // 当前节点的端口 ID / 索引
  5: {                // 指向对端节点的信息
    1: remoteNodeId   // 对端 nodeId
    2: { ... }?       // 端口 / role 信息（样本中多个字段值相同）
    3: { ... }?       // 同上（可能数据/控制流区分）
  }
  6: { ... }?         // 在部分“带类型”的连线中出现
}
```

对比 `B.gil` 的服务器实体图（事件 → print → finish）和 `C.gil` 的各类客户端图，当前可以较确定：

* 对于**入边**，`link.5.1` 等于对端节点的 `nodeId`（例如 print 节点的入边里，`5.1` 指向 event 的 `nodeId`）。
* `link.4` 通常匹配本节点的某个“端口序号”（重复值越多说明是同一端口的多条边）。
* `link.5.2` / `link.5.3` 在样本中经常相同，疑似对端的端口序号 / role ID。

但目前还没有建立一套“端口名（如 flowOut, flowIn, text）↔ 这些小整数”的通用映射规则，仍处于样本比对阶段。因此：

* **在导出功能实现之前，必须补完端口↔数字 ID 的规则**，尤其是要能从 WebMiliastra 的端口定义（字符串）安稳映射到 here 的小整数。
* 在规则不完整时，导出函数应该直接报错，而不是瞎写一个 link 结构。

---

## 已知类别码（graph header `1.2`）

从 `C.zip` 的 manifest + `C.gil` graph headers 对齐出的类别码：

* `20000` – 服务器实体图：`server/entity/default/...`
* `20003` – 服务器 stats 图：`server/stats/default/...`
* `20004` – 服务器 profession 图：`server/profession/default/...`
* `20005` – 服务器 item 图：`server/item/default/...`
* `20001` – 客户端 boolean filter 图：`client/boolean-filter/default/...`
* `20006` – 客户端 integer filter 图：`client/integer-filter/default/...`
* `20002` – 客户端 skill 图：`client/skill/default/...`

同一种 category 下的图，节点 typeId 共享（服务器 4 类共用一套，客户端 3 类共用另一套）。

---

## 导出策略（当前设计）

**目标**：给定一个模板 `.gil` 和 WebMiliastra 导出的 zip（GraphDocument），生成一个新的 `.gil`，只替换“节点图段”的内容，其他部分（UI、资源、meta）完全沿用模板。

1. **解析容器头**

   * 读前 5 个大端 `u32` + 尾部 footer，抽出中间 protobuf payload 字节串。
   * 验证魔数 / 版本是否符合预期；不符合则拒绝导出。

2. **解析并替换 field `10`（节点图段）**

   * 解析顶层 payload，只读 field `10`，其他字段原样保留。
   * 对模板中已有的每个 GraphEntry，解析得到：

     * 原有 `header`（类别码、graphId）
     * 原有 `name`
     * 原有 `nodes` 列表
     * 以及 `100/101` 等配置字段
   * 根据 WebMiliastra 当前项目（GraphDocument）构造新的图列表：

     * 对“同类别”的模板图，可以复用 `graphId` 或换用新的（但要自洽）。
     * `header.1/3` 保持 `10000` / `21001` 不变。
     * `header.2` 用类别码映射。
   * 将 `graph.3[]`（节点列表）替换为按 GraphDocument 重建的新节点列表。

3. **GraphDocument → `.gil` 节点映射**

   * 节点类型：

     * 从 GraphDocument 中的 `node.type` 字符串，通过映射表查到 `.gil` `typeId`。
     * 映射失败（未知节点类型）时，导出直接报错。
   * 节点 ID：

     * 在单个图内为连续小整数（1, 2, 3, …），或保持模板的 ID 分配策略。
   * 端口/连线：

     * 在完成“端口名 ↔ 数字 ID”研究之前，不写连线；或者仅在规则完整的节点图上支持导出。
     * 映射不明时必须拒绝导出，不允许写出半残废连线。
   * 坐标：

     * 可以直接从 WebMiliastra 坐标经过线性变换写入；或先使用安全默认布局（例如以网格排列）。
     * 如果未来希望与官方编辑器坐标完全对应，可以用一些对照样本推一个 `scale + offset`。

4. **重新编码 payload 并写回容器**

   * 使用自己的 protobuf encoder（或简单的“手写 wire 格式”）重建顶层 message：

     * 非 `10` 字段：直接从模板 payload 拷贝。
     * `10` 字段：写入新的 GraphEntry 列表（按照 `C.gil` 的“多个 10.1，每个包一张图”的样式即可）。
   * 更新 header 中的 `totalSizeMinusHeader` 和 `payloadLength`。
   * 写入 footer `0x00000679`。

5. **安全原则**

   * 任何字段含义不明时，优先选择：

     * 从模板图复制该字段；或
     * 不写这个字段，让官方编辑器按默认处理。
   * 映射规则不完整（尤其是 typeId、端口 ID）、GraphDocument 结构不合法时，**必须报错而不是生成文件**。
   * 随着解析进度推进，按需更新本文档，新增字段说明 + 示例。

---

# 原文

# `.gil` container notes

Status: exploratory; node-graph mapping is only partially decoded. Unknown fields must be copied verbatim from a template `.gil`, especially non-graph sections (UI/layout/resources), to avoid corrupting projects.

## Container layout

* Binary (not ZIP). Leading big-endian fields:

  * `u32 totalSizeMinusHeader` – equals `fileSize - 4` in `A/B/C.gil`.
  * `u32 version` – always `1` in samples.
  * `u32 magic` – `0x00000326`.
  * `u32 constant` – `2` in samples.
  * `u32 payloadLength` – length of the protobuf payload that follows.

* Payload: a protobuf-encoded top-level message of `payloadLength` bytes.

* A 4-byte footer (`0x00000679`) follows the payload.

[ImageToText](https://github.com/hackermdch/ImageToText) uses `UgcUtil.dll::Decode/Encode` to read/write the payload without exposing protobuf details; it only touches the UI text section and leaves other top-level fields unchanged. We should do the same: only replace the graph section and keep everything else as-is.

---

## Graph section (top-level field `10`)

Top-level field `10` holds all node-graph data:

* `10` itself is a message with:

  * Multiple **field `1`** entries: each is a **GraphEntry wrapper** for a single graph.

    * `C.gil` contains 7 such entries (4 server graphs + 3 client graphs).
    * In `B.gil` there is effectively only one graph, so there’s only one entry; the encoding is slightly more nested but the inner structure is identical once unwrapped.
  * `field 3` – a message `{1: 2, 2: {1: <bytes>}}`, constant across samples; purpose unknown → must be preserved.
  * `field 7` – varint `1` in samples → must be preserved.

### GraphEntry / graph structure

Each `10.1` value (GraphEntry wrapper) is itself a small message; its `field 1` contains the **graph core**, with this structure:

```text
graph {
  1: header {              // graph header / IDs
    1: 10000               // constant
    2: categoryCode        // graph category code (see below)
    3: 21001               // constant
    5: graphId             // graph ID (int), 10-digit numbers, monotonically increasing
  }
  2: nameBytes             // graph name, UTF-8 (e.g. "新建节点图")
  3: [ node, node, ... ]   // node list (repeated field 3)
  100: ...                 // client-only metadata in some graphs
  101: ...                 // client-only metadata in some graphs
}
```

From `C.gil` vs `C.zip` (manifest and JSON graphs), `header.2` (categoryCode) maps to graph paths as:

* `20000` – `server/entity/...`
* `20003` – `server/stats/...`
* `20004` – `server/profession/...`
* `20005` – `server/item/...`
* `20001` – `client/boolean-filter/...`
* `20006` – `client/integer-filter/...`
* `20002` – `client/skill/...`

Fields `graph.100` / `graph.101` appear only on some client graphs (e.g. boolean/integer filters and skill graphs), with values like:

* `graph.100 = 1`
* `graph.101 = float32(0.3)`

Their semantics are unclear; for now, these should be copied from the template or from a matching graph type.

---

## Node structure (`graph.3[]`)

`graph.3` is the node list: a sequence of node messages under repeated field `3`.

Each `node` message:

```text
node {
  1: nodeId                    // small int, unique within a graph (e.g. 1,2,4)
  2: typeDesc {                // primary type descriptor
    1: 10001                   // constant
    2: categoryCode            // same as graph header
    3: 22000                   // constant
    5: typeId                  // node type id (see below)
  }
  3: typeDesc2? { ... }        // optional second type descriptor; many nodes have it
  4: [ link, ... ]             // connections (see Links section)
  5: fixed32                   // X coordinate (LE float32), matches editor layout
  6: fixed32                   // Y coordinate (LE float32)
  8: [ config?, ... ]          // optional extras {1:int, 103:{2:bytes}}, used for constants/config
}
```

Coordinates:

* `node.5` and `node.6` are wire type 5, 32-bit fixed; decoding as little-endian `float32` gives positions that match the official editor’s layout (verified on multiple graphs in `C.gil`).

`node.8`:

* Typical shape in samples:

  ```text
  8: [
    {
      1: <int>,
      103: { 2: <bytes> }
    },
    ...
  ]
  ```

* These appear tied to per-node configuration (e.g., constant values).

* Until fully understood, export code should either:

  * treat them as opaque blobs carried by the UI, or
  * copy them from the template node if cloning/modifying an existing graph.

---

### Type id mapping (`typeId` ↔ web node type)

From `B.gil` and `C.gil` aligned with `B.zip`/`C.zip` JSON:

> Notation: `webType → typeId`, where `webType` is the WebMiliastra node type string.

**Server graphs** (`categoryCode` = `20000` / `20003` / `20004` / `20005`):

* `event.graphVariableChanged` → `351`
* `action.printString`         → `1`
* `action.finishLevel`         → `77`

(There are more server node types; these can be added as they are observed.)

**Client graphs** (`categoryCode` = `20001` / `20006` / `20002`):

Type IDs appear to be a `200000+` style offset of a base ID:

* `flow.graphEndBoolean`              → `200000`
* `client.query.getSelfEntity`        → `200033`
* `client.query.entity.isPresent`     → `200103`
* `event.graphStart`                  → `200042`
* `client.action.hate.addValue`       → `200084`
* `client.query.entity.getAttackTarget` → `200035`

(Again, this table can be extended as more node types are used.)

Export requirement:

* For each `webType` used in a WebMiliastra project, the exporter must be able to find a matching `typeId`.
* If no mapping is known for a given `webType`, that node type cannot currently be exported safely and should cause an error.

---

## Links (partially decoded)

Node connections are stored in `node.4` as repeated link messages:

```text
link {
  1: { ... small ints ... }
  2: { ... small ints ... }
  3: { ... }?         // optional
  4: <int>?           // local port index / role id on the current node
  5: {
    1: remoteNodeId   // target node's nodeId
    2: { ... }?       // remote port info (values often equal)
    3: { ... }?       // remote port info (often mirrors 2)
  }
  6: { ... }?         // appears on some typed/data links
}
```

From server graph in `B.gil`:

* Event → print → finish control-flow and data-flow edges are encoded here.
* For incoming links, `link.5.1` always matches the *other* node’s `nodeId`.
* `link.4` seems to identify a port on the current node.
* `link.5.2` / `link.5.3` are often equal and likely identify the remote port/role.

However, the exact mapping from **named ports** (e.g. `flowOut`, `flowIn`, `variableName`, `text`) to these small integers is not yet fully understood. This mapping is crucial for a correct exporter.

Because of this, export code must:

* only generate links where the port mapping is known and tested, and
* otherwise fail with a clear error instead of guessing.

---

## Known category codes (graph header `1.2`)

From `C.zip` manifest vs `C.gil` graph headers:

* `20000` – server/entity graphs (`server/entity/...`)
* `20003` – server/stats graphs (`server/stats/...`)
* `20004` – server/profession graphs (`server/profession/...`)
* `20005` – server/item graphs (`server/item/...`)
* `20001` – client boolean filter graphs (`client/boolean-filter/...`)
* `20006` – client integer filter graphs (`client/integer-filter/...`)
* `20002` – client skill graphs (`client/skill/...`)

All four server categories share the same node typeId space; the three client categories share another.

---

## Export strategy (planned)

Goal: given a template `.gil` and a WebMiliastra project (zip of JSON graphs), produce a new `.gil` that:

* preserves all non-graph sections (UI, resources, metadata),
* replaces only the node-graph section (field `10`) with graphs derived from the Web project.

1. **Parse container header**

   * Read the 5 big-endian `u32` header fields + trailing footer.
   * Extract the protobuf payload.
   * Validate version/magic/footer; reject if they don’t match expected values.

2. **Decode and replace field `10` (graph section)**

   * Decode just enough of the top-level message to locate field `10`.
   * For each `10.1` GraphEntry in the template:

     * Parse its graph core (header, name, nodes, 100/101).
   * Build a new list of GraphEntries from the WebMiliastra project:

     * Reuse or assign `graphId` values consistently.
     * Set `header.2` (categoryCode) from path/category mapping.
     * Keep `header.1 = 10000` and `header.3 = 21001`.
     * Copy or set graph-level fields 100/101 as appropriate for each category.

3. **Map WebMiliastra graphs/nodes to `.gil`**

   * For each Web graph (`GraphDocument`):

     * Determine its category and corresponding `categoryCode`.
     * Map its node list to `.gil` nodes:

       * `nodeId`: assign unique small integers within the graph.
       * `typeId`: look up via the mapping table from web type strings.
       * `x,y`: transform WebMiliastra coordinates to editor coordinates, or choose a safe default layout.
       * config: either map Web constants into `node.8`, or leave these as template defaults until mapping is understood.
     * Map edges/ports into link messages (`node.4`) only where the port mapping is fully understood.

4. **Re-encode payload and container**

   * Rebuild the top-level message:

     * Copy all non-`10` fields directly from the template payload.
     * Replace field `10` with the new graph section encoded in the same style as `C.gil` (multiple `10.1` entries, one per graph).
   * Update `totalSizeMinusHeader` and `payloadLength` in the container header.
   * Write footer `0x00000679`.

5. **Safety**

   * If any required mapping (typeId, port index, categoryCode) is missing or inconsistent, fail with a clear error instead of emitting a `.gil`.
   * Unknown fields, especially at graph root (`10.3`, `10.7`) and graph-level extras (`100`,`101`), should be copied verbatim from the template unless their meaning is fully understood and intentionally changed.
   * This document should be updated as new fields/mappings are decoded, with examples and test cases.
