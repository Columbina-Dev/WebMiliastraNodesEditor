# 以下为AI的研究（翻译+解释版）
样本内容：
- `A.gil`：空存档
- `B.gil`：含服务器实体节点图
- `C.gil`：含所有种类的节点图各一个（server: entity/stats/profession/item, client: boolean filter/integer filter/skill），并分别写了个简单的节点图

P.S.：目前将不会上传样本文件，怀疑米可追踪创建者信息

# `.gil` 存档格式（节点图部分）

状态：仍在反推，节点图映射尚未完整。未知字段务必从模板 `.gil` 原样保留，避免破坏 UI/布局等其他段落。

## 容器整体

- 不是 ZIP，为二进制容器。开头 5 个大端 `u32`：
  1. 申明长度（样本中约等于 `filesize - 4`）
  2. 版本（样本恒为 `1`）
  3. 魔数 `0x00000326`
  4. 常量 `2`
  5. payload 长度（紧随其后）
- payload 是 protobuf 编码的消息；尾部还有 4 字节 footer（样本为 `0x00000679`）。
- ImageToText 读写时只改 UI 文本段，其他顶层字段保持不变；我们也应只替换节点段。

## 节点图段（field `10`）

`payload[10]` 是一个 message，key `1` 下是一组图记录。

图结构（推测）：
- `1` (message) 图主体：
  - `1` (message) 头部/ID：`1=10000`，`2=图类别code`（服务端 20000/20003/20004/20005；客户端 20001），`3=21001`，`5=图ID/Guid`（样本从 [REDACTED] 起递增）。 // [REDACTED] 为10位数
  - `2` 图名（UTF-8 字节）。
  - `3` 节点列表。
  - 可选 `100/101/...`：客户端图中出现，保持模板值。
- `3` (message) 根部另有 `{1:2, 2:{1:<bytes>}}`，保持原样。
- `7` 样本为 `1`。

### 节点结构（`graph.body[3]`）

每个节点是一个 message：
- `1` 节点序号（int）。
- `2` 节点类型描述 `{1:10001, 2:<图类别>, 3:22000, 5:<typeId>}`。
- `3` 可选，与 `2` 结构相同（多数节点有，事件节点可能缺失）。
- `4` 连接信息（单个或列表），见下文 Links。
- `5`、`6` 为 fixed32（转 float 得到官方编辑器坐标）。
- `8` 可选 `{1:<int>, 103:{2:<bytes>}}`，疑似常量/配置，需原样复制。

已观察到的 typeId（来自 B/C 样本）：
- 服务器：`action.printString`→1，`action.finishLevel`→77，`event.graphVariableChanged`→351。
- 客户端：在基础 ID 前加 200000，例如 `flow.graphEndBoolean` 200000，`client.query.getSelfEntity` 200033，`client.query.entity.isPresent` 200103，`event.graphStart` 200042，`client.action.hate.addValue` 200084，`client.query.entity.getAttackTarget` 200035。

P.S.：`action.printString`→1 中，`action.printString`为此webapp中使用的节点类型定义，`1`为对应的 `.gil` typeId。其他以此类推。

### Links（未完全解码）

保存在节点的 `4` 字段：
- 形状：`1`、`2` 为小整数，`3` 可选嵌套，`4` 似乎是当前节点的端口，`5` 为嵌套 message（其中 `5.1` 匹配对端节点 ID，`5.2/5.3` 匹配对端端口 ID），有时带 `6`。
- 复杂/类型化连线或常量会携带更多子字段；当前阶段应尽量保留模板原值，未知时不要改写。

## 已知类别码

- `20000`：服务器图（样本中 entity/stats/profession/item 都用此码）。
- `20001`：客户端图（boolean filter / integer filter / skill）。
- 样本里还出现 `20003/20004/20005`，节点内容与 `20000` 相同，推测是服务器其他子类。

## 导出策略（计划）

1. 按头部解析并抽出 payload，不触碰非图字段。
2. 解码 protobuf，仅替换 field `10` 的节点图列表，其他顶层字段直接复用模板。
3. 将 `GraphDocument` 映射到 `.gil`：
   - 节点类型 → `typeId`（已知表见上，未知暂不能支持）。
   - 端口/连线 → 数字 ID；映射不明时保留模板连线或报错。
   - 坐标：若无法重建，优先使用模板或安全默认。
4. 重新编码 payload，还原头部与 footer。

在映射未完成前，导出函数应显式报错，而不是生成潜在的损坏文件。按需扩充此文档以记录新的字段/映射规则。

---
# 原文
# `.gil` container notes

Status: exploratory; node-graph mapping is only partially decoded. Unknown fields should be copied from a template `.gil` unchanged.

## Container layout

- Binary (not ZIP). Leading big-endian fields:
  - `u32 totalSizeMinusHeader?` – matches `fileSize - 4` in samples.
  - `u32 version` – always `1` in `A/B/C.gil`.
  - `u32 magic` – `0x00000326`.
  - `u32 unknown` – constant `2` in samples.
  - `u32 payloadLength`.
- Payload: protobuf-encoded message. A trailing 4‑byte footer (`0x00000679` in samples) follows the payload.
- ImageToText loads the payload via `Decode` from `UgcUtil.dll` and re‑encodes it untouched when saving; UI/layout blocks live in other top-level fields that we should not modify.

## Graph section (field `10`)

`payload[10]` is a message containing a list of graph entries under key `1`.

Graph entry structure (best-effort):

- `1` (message) – graph body:
  - `1` (message) – header/ids:
    - `1` constant `10000`.
    - `2` graph category code (examples: `20000` server entity, `20003/20004/20005` other server categories, `20001` client graphs).
    - `3` constant `21001`.
    - `5` graph GUID/int id (e.g. `[REDACTED]`, increments per graph). // [REDACTED] is a 10-digit number
  - `2` graph name (UTF-8 bytes).
  - `3` repeated nodes.
  - Optional extra fields (`100`,`101`, etc.) seen on client graphs – copy from template if present.
- `3` (message) at graph root stores `{1: 2, 2: {1: <bytes>}}` in all samples; left untouched.
- `7` appears as `1` in samples.

### Node structure (`graph.body[3]`)

Each node is a message with:

- `1` node id (int, not unique to path; e.g. 1/2/4).
- `2` type descriptor `{1:10001, 2:<graphCategory>, 3:22000, 5:<typeId>}`.
- `3` optional duplicate type descriptor (present on many nodes, absent on some events).
- `4` connection entries (list or single message). See “Links” below.
- `5`,`6` fixed32 values (likely editor coordinates; floats decode to the official editor layout).
- `8` optional message with `{1:<int>, 103:{2:<bytes>}}` on some nodes (constants/config); leave unchanged when cloning.

Type id observations (from `B/C.gil`):

- Server graphs: `action.printString` → `1`; `action.finishLevel` → `77`; `event.graphVariableChanged` → `351`.
- Client graphs prepend `200000` to a base id (e.g. `flow.graphEndBoolean` `200000`, `client.query.getSelfEntity` `200033`, `client.query.entity.isPresent` `200103`, `event.graphStart` `200042`, `client.action.hate.addValue` `200084`, `client.query.entity.getAttackTarget` `200035`).

### Links (partially decoded)

Connection entries live in node field `4`:

- Message shape: fields `1`, `2` (small ints), optional `3` (nested message), optional `4` (target port id?), optional `5` (nested) and sometimes `6`.
- In client graphs, subfield `5.1` matches the opposite node id for incoming links; `4` matches a port id on the current node; `5.2/5.3` carry the remote port id (same value in samples).
- Additional data (`3.*`, `6.*`) appears for typed links or constants; keep whatever existed in the template unless a full mapping is known.

Because the exact link schema is not fully mapped, exporting should currently preserve unknown fields from the template and fail fast when an unmapped structure is required.

## Known category codes

From sample manifests and matching graphs:

- `20000` – server/entity (also used for stats/profession/item graphs in samples).
- `20001` – client graphs (boolean filter, integer filter, skill).
- Additional server categories show `2` as `20003/20004/20005` but carry the same node ids as the entity graph in examples.

## Export strategy (planned)

1. Parse the header (length/magic) and extract the protobuf payload without touching non-graph fields.
2. Decode graphs (field `10`), replace only the graph list while copying every other top-level field untouched.
3. Map WebMiliastra `GraphDocument` nodes to `.gil` nodes:
   - Translate node type strings to `typeId` (see table above; rest TBD).
   - Map ports to numeric ids for links; keep template defaults where mapping is unknown.
   - Keep coordinates untouched or derive a safe default when positions are unknown.
4. Re-encode the payload and restore the original header/footer.

Until the mapping is complete, the exporter should report a clear error rather than emitting a corrupted `.gil`.