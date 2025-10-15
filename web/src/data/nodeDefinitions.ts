import type { NodeDefinition } from '../types/node';

const EXECUTION_HEADER = '#C5D253';
const EVENT_HEADER = 'linear-gradient(90deg, #D352AC 0%, #FC5F6C 100%)';
const FLOW_HEADER = '#FD925C';
const QUERY_HEADER = '#3F54AF';
const MATH_HEADER = '#0D5A8B';

// 注意：以下**所有**节点的定义均由AI根据官方节点图编辑器截图推断，可能存在错误或不完整之处，如有任何问题，请在Issue中提出。
export const nodeDefinitions: NodeDefinition[] = [
  // 执行节点/通用
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
  {
    id: "action.setLocalVariable",
    displayName: "设置局部变量",
    category: "执行节点/通用",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "variable",
        label: "局部变量",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "变量名" },
      },
      {
        id: "value",
        label: "值",
        kind: "data-in",
        valueType: "any",
        defaultValue: null,
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "action.loopFinite",
    displayName: "有限循环",
    category: "执行节点/通用",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "execIn", label: "执行", kind: "flow-in" },
      { id: "breakIn", label: "跳出循环", kind: "flow-in", optional: true },
      { id: "loopBody", label: "循环体", kind: "flow-out" },
      { id: "loopComplete", label: "循环完成", kind: "flow-out" },
      {
        id: "startIndex",
        label: "循环起始值",
        kind: "data-in",
        valueType: "int",
        defaultValue: 0,
        ui: { placeholder: "输入整数" },
      },
      {
        id: "endIndex",
        label: "循环终止值",
        kind: "data-in",
        valueType: "int",
        defaultValue: 10,
        ui: { placeholder: "输入整数" },
      },
      {
        id: "currentIndex",
        label: "当前循环值",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "action.breakLoop",
    displayName: "跳出循环",
    category: "执行节点/通用",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
    ],
  },
  {
    id: "action.forwardEvent",
    displayName: "转发事件",
    category: "执行节点/通用",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
        optional: true,
        ui: { accessory: "gear" },
      },
    ],
  },

  // 执行节点/列表相关
  {
    id: "action.list.sort",
    displayName: "列表排序",
    category: "执行节点/列表相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "list",
        label: "列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
      {
        id: "mode",
        label: "排序方式",
        kind: "data-in",
        valueType: "enum",
        defaultValue: "ascending",
        enumValues: [
          { label: "升序", value: "ascending" },
          { label: "降序", value: "descending" },
        ],
      },
    ],
  },
  {
    id: "action.list.modify",
    displayName: "对列表修改值",
    category: "执行节点/列表相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "list",
        label: "列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
      {
        id: "index",
        label: "序号",
        kind: "data-in",
        valueType: "int",
        defaultValue: 0,
        ui: { placeholder: "输入整数" },
      },
      {
        id: "value",
        label: "值",
        kind: "data-in",
        valueType: "any",
        defaultValue: null,
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "action.list.insert",
    displayName: "对列表插入值",
    category: "执行节点/列表相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "list",
        label: "列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
      {
        id: "index",
        label: "插入序号",
        kind: "data-in",
        valueType: "int",
        defaultValue: 0,
        ui: { placeholder: "输入整数" },
      },
      {
        id: "value",
        label: "插入值",
        kind: "data-in",
        valueType: "any",
        defaultValue: null,
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "action.list.remove",
    displayName: "对列表移除值",
    category: "执行节点/列表相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "list",
        label: "列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
      {
        id: "index",
        label: "移除序号",
        kind: "data-in",
        valueType: "int",
        defaultValue: 0,
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.list.iterate",
    displayName: "列表迭代循环",
    category: "执行节点/列表相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "breakIn", label: "跳出循环", kind: "flow-in", optional: true },
      { id: "loopBody", label: "循环体", kind: "flow-out" },
      { id: "loopComplete", label: "循环完成", kind: "flow-out" },
      {
        id: "list",
        label: "迭代列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
      {
        id: "item",
        label: "迭代值",
        kind: "data-out",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "action.list.concat",
    displayName: "拼接列表",
    category: "执行节点/列表相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "targetList",
        label: "目标列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
      {
        id: "incomingList",
        label: "接入的列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "action.list.clear",
    displayName: "清除列表",
    category: "执行节点/列表相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "list",
        label: "列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
    ],
  },
  // 执行节点/自定义变量
  {
    id: "action.setCustomVariable",
    displayName: "设置自定义变量",
    category: "执行节点/自定义变量",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
        optional: true,
      },
      {
        id: "variableName",
        label: "变量名",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "value",
        label: "变量值",
        kind: "data-in",
        valueType: "any",
        defaultValue: null,
        ui: { accessory: "gear" },
      },
      {
        id: "shouldTriggerEvent",
        label: "是否触发事件",
        kind: "data-in",
        valueType: "bool",
        defaultValue: true,
      },
    ],
  },
  {
    id: "action.setGraphVariable",
    displayName: "设置节点图变量",
    category: "执行节点/自定义变量",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "variableName",
        label: "变量名",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "value",
        label: "变量值",
        kind: "data-in",
        valueType: "any",
        defaultValue: null,
        ui: { accessory: "gear" },
      },
      {
        id: "shouldTriggerEvent",
        label: "是否触发事件",
        kind: "data-in",
        valueType: "bool",
        defaultValue: true,
      },
    ],
  },
  // 执行节点/预设状态
  {
    id: "action.setPresetState",
    displayName: "设置预设状态",
    category: "执行节点/预设状态",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
        optional: true,
      },
      {
        id: "presetIndex",
        label: "预设状态索引",
        kind: "data-in",
        valueType: "int",
        defaultValue: 0,
        ui: { placeholder: "输入整数" },
      },
      {
        id: "presetValue",
        label: "预设状态值",
        kind: "data-in",
        valueType: "int",
        defaultValue: 0,
        ui: { placeholder: "输入整数" },
      },
    ],
  },

  // 执行节点/实体相关
  {
    id: "action.createComponent",
    displayName: "创建元件",
    category: "执行节点/实体相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "componentId",
        label: "元件ID",
        kind: "data-in",
        valueType: "componentId",
      },
      { id: "position", label: "位置", kind: "data-in", valueType: "vector3" },
      { id: "rotation", label: "旋转", kind: "data-in", valueType: "vector3" },
      {
        id: "ownerEntity",
        label: "拥有者实体",
        kind: "data-in",
        valueType: "entity",
        optional: true,
      },
      {
        id: "overrideLevel",
        label: "是否覆盖等级",
        kind: "data-in",
        valueType: "bool",
        defaultValue: false,
      },
      {
        id: "level",
        label: "等级",
        kind: "data-in",
        valueType: "int",
        defaultValue: 1,
        ui: { placeholder: "输入整数" },
      },
      {
        id: "unitTagIndexes",
        label: "单位标签索引列表",
        kind: "data-in",
        valueType: "list",
        optional: true,
      },
      {
        id: "createdEntity",
        label: "创建后实体",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },
  {
    id: "action.createComponentGroup",
    displayName: "创建元件组",
    category: "执行节点/实体相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "componentGroupIndex",
        label: "元件组索引",
        kind: "data-in",
        valueType: "int",
        defaultValue: 0,
        ui: { placeholder: "输入整数" },
      },
      { id: "position", label: "位置", kind: "data-in", valueType: "vector3" },
      { id: "rotation", label: "旋转", kind: "data-in", valueType: "vector3" },
      {
        id: "ownerEntity",
        label: "归属者实体",
        kind: "data-in",
        valueType: "entity",
        optional: true,
      },
      {
        id: "level",
        label: "等级",
        kind: "data-in",
        valueType: "int",
        defaultValue: 0,
        ui: { placeholder: "输入整数" },
      },
      {
        id: "unitTagIndexes",
        label: "单位标签索引列表",
        kind: "data-in",
        valueType: "list",
        optional: true,
      },
      {
        id: "overrideLevel",
        label: "是否覆盖等级",
        kind: "data-in",
        valueType: "bool",
        defaultValue: false,
      },
      {
        id: "createdEntities",
        label: "创建后实体列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "action.createEntity",
    displayName: "创建实体",
    category: "执行节点/实体相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      { id: "guid", label: "目标GUID", kind: "data-in", valueType: "guid" },
      {
        id: "unitTagIndexes",
        label: "单位标签索引列表",
        kind: "data-in",
        valueType: "list",
        optional: true,
      },
    ],
  },
  {
    id: "action.destroyEntity",
    displayName: "销毁实体",
    category: "执行节点/实体相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
    ],
  },
  {
    id: "action.toggleModelVisibility",
    displayName: "激活/关闭模型显示",
    category: "执行节点/实体相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shouldActivate",
        label: "是否激活",
        kind: "data-in",
        valueType: "bool",
        defaultValue: true,
      },
    ],
  },
  {
    id: "action.removeEntity",
    displayName: "移除实体",
    category: "执行节点/实体相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
    ],
  },
  // 执行节点/关卡相关
  {
    id: "action.finishLevel",
    displayName: "结算关卡",
    category: "执行节点/关卡相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
    ],
  },
  {
    id: "action.setEnvironmentTime",
    displayName: "设置当前环境时间",
    category: "执行节点/关卡相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "environmentTime",
        label: "环境时间",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
    ],
  },
  {
    id: "action.setEnvironmentTimeRate",
    displayName: "设置环境时间流逝速度",
    category: "执行节点/关卡相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "environmentTimeRate",
        label: "环境时间流逝速度",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "（每秒流逝分钟数）" },
      },
    ],
  },

  // 执行节点/阵营相关
  {
    id: "action.modifyEntityFaction",
    displayName: "修改实体阵营",
    category: "执行节点/阵营相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "faction",
        label: "阵营",
        kind: "data-in",
        valueType: "camp",
      },
    ],
  },

  // 执行节点/玩家与角色相关
  {
    id: "action.teleportPlayer",
    displayName: "传送玩家",
    category: "执行节点/玩家与角色相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "targetPosition",
        label: "目标位置",
        kind: "data-in",
        valueType: "vector3",
      },
      {
        id: "targetRotation",
        label: "目标旋转",
        kind: "data-in",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "action.updateEnvironmentConfig",
    displayName: "修改环境配置",
    category: "执行节点/玩家与角色相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "configIndex",
        label: "环境配置索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "targetPlayers",
        label: "目标玩家列表",
        kind: "data-in",
        valueType: "list",
        optional: true,
      },
      {
        id: "enableWeatherPreset",
        label: "是否启用天气配置",
        kind: "data-in",
        valueType: "bool",
      },
      {
        id: "weatherPresetIndex",
        label: "天气配置序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
        optional: true,
      },
    ],
  },
  {
    id: "action.knockdownAllPlayerCharacters",
    displayName: "击倒玩家所有角色",
    category: "执行节点/玩家与角色相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
    ],
  },
  {
    id: "action.reviveAllPlayerCharacters",
    displayName: "复苏玩家所有角色",
    category: "执行节点/玩家与角色相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "consumeReviveCount",
        label: "是否扣除复苏次数",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  {
    id: "action.reviveCharacter",
    displayName: "复苏角色",
    category: "执行节点/玩家与角色相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "characterEntity",
        label: "角色实体",
        kind: "data-in",
        valueType: "entity",
      },
    ],
  },
  {
    id: "action.unregisterRevivePoint",
    displayName: "注销复苏点",
    category: "执行节点/玩家与角色相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "revivePointIndex",
        label: "复苏点序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.activateRevivePoint",
    displayName: "激活复苏点",
    category: "执行节点/玩家与角色相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "revivePointIndex",
        label: "复苏点序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.setPlayerReviveCount",
    displayName: "设置玩家剩余复苏次数",
    category: "执行节点/玩家与角色相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "remainingCount",
        label: "剩余次数",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.setPlayerReviveDuration",
    displayName: "设置玩家复苏耗时",
    category: "执行节点/玩家与角色相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "duration",
        label: "时长",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.togglePlayerRevive",
    displayName: "允许/禁止玩家复苏",
    category: "执行节点/玩家与角色相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "allowRevive",
        label: "是否允许",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  // 执行节点/碰撞
  {
    id: "action.toggleNativeCollision",
    displayName: "激活/关闭原生碰撞",
    category: "执行节点/碰撞",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shouldActivate",
        label: "是否激活",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  {
    id: "action.toggleNativeCollisionClimbable",
    displayName: "激活/关闭原生碰撞可攀爬性",
    category: "执行节点/碰撞",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shouldActivate",
        label: "是否激活",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  {
    id: "action.toggleExtraCollision",
    displayName: "激活/关闭额外碰撞",
    category: "执行节点/碰撞",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "extraCollisionIndex",
        label: "额外碰撞序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "shouldActivate",
        label: "是否激活",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  {
    id: "action.toggleExtraCollisionClimbable",
    displayName: "激活/关闭额外碰撞可攀爬性",
    category: "执行节点/碰撞",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "extraCollisionIndex",
        label: "额外碰撞序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "shouldActivate",
        label: "是否激活",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  // 执行节点/碰撞触发器
  {
    id: "action.toggleCollisionTrigger",
    displayName: "注册/关闭碰撞触发器",
    category: "执行节点/碰撞触发器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "collisionTriggerGuid",
        label: "碰撞触发器GUID",
        kind: "data-in",
        valueType: "guid",
        ui: { placeholder: "输入GUID" },
      },
      {
        id: "collisionUnitIndex",
        label: "碰撞单位索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "shouldRegister",
        label: "是否注册",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  // ───────────────────────────── 10-战斗 ─────────────────────────────
  // 执行节点/战斗
  {
    id: "action.combat.directHeal",
    displayName: "直接恢复生命",
    category: "执行节点/战斗",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "healSource",
        label: "恢复发起实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "healTarget",
        label: "恢复目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "healAmount",
        label: "恢复量",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "ignoreAdjust",
        label: "是否忽略恢复量调整",
        kind: "data-in",
        valueType: "bool",
      },
      {
        id: "hatredRate",
        label: "产生仇恨的倍率",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "hatredDelta",
        label: "产生仇恨的增量",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "healTags",
        label: "治疗标签列表",
        kind: "data-in",
        valueType: "list",
      },
    ],
  },
  {
    id: "action.combat.attack",
    displayName: "发起攻击",
    category: "执行节点/战斗",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "damageCoeff",
        label: "伤害系数",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "damageDelta",
        label: "伤害增量",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "posOffset",
        label: "位置偏移",
        kind: "data-in",
        valueType: "vector3",
      },
      {
        id: "rotOffset",
        label: "旋转偏移",
        kind: "data-in",
        valueType: "vector3",
      },
      {
        id: "abilityUnit",
        label: "能力单元",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "overrideAbilityUnit",
        label: "是否覆盖能力单元配置",
        kind: "data-in",
        valueType: "bool",
      },
      {
        id: "attackerEntity",
        label: "发起者实体",
        kind: "data-in",
        valueType: "entity",
      },
    ],
  },
  {
    id: "action.combat.heal",
    displayName: "恢复生命",
    category: "执行节点/战斗",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "healAmount",
        label: "恢复量",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "abilityUnit",
        label: "能力单元",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "overrideAbilityUnit",
        label: "是否覆盖能力单元配置",
        kind: "data-in",
        valueType: "bool",
      },
      {
        id: "healSource",
        label: "恢复发起者实体",
        kind: "data-in",
        valueType: "entity",
      },
    ],
  },
  {
    id: "action.combat.loseHp",
    displayName: "损失生命",
    category: "执行节点/战斗",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "hpLoss",
        label: "生命损失量",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "isFatal", label: "是否致命", kind: "data-in", valueType: "bool" },
      {
        id: "canBeBlockedByInvincible",
        label: "是否可被无敌抵挡",
        kind: "data-in",
        valueType: "bool",
      },
      {
        id: "canBeBlockedByLockHp",
        label: "是否可被锁定生命值抵挡",
        kind: "data-in",
        valueType: "bool",
      },
      {
        id: "damageFloatingTextType",
        label: "伤害跳字类型",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },

  // ───────────────────────────── 11-运动器 ─────────────────────────────
  // 执行节点/运动器
  {
    id: "action.moverFixed.start",
    displayName: "开启定点运动器",
    category: "执行节点/运动器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "moverName",
        label: "运动器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      { id: "moveMode", label: "移动方式", kind: "data-in", valueType: "enum" },
      {
        id: "moveSpeed",
        label: "移动速度",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "targetPosition",
        label: "目标位置",
        kind: "data-in",
        valueType: "vector3",
      },
      {
        id: "targetRotation",
        label: "目标旋转",
        kind: "data-in",
        valueType: "vector3",
      },
      {
        id: "lockRotation",
        label: "是否锁定旋转",
        kind: "data-in",
        valueType: "bool",
      },
      {
        id: "paramType",
        label: "参数类型",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "moveTime",
        label: "移动时间",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
    ],
  },
  {
    id: "action.moverBase.stopAndRemove",
    displayName: "停止并删除基础运动器",
    category: "执行节点/运动器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "moverName",
        label: "运动器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "stopAll",
        label: "是否停止所有基础运动器",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  {
    id: "action.moverBase.resume",
    displayName: "恢复基础运动器",
    category: "执行节点/运动器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "moverName",
        label: "运动器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
    ],
  },
  {
    id: "action.moverBase.pause",
    displayName: "暂停基础运动器",
    category: "执行节点/运动器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "moverName",
        label: "运动器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
    ],
  },
  {
    id: "action.moverBase.activate",
    displayName: "激活基础运动器",
    category: "执行节点/运动器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "moverName",
        label: "运动器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
    ],
  },
  {
    id: "action.moverBase.addLookAtTargetRot",
    displayName: "添加朝向目标旋转型基础运动器",
    category: "执行节点/运动器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "moverName",
        label: "运动器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "duration",
        label: "运动器时长",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "targetEuler",
        label: "目标角度",
        kind: "data-in",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "action.moverBase.addUniformLinear",
    displayName: "添加匀速直线型基础运动器",
    category: "执行节点/运动器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "moverName",
        label: "运动器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "duration",
        label: "运动器时长",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "velocity",
        label: "速度向量",
        kind: "data-in",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "action.moverBase.addUniformRotate",
    displayName: "添加匀速旋转型基础运动器",
    category: "执行节点/运动器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "moverName",
        label: "运动器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "duration",
        label: "运动器时长",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "angularVelocity",
        label: "角速度(角度/秒)",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "axis",
        label: "旋转轴朝向",
        kind: "data-in",
        valueType: "vector3",
      },
    ],
  },

  // ───────────────────────────── 12-跟随运动器 ─────────────────────────────
  // 执行节点/跟随运动器
  {
    id: "action.moverFollow.toggle",
    displayName: "激活/关闭跟随运动器",
    category: "执行节点/跟随运动器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shouldActivate",
        label: "是否激活",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  {
    id: "action.moverFollow.switchTargetByGuid",
    displayName: "以GUID切换跟随运动器的目标",
    category: "执行节点/跟随运动器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "followGuid",
        label: "跟随目标GUID",
        kind: "data-in",
        valueType: "guid",
        ui: { placeholder: "输入GUID" },
      },
      {
        id: "socketName",
        label: "跟随目标挂接点名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "posOffset",
        label: "位置偏移",
        kind: "data-in",
        valueType: "vector3",
      },
      {
        id: "rotOffset",
        label: "旋转偏移",
        kind: "data-in",
        valueType: "vector3",
      },
      {
        id: "coordSys",
        label: "跟随坐标系",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "followType",
        label: "跟随类型",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },
  {
    id: "action.moverFollow.switchTargetByEntity",
    displayName: "以实体切换跟随运动器的目标",
    category: "执行节点/跟随运动器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "followEntity",
        label: "跟随目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "socketName",
        label: "跟随目标挂接点名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "posOffset",
        label: "位置偏移",
        kind: "data-in",
        valueType: "vector3",
      },
      {
        id: "rotOffset",
        label: "旋转偏移",
        kind: "data-in",
        valueType: "vector3",
      },
      {
        id: "coordSys",
        label: "跟随坐标系",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "followType",
        label: "跟随类型",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },
  // ───────────────────────────── 13-投射物 ─────────────────────────────
  // 执行节点/投射物
  {
    id: "action.projectile.create",
    displayName: "创建投射物",
    category: "执行节点/投射物",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "componentId",
        label: "元件ID",
        kind: "data-in",
        valueType: "componentId",
      },
      { id: "position", label: "位置", kind: "data-in", valueType: "vector3" },
      { id: "rotation", label: "旋转", kind: "data-in", valueType: "vector3" },
      {
        id: "ownerEntity",
        label: "拥有者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "trackTarget",
        label: "追踪目标",
        kind: "data-in",
        valueType: "entity",
        optional: true,
      },
      {
        id: "overrideLevel",
        label: "是否覆盖等级",
        kind: "data-in",
        valueType: "bool",
      },
      {
        id: "level",
        label: "等级",
        kind: "data-in",
        valueType: "int",
        defaultValue: 1,
        ui: { placeholder: "1" },
      },
      {
        id: "unitTagIndexes",
        label: "单位标签索引列表",
        kind: "data-in",
        valueType: "list",
        optional: true,
      },

      {
        id: "createdEntity",
        label: "创建出的实体",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },

  // ───────────────────────────── 14-特效 ─────────────────────────────
  // 执行节点/特效
  {
    id: "action.fx.clearByAsset",
    displayName: "根据特效资产清除特效",
    category: "执行节点/特效",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "effectAsset",
        label: "特效资产",
        kind: "data-in",
        valueType: "componentId",
      },
    ],
  },
  {
    id: "action.fx.clearLoop",
    displayName: "清除循环特效",
    category: "执行节点/特效",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "effectInstanceId",
        label: "特效实例ID",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
    ],
  },
  {
    id: "action.fx.attachLoop",
    displayName: "挂载循环特效",
    category: "执行节点/特效",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "effectAsset",
        label: "特效资产",
        kind: "data-in",
        valueType: "componentId",
      },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "socketName",
        label: "挂接点名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "followMove",
        label: "是否跟随目标运动",
        kind: "data-in",
        valueType: "bool",
      },
      {
        id: "followRotate",
        label: "是否跟随目标旋转",
        kind: "data-in",
        valueType: "bool",
      },
      {
        id: "posOffset",
        label: "位置偏移",
        kind: "data-in",
        valueType: "vector3",
      },
      {
        id: "rotOffset",
        label: "旋转偏移",
        kind: "data-in",
        valueType: "vector3",
      },
      {
        id: "scale",
        label: "缩放倍率",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },

      {
        id: "playBuiltInSfx",
        label: "是否播放自带的音效",
        kind: "data-in",
        valueType: "bool",
      },
      {
        id: "effectInstanceIdOut",
        label: "特效实例ID",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "action.fx.playTimed",
    displayName: "播放限时特效",
    category: "执行节点/特效",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "effectAsset",
        label: "特效资产",
        kind: "data-in",
        valueType: "componentId",
      },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "socketName",
        label: "挂接点名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "followMove",
        label: "是否跟随目标运动",
        kind: "data-in",
        valueType: "bool",
      },
      {
        id: "followRotate",
        label: "是否跟随目标旋转",
        kind: "data-in",
        valueType: "bool",
      },
      {
        id: "posOffset",
        label: "位置偏移",
        kind: "data-in",
        valueType: "vector3",
      },
      {
        id: "rotOffset",
        label: "旋转偏移",
        kind: "data-in",
        valueType: "vector3",
      },
      {
        id: "scale",
        label: "缩放倍率",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "playBuiltInSfx",
        label: "是否播放自带的音效",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },

  // ───────────────────────────── 15-定时器 ─────────────────────────────
  // 执行节点/定时器
  {
    id: "action.timer.stop",
    displayName: "终止定时器",
    category: "执行节点/定时器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "timerName",
        label: "定时器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
    ],
  },
  {
    id: "action.timer.resume",
    displayName: "恢复定时器",
    category: "执行节点/定时器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "timerName",
        label: "定时器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
    ],
  },
  {
    id: "action.timer.pause",
    displayName: "暂停定时器",
    category: "执行节点/定时器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "timerName",
        label: "定时器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
    ],
  },
  {
    id: "action.timer.start",
    displayName: "启动定时器",
    category: "执行节点/定时器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "timerName",
        label: "定时器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      { id: "loop", label: "是否循环", kind: "data-in", valueType: "bool" },
      {
        id: "timerSequence",
        label: "定时器序列",
        kind: "data-in",
        valueType: "list",
      },
    ],
  },

  // ───────────────────────────── 16-全局计时器 ─────────────────────────────
  // 执行节点/全局计时器
  {
    id: "action.globalTimer.stop",
    displayName: "终止全局计时器",
    category: "执行节点/全局计时器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "timerName",
        label: "计时器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
    ],
  },
  {
    id: "action.globalTimer.resume",
    displayName: "恢复全局计时器",
    category: "执行节点/全局计时器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "timerName",
        label: "计时器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
    ],
  },
  {
    id: "action.globalTimer.pause",
    displayName: "暂停全局计时器",
    category: "执行节点/全局计时器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "timerName",
        label: "计时器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
    ],
  },
  {
    id: "action.globalTimer.start",
    displayName: "启动全局计时器",
    category: "执行节点/全局计时器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "timerName",
        label: "计时器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
    ],
  },
  {
    id: "action.globalTimer.modify",
    displayName: "修改全局计时器",
    category: "执行节点/全局计时器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "timerName",
        label: "计时器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "delta",
        label: "变化值",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
    ],
  },

  // ───────────────────────────── 17-镜头 ─────────────────────────────
  // 执行节点/镜头
  {
    id: "action.camera.switchTemplate",
    displayName: "切换主镜头模板",
    category: "执行节点/镜头",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetPlayers",
        label: "目标玩家列表",
        kind: "data-in",
        valueType: "list",
      },
      {
        id: "templateName",
        label: "镜头模板名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
    ],
  },

  // ───────────────────────────── 18-角色扰动装置 ─────────────────────────────
  // 执行节点/角色扰动装置
  {
    id: "action.playerDisturber.modify",
    displayName: "修改角色扰动装置",
    category: "执行节点/角色扰动装置",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "deviceIndex",
        label: "装置序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },

  // ───────────────────────────── 19-单位状态 ─────────────────────────────
  // 执行节点/单位状态
  {
    id: "action.unitState.add",
    displayName: "添加单位状态",
    category: "执行节点/单位状态",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "applier",
        label: "施加者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "applyResult",
        label: "施加结果",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "target",
        label: "施加目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "slotIndex",
        label: "槽位序号",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "stateConfigId",
        label: "单位状态配置ID",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "stacks",
        label: "施加层数",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "paramsDict",
        label: "单位状态参数字典",
        kind: "data-in",
        valueType: "any",
      },
    ],
  },
  {
    id: "action.unitState.remove",
    displayName: "移除单位状态",
    category: "执行节点/单位状态",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "removeTarget",
        label: "移除目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "stateConfigId",
        label: "单位状态配置ID",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "removeMode",
        label: "移除方式",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "remover",
        label: "移除者实体",
        kind: "data-in",
        valueType: "entity",
        optional: true,
      },
    ],
  },

  // ───────────────────────────── 20-选项卡 ─────────────────────────────
  // 执行节点/选项卡
  {
    id: "action.tab.toggle",
    displayName: "激活/关闭选项卡",
    category: "执行节点/选项卡",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "tabIndex",
        label: "选项卡序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "shouldActivate",
        label: "是否激活",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },

  // ───────────────────────────── 21-碰撞触发源 ─────────────────────────────
  // 执行节点/碰撞触发源
  {
    id: "action.collisionSource.toggle",
    displayName: "激活/关闭碰撞触发发源",
    category: "执行节点/碰撞触发源",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shouldActivate",
        label: "是否激活",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },

  // ───────────────────────────── 22-职业 ─────────────────────────────
  // 执行节点/职业
  {
    id: "action.class.switch",
    displayName: "更改玩家职业",
    category: "执行节点/职业",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      { id: "player", label: "目标玩家", kind: "data-in", valueType: "entity" },
      { id: "classId", label: "职业配置ID", kind: "data-in", valueType: "int" },
    ],
  },
  {
    id: "action.class.setLevel",
    displayName: "更改玩家当前职业等级",
    category: "执行节点/职业",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      { id: "player", label: "目标玩家", kind: "data-in", valueType: "entity" },
      {
        id: "level",
        label: "等级",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.class.addExp",
    displayName: "提升玩家当前职业经验",
    category: "执行节点/职业",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      { id: "player", label: "目标玩家", kind: "data-in", valueType: "entity" },
      {
        id: "exp",
        label: "经验值",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },

  // ───────────────────────────── 23-界面控件组 ─────────────────────────────
  // 执行节点/界面控件组
  {
    id: "action.uiGroup.enableFromLibrary",
    displayName: "激活控件组库内界面控件组",
    category: "执行节点/界面控件组",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      { id: "player", label: "目标玩家", kind: "data-in", valueType: "entity" },
      {
        id: "groupIndex",
        label: "界面控件组索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入索引" },
      },
    ],
  },
  {
    id: "action.uiGroup.switchLayout",
    displayName: "切换当前界面布局",
    category: "执行节点/界面控件组",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      { id: "player", label: "目标玩家", kind: "data-in", valueType: "entity" },
      {
        id: "layoutIndex",
        label: "布局索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入索引" },
      },
    ],
  },
  {
    id: "action.uiGroup.removeFromLibrary",
    displayName: "移除控件组库内界面控件组",
    category: "执行节点/界面控件组",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      { id: "player", label: "目标玩家", kind: "data-in", valueType: "entity" },
      {
        id: "groupIndex",
        label: "界面控件组索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入索引" },
      },
    ],
  },
  {
    id: "action.uiGroup.modifyControl",
    displayName: "修改界面布局内界面控件状态",
    category: "执行节点/界面控件组",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      { id: "player", label: "目标玩家", kind: "data-in", valueType: "entity" },
      {
        id: "controlIndex",
        label: "界面控件索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入索引" },
      },
      {
        id: "displayState",
        label: "显示状态",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },

  // ───────────────────────────── 24-技能 ─────────────────────────────
  // 执行节点/技能
  {
    id: "action.skill.init",
    displayName: "初始化角色技能",
    category: "执行节点/技能",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "skillSlot",
        label: "角色技能槽位",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },
  {
    id: "action.skill.add",
    displayName: "添加角色技能",
    category: "执行节点/技能",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "skillConfigId",
        label: "技能配置ID",
        kind: "data-in",
        valueType: "int",
      },
      {
        id: "skillSlot",
        label: "技能槽位",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },
  {
    id: "action.skill.setCooldown",
    displayName: "设置角色技能冷却",
    category: "执行节点/技能",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "skillSlot",
        label: "角色技能槽位",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "remainSeconds",
        label: "冷却剩余时间",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "limitMax",
        label: "是否限制最大冷却时间",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  {
    id: "action.skill.setResource",
    displayName: "设置技能资源量",
    category: "执行节点/技能",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "resourceConfigId",
        label: "技能资源配置ID",
        kind: "data-in",
        valueType: "int",
      },
      {
        id: "targetValue",
        label: "目标值",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
    ],
  },
  {
    id: "action.skill.removeById",
    displayName: "以ID删除角色技能",
    category: "执行节点/技能",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "skillConfigId",
        label: "技能配置ID",
        kind: "data-in",
        valueType: "int",
      },
    ],
  },
  {
    id: "action.skill.removeBySlot",
    displayName: "以槽位删除角色技能",
    category: "执行节点/技能",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "skillSlot",
        label: "角色技能槽位",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },
  {
    id: "action.skill.modifyCooldown",
    displayName: "修改角色技能冷却",
    category: "执行节点/技能",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "skillSlot",
        label: "角色技能槽位",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "deltaSeconds",
        label: "冷却时间修改值",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "limitMax",
        label: "是否限制最大冷却时间",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  {
    id: "action.skill.modifyResource",
    displayName: "修改技能资源量",
    category: "执行节点/技能",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "resourceConfigId",
        label: "技能资源配置ID",
        kind: "data-in",
        valueType: "int",
      },
      {
        id: "deltaValue",
        label: "变更值",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
    ],
  },
  {
    id: "action.skill.modifyCooldownByMaxPct",
    displayName: "按最大冷却时间修改技能冷却百分比",
    category: "执行节点/技能",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "skillSlot",
        label: "角色技能槽位",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "ratioDelta",
        label: "冷却比例修改值",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "limitMax",
        label: "是否限制最大冷却时间",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  // ───────────────────────────── 25-音效 ─────────────────────────────
  // 执行节点/音效
  {
    id: "action.audio.play2DOnceForPlayer",
    displayName: "玩家播放单次2D音效",
    category: "执行节点/音效",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "audioAssetIndex",
        label: "音效资产索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "volume",
        label: "音量",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "playbackRate",
        label: "播放速度",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
    ],
  },
  {
    id: "action.audio.togglePlayerBgm",
    displayName: "启动/暂停玩家背景音乐",
    category: "执行节点/音效",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shouldResume",
        label: "是否恢复",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  {
    id: "action.audio.toggleSpecificPlayer",
    displayName: "启动/暂停指定音效播放器",
    category: "执行节点/音效",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "playerIndex",
        label: "音效播放器序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "shouldResume",
        label: "是否恢复",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  {
    id: "action.audio.addPlayer",
    displayName: "添加音效播放器",
    category: "执行节点/音效",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      // 顶行左右各一个端口（左输入、右输出）
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "createdPlayerIndex",
        label: "音效播放器序号",
        kind: "data-out",
        valueType: "int",
      },

      {
        id: "audioAssetIndex",
        label: "音效资产索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "volume",
        label: "音量",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "playbackRate",
        label: "播放速度",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "loop", label: "是否循环播放", kind: "data-in", valueType: "bool" },
      {
        id: "loopInterval",
        label: "循环间隔时间",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "is3D", label: "是否为3D音效", kind: "data-in", valueType: "bool" },
      {
        id: "radius",
        label: "范围半径",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "attenuation",
        label: "衰减方式",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "socketName",
        label: "挂接点名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "socketOffset",
        label: "挂接点偏移",
        kind: "data-in",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "action.audio.setPlayerBgmVolume",
    displayName: "调整玩家背景音乐音量",
    category: "执行节点/音效",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "volume",
        label: "音量",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.audio.tuneSpecificPlayer",
    displayName: "调整指定音效播放器",
    category: "执行节点/音效",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "playerIndex",
        label: "音效播放器序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "volume",
        label: "音量",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "playbackRate",
        label: "播放速度",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
    ],
  },
  {
    id: "action.audio.closeSpecificPlayer",
    displayName: "关闭指定音效播放器",
    category: "执行节点/音效",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "playerIndex",
        label: "音效播放器序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.audio.modifyPlayerBgm",
    displayName: "修改玩家背景音乐",
    category: "执行节点/音效",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "bgmIndex",
        label: "背景音乐索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "startTime",
        label: "开始时间",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "endTime",
        label: "结束时间",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "volume",
        label: "音量",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      { id: "loop", label: "是否循环播放", kind: "data-in", valueType: "bool" },
      {
        id: "loopInterval",
        label: "循环播放间隔",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "playbackRate",
        label: "播放速度",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "allowJoinLeave",
        label: "是否允许新入/新出",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },

  // ───────────────────────────── 26-单位标签 ─────────────────────────────
  // 执行节点/单位标签
  {
    id: "action.unitTags.clearAll",
    displayName: "实体清空单位标签",
    category: "执行节点/单位标签",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
    ],
  },
  {
    id: "action.unitTags.add",
    displayName: "实体添加单位标签",
    category: "执行节点/单位标签",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "tagIndex",
        label: "单位标签索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.unitTags.remove",
    displayName: "实体移除单位标签",
    category: "执行节点/单位标签",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "tagIndex",
        label: "单位标签索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },

  // ───────────────────────────── 27-自定义仇恨 ─────────────────────────────
  // 执行节点/自定义仇恨
  {
    id: "action.hatred.taunt",
    displayName: "嘲讽目标",
    category: "执行节点/自定义仇恨",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "taunter",
        label: "嘲讽者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
    ],
  },
  {
    id: "action.hatred.setValue",
    displayName: "设置指定实体的仇恨值",
    category: "执行节点/自定义仇恨",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "ownerEntity",
        label: "仇恨拥有者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "hatredValue",
        label: "仇恨值",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.hatred.removeTarget",
    displayName: "将目标实体移除出仇恨列表",
    category: "执行节点/自定义仇恨",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "ownerEntity",
        label: "仇恨拥有者实体",
        kind: "data-in",
        valueType: "entity",
      },
    ],
  },
  {
    id: "action.hatred.clearForTarget",
    displayName: "清空指定目标的仇恨列表",
    category: "执行节点/自定义仇恨",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "ownerEntity",
        label: "仇恨拥有者",
        kind: "data-in",
        valueType: "entity",
      },
    ],
  },

  // ───────────────────────────── 28-信号 ─────────────────────────────
  // 执行节点/信号
  {
    id: "action.signal.send",
    displayName: "发送信号",
    category: "执行节点/信号",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "signalName",
        label: "信号名",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
    ],
  },

  // ───────────────────────────── 29-铭牌 ─────────────────────────────
  // 执行节点/铭牌
  {
    id: "action.nameplate.apply",
    displayName: "设置实体生效铭牌",
    category: "执行节点/铭牌",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "configIdList",
        label: "铭牌配置ID列表",
        kind: "data-in",
        valueType: "list",
      },
    ],
  },

  // ───────────────────────────── 30-文本气泡 ─────────────────────────────
  // 执行节点/文本气泡
  {
    id: "action.textBubble.switchActive",
    displayName: "切换生效的文本气泡",
    category: "执行节点/文本气泡",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "configId",
        label: "文本气泡配置ID",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },

  // ───────────────────────────── 31-卡牌选择器 ─────────────────────────────
  // 执行节点/卡牌选择器
  {
    id: "action.cardPicker.invoke",
    displayName: "唤起卡牌选择器",
    category: "执行节点/卡牌选择器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetPlayer",
        label: "目标玩家",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "pickerIndex",
        label: "卡牌选择器索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入索引" },
      },
      {
        id: "duration",
        label: "选择时长",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "resultMapList",
        label: "选择结果对应列表",
        kind: "data-in",
        valueType: "list",
      },
      {
        id: "displayMapList",
        label: "选择显示对应列表",
        kind: "data-in",
        valueType: "list",
      },
      {
        id: "selectMin",
        label: "选择数量下限",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "selectMax",
        label: "选择数量上限",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "refreshMode",
        label: "刷新方式",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "refreshMin",
        label: "刷新数量下限",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "refreshMax",
        label: "刷新数量上限",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "defaultReturn",
        label: "默认返回选择",
        kind: "data-in",
        valueType: "list",
      },
    ],
  },
  {
    id: "action.cardPicker.close",
    displayName: "关闭卡牌选择器",
    category: "执行节点/卡牌选择器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetPlayer",
        label: "目标玩家",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "pickerIndex",
        label: "卡牌选择器索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入索引" },
      },
    ],
  },
  {
    id: "action.cardPicker.randomizeList",
    displayName: "随机卡牌选择器选择列表",
    category: "执行节点/卡牌选择器",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "selectionList",
        label: "选择列表",
        kind: "data-in",
        valueType: "list",
      },
    ],
  },

  // ───────────────────────────── 32-关卡结算 ─────────────────────────────
  // 执行节点/关卡结算
  {
    id: "action.settlement.setPlayerSuccess",
    displayName: "设置玩家结算成功状态",
    category: "执行节点/关卡结算",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "resultState",
        label: "结算状态",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },
  {
    id: "action.settlement.setPlayerRankValue",
    displayName: "设置玩家结算排名数值",
    category: "执行节点/关卡结算",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "rankValue",
        label: "排名数值",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.settlement.setPlayerScoreboardItem",
    displayName: "设置玩家结算计分板展示数据",
    category: "执行节点/关卡结算",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "设置实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "order",
        label: "数据顺序",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "name",
        label: "数据名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "value",
        label: "数据值",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "action.settlement.setCampSuccess",
    displayName: "设置阵营结算成功状态",
    category: "执行节点/关卡结算",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      { id: "camp", label: "阵营", kind: "data-in", valueType: "camp" },
      {
        id: "resultState",
        label: "结算状态",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },
  {
    id: "action.settlement.setCampRankValue",
    displayName: "设置阵营结算排名数值",
    category: "执行节点/关卡结算",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      { id: "camp", label: "阵营", kind: "data-in", valueType: "camp" },
      {
        id: "rankValue",
        label: "排名数值",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },

  // ───────────────────────────── 33-光源组件 ─────────────────────────────
  // 执行节点/光源组件
  {
    id: "action.light.toggleEntityLight",
    displayName: "开关实体光源",
    category: "执行节点/光源组件",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "lightIndex",
        label: "光源序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "toggleMode",
        label: "打开或关闭",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },
  // ───────────────────────────── 34-字典 ─────────────────────────────
  // 执行节点/字典
  {
    id: "action.dict.clear",
    displayName: "清空字典",
    category: "执行节点/字典",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "dict",
        label: "字典",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "action.dict.setOrAdd",
    displayName: "对字典设置或新增键值对",
    category: "执行节点/字典",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "dict",
        label: "字典",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "key",
        label: "键",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "value",
        label: "值",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "action.dict.sortByValue",
    displayName: "对字典按值排序",
    category: "执行节点/字典",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "dict",
        label: "字典",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      { id: "keysOut", label: "键列表", kind: "data-out", valueType: "list" },
      { id: "order", label: "排序方式", kind: "data-in", valueType: "enum" },
      { id: "valuesOut", label: "值列表", kind: "data-out", valueType: "list" },
    ],
  },
  {
    id: "action.dict.sortByKey",
    displayName: "对字典按键排序",
    category: "执行节点/字典",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "dict",
        label: "字典",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      { id: "keysOut", label: "键列表", kind: "data-out", valueType: "list" },
      { id: "order", label: "排序方式", kind: "data-in", valueType: "enum" },
      { id: "valuesOut", label: "值列表", kind: "data-out", valueType: "list" },
    ],
  },
  {
    id: "action.dict.removeByKey",
    displayName: "以键对字典移除键值对",
    category: "执行节点/字典",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "dict",
        label: "字典",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "key",
        label: "键",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },

  // ───────────────────────────── 35-结构体 ─────────────────────────────
  // 执行节点/结构体
  {
    id: "action.struct.modify",
    displayName: "修改结构体",
    category: "执行节点/结构体",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "targetStruct",
        label: "目标结构体",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },

  // ───────────────────────────── 36-商店 ─────────────────────────────
  // 执行节点/商店
  {
    id: "action.shop.open",
    displayName: "打开商店",
    category: "执行节点/商店",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "ownerEntity",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.shop.removeCustomSellItemByIndex",
    displayName: "从自定义商店出售表中移除商品",
    category: "执行节点/商店",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "itemIndex",
        label: "商品序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.shop.removeBuyItem",
    displayName: "从物品收购表中移除物品",
    category: "执行节点/商店",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "itemConfigId",
        label: "商品道具配置ID",
        kind: "data-in",
        valueType: "string",
      },
    ],
  },
  {
    id: "action.shop.removeBackpackSellItem",
    displayName: "从背包商店出售表中移除商品",
    category: "执行节点/商店",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "configId",
        label: "道具配置ID",
        kind: "data-in",
        valueType: "string",
      },
    ],
  },
  {
    id: "action.shop.close",
    displayName: "关闭商店",
    category: "执行节点/商店",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
    ],
  },
  {
    id: "action.shop.addCustomSellItem",
    displayName: "向自定义商店出售表中新增商品",
    category: "执行节点/商店",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "ownerEntity",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "itemIndexOut",
        label: "商品索引",
        kind: "data-out",
        valueType: "int",
      },

      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "itemConfigId",
        label: "商品道具配置ID",
        kind: "data-in",
        valueType: "string",
      },
      {
        id: "sellCurrency",
        label: "出售价币字典",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "pageIndex",
        label: "所属页签序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "isLimited",
        label: "是否限购",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "limitCount",
        label: "限购数量",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "priority",
        label: "排序优先级",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "isSellable",
        label: "是否可出售",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },
  {
    id: "action.shop.addBuyItem",
    displayName: "向物品收购表中新增物品",
    category: "执行节点/商店",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "itemConfigId",
        label: "商品道具配置ID",
        kind: "data-in",
        valueType: "string",
      },
      {
        id: "buyCurrency",
        label: "收购货币字典",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "isPurchasable",
        label: "是否可收购",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },
  {
    id: "action.shop.addBackpackSellItem",
    displayName: "向背包商店出售表中新增商品",
    category: "执行节点/商店",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "itemConfigId",
        label: "商品道具配置ID",
        kind: "data-in",
        valueType: "string",
      },
      {
        id: "sellCurrency",
        label: "出售价币字典",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "pageIndex",
        label: "所属页签序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "priority",
        label: "排序优先级",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "isSellable",
        label: "是否可出售",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },
  {
    id: "action.shop.modifyCustomSellInfo",
    displayName: "修改自定义商店商品出售信息",
    category: "执行节点/商店",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "itemIndex",
        label: "商品序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "configId",
        label: "道具配置ID",
        kind: "data-in",
        valueType: "string",
      },
      {
        id: "sellCurrency",
        label: "出售价币字典",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "pageIndex",
        label: "所属页签序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "isLimited",
        label: "是否限购",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "limitCount",
        label: "限购数量",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "priority",
        label: "排序优先级",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "isSellable",
        label: "是否可出售",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },
  {
    id: "action.shop.modifyBuyInfo",
    displayName: "修改物品收购表中道具收购信息",
    category: "执行节点/商店",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "itemConfigId",
        label: "商品道具配置ID",
        kind: "data-in",
        valueType: "string",
      },
      {
        id: "buyCurrency",
        label: "收购货币字典",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "isPurchasable",
        label: "是否可收购",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },
  {
    id: "action.shop.modifyBackpackSellInfo",
    displayName: "修改背包商店商品出售信息",
    category: "执行节点/商店",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "configId",
        label: "道具配置ID",
        kind: "data-in",
        valueType: "string",
      },
      {
        id: "sellCurrency",
        label: "出售价币字典",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "pageIndex",
        label: "所属页签序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "priority",
        label: "排序优先级",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "isSellable",
        label: "是否可出售",
        kind: "data-in",
        valueType: "enum",
      },
    ],
  },

  // ───────────────────────────── 37-装备 ─────────────────────────────
  // 执行节点/装备
  {
    id: "action.affix.remove",
    displayName: "移除装备词条",
    category: "执行节点/装备",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "equipIndex",
        label: "装备索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "affixIndex",
        label: "词条序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.affix.modifyValue",
    displayName: "修改装备词条值",
    category: "执行节点/装备",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "equipIndex",
        label: "装备索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "affixIndex",
        label: "词条序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "affixValue",
        label: "词条数值",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
    ],
  },
  {
    id: "action.affix.addAtIndex",
    displayName: "装备指定序号添加词条",
    category: "执行节点/装备",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "equipIndex",
        label: "装备索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "affixConfigId",
        label: "词条配置ID",
        kind: "data-in",
        valueType: "string",
      },
      {
        id: "insertIndex",
        label: "插入序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "overwrite",
        label: "是否覆盖词条值",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "affixValue",
        label: "词条数值",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
    ],
  },
  {
    id: "action.affix.add",
    displayName: "装备添加词条",
    category: "执行节点/装备",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },
      {
        id: "equipIndex",
        label: "装备索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "affixConfigId",
        label: "词条配置ID",
        kind: "data-in",
        valueType: "string",
      },
      {
        id: "overwrite",
        label: "是否覆盖词条值",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "affixValue",
        label: "词条数值",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
    ],
  },
  // ───────────────────────────── 38-道具与背包 ─────────────────────────────
  // 执行节点/道具与背包
  {
    id: "action.loot.setDropContent",
    displayName: "设置战利品掉落内容",
    category: "执行节点/道具与背包",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "dropperEntity",
        label: "掉落者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "lootDict",
        label: "战利品掉落字典",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "action.loot.setDropType",
    displayName: "设置战利品掉落类型",
    category: "执行节点/道具与背包",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "dropperEntity",
        label: "掉落者实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "dropType", label: "掉落类型", kind: "data-in", valueType: "enum" },
    ],
  },
  {
    id: "action.backpack.setDropItemCurrencyCount",
    displayName: "设置背包掉落道具/货币数量",
    category: "执行节点/道具与背包",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "ownerEntity",
        label: "背包持有者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "configId",
        label: "道具/货币配置ID",
        kind: "data-in",
        valueType: "string",
      },
      {
        id: "dropCount",
        label: "掉落数量",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      { id: "dropType", label: "掉落类型", kind: "data-in", valueType: "enum" },
    ],
  },
  {
    id: "action.backpack.setItemDropContent",
    displayName: "设置背包道具掉落内容",
    category: "执行节点/道具与背包",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "ownerEntity",
        label: "背包持有者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "itemDropDict",
        label: "道具掉落字典",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      { id: "dropType", label: "掉落类型", kind: "data-in", valueType: "enum" },
    ],
  },
  {
    id: "action.backpack.increaseMaxCapacity",
    displayName: "增加背包最大容量",
    category: "执行节点/道具与背包",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "ownerEntity",
        label: "背包持有者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "deltaCapacity",
        label: "增加容量",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.loot.modifyCurrencyCountOnDropEntity",
    displayName: "修改掉落物组件货币数量",
    category: "执行节点/道具与背包",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "dropEntity",
        label: "掉落物实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "currencyConfigId",
        label: "货币配置ID",
        kind: "data-in",
        valueType: "string",
      },
      {
        id: "currencyCount",
        label: "货币数量",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.loot.modifyItemCountOnDropEntity",
    displayName: "修改掉落物组件道具数量",
    category: "执行节点/道具与背包",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "dropEntity",
        label: "掉落物实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "itemConfigId",
        label: "道具配置ID",
        kind: "data-in",
        valueType: "string",
      },
      {
        id: "itemCount",
        label: "道具数量",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.backpack.modifyCurrency",
    displayName: "修改背包货币数量",
    category: "执行节点/道具与背包",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "ownerEntity",
        label: "背包持有者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "currencyConfigId",
        label: "货币配置ID",
        kind: "data-in",
        valueType: "string",
      },
      {
        id: "delta",
        label: "变更值",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.backpack.modifyItem",
    displayName: "修改背包道具数量",
    category: "执行节点/道具与背包",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "ownerEntity",
        label: "背包持有者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "itemConfigId",
        label: "道具配置ID",
        kind: "data-in",
        valueType: "string",
      },
      {
        id: "delta",
        label: "变更值",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },

  // ───────────────────────────── 39-小地图标识组件 ─────────────────────────────
  // 执行节点/小地图标识组件
  {
    id: "action.minimap.setVisibleMarkerPlayers",
    displayName: "修改可见小地图标识的玩家列表",
    category: "执行节点/小地图标识组件",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "markerIndex",
        label: "小地图标识序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "playerList",
        label: "玩家列表",
        kind: "data-in",
        valueType: "list",
      },
    ],
  },
  {
    id: "action.minimap.setScale",
    displayName: "修改小地图缩放",
    category: "执行节点/小地图标识组件",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetPlayer",
        label: "目标玩家",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "scale",
        label: "缩放尺寸",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
    ],
  },
  {
    id: "action.minimap.setMarkerEnabledState",
    displayName: "修改小地图标识生效状态",
    category: "执行节点/小地图标识组件",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "markerIndexList",
        label: "小地图标识序号列表",
        kind: "data-in",
        valueType: "list",
      },
      { id: "enabled", label: "是否生效", kind: "data-in", valueType: "bool" },
    ],
  },
  {
    id: "action.minimap.setMarkerPlayerTag",
    displayName: "修改小地图标识的玩家标记",
    category: "执行节点/小地图标识组件",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "markerIndex",
        label: "小地图标识序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "playerEntity",
        label: "对应玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
    ],
  },
  {
    id: "action.minimap.setTrackingMarkerPlayers",
    displayName: "修改追踪小地图标识的玩家列表",
    category: "执行节点/小地图标识组件",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "markerIndex",
        label: "小地图标识序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "playerList",
        label: "玩家列表",
        kind: "data-in",
        valueType: "list",
      },
    ],
  },

  // ───────────────────────────── 40-造物巡逻 ─────────────────────────────
  // 执行节点/造物巡逻
  {
    id: "action.patrol.switchTemplate",
    displayName: "切换造物巡逻模板",
    category: "执行节点/造物巡逻",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "constructEntity",
        label: "造物实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "templateIndex",
        label: "巡逻模板序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },

  // ───────────────────────────── 41-排行榜 ─────────────────────────────
  // 执行节点/排行榜
  {
    id: "action.leaderboard.setScoreInt",
    displayName: "以整数设置玩家排行榜分数",
    category: "执行节点/排行榜",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "playerIndexList",
        label: "玩家序号列表",
        kind: "data-in",
        valueType: "list",
      },
      {
        id: "score",
        label: "排行榜分数",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "boardIndex",
        label: "排行榜序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.leaderboard.setScoreFloat",
    displayName: "以浮点数设置玩家排行榜分数",
    category: "执行节点/排行榜",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "playerIndexList",
        label: "玩家序号列表",
        kind: "data-in",
        valueType: "list",
      },
      {
        id: "score",
        label: "排行榜分数",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "boardIndex",
        label: "排行榜序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },

  // ───────────────────────────── 42-成就 ─────────────────────────────
  // 执行节点/成就
  {
    id: "action.achievement.setProgressCount",
    displayName: "设置成就进度计数",
    category: "执行节点/成就",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "设置实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "achievementIndex",
        label: "成就序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "progressCount",
        label: "进度计数",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.achievement.changeProgressCount",
    displayName: "变更成就进度计数",
    category: "执行节点/成就",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "变更实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "achievementIndex",
        label: "成就序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "delta",
        label: "进度计数变更值",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },

  // ───────────────────────────── 43-扫描标签 ─────────────────────────────
  // 执行节点/扫描标签
  {
    id: "action.scan.setActiveScanTagIndex",
    displayName: "设置扫描组件的生效扫描标签序号",
    category: "执行节点/扫描标签",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "tagIndex",
        label: "扫描标签序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.scan.setTagRule",
    displayName: "设置扫描标签的规则",
    category: "执行节点/扫描标签",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "ruleType", label: "规则类型", kind: "data-in", valueType: "enum" },
    ],
  },

  // ───────────────────────────── 44-段位 ─────────────────────────────
  // 执行节点/段位
  {
    id: "action.rank.setPlayerEscapeValidity",
    displayName: "设置玩家逃跑合法性",
    category: "执行节点/段位",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "isValid", label: "是否合法", kind: "data-in", valueType: "bool" },
    ],
  },
  {
    id: "action.rank.setPlayerRankDeltaScore",
    displayName: "设置玩家段位变化分数",
    category: "执行节点/段位",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "settlementState",
        label: "结算状态",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "deltaScore",
        label: "变化分数",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  {
    id: "action.rank.switchActiveScoreGroup",
    displayName: "切换玩家竞技段位生效的计分组",
    category: "执行节点/段位",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "groupIndex",
        label: "计分组序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },

  // ───────────────────────────── 45-实体布设组 ─────────────────────────────
  // 执行节点/实体布设组
  {
    id: "action.placement.toggleGroup",
    displayName: "激活/关闭实体布设组",
    category: "执行节点/实体布设组",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "groupIndex",
        label: "实体布设组索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "shouldActivate",
        label: "是否激活",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },

  // ───────────────────────────── 46-聊天频道 ─────────────────────────────
  // 执行节点/聊天频道
  {
    id: "action.chat.setChannelEnabled",
    displayName: "设置聊天频道开关",
    category: "执行节点/聊天频道",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "channelIndex",
        label: "频道索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "textEnabled",
        label: "文字开关",
        kind: "data-in",
        valueType: "bool",
      },
    ],
  },
  {
    id: "action.chat.setPlayerCurrentChannel",
    displayName: "设置玩家当前频道",
    category: "执行节点/聊天频道",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "playerGuid",
        label: "玩家GUID",
        kind: "data-in",
        valueType: "guid",
      },
      {
        id: "channelIndexList",
        label: "频道索引列表",
        kind: "data-in",
        valueType: "list",
      },
    ],
  },
  {
    id: "action.chat.modifyPlayerChannelPermission",
    displayName: "修改玩家频道权限",
    category: "执行节点/聊天频道",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "playerGuid",
        label: "玩家GUID",
        kind: "data-in",
        valueType: "guid",
      },
      {
        id: "channelIndex",
        label: "频道索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      { id: "join", label: "是否加入", kind: "data-in", valueType: "bool" },
    ],
  },

  // ───────────────────────────── 47-奇域礼盒相关 ─────────────────────────────
  // 执行节点/奇域礼盒相关
  {
    id: "action.giftBox.consume",
    displayName: "消耗礼盒",
    category: "执行节点/奇域礼盒相关",
    kind: "action",
    headerColor: EXECUTION_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      { id: "flowOut", label: "完成", kind: "flow-out" },

      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "boxIndex",
        label: "礼盒索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "consumeCount",
        label: "消耗数量",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
    ],
  },
  // ───────────────────────────── 00-自定义变量 ─────────────────────────────
  // 事件节点/自定义变量
  {
    id: "event.graphVariableChanged",
    displayName: "节点图变量变化时",
    category: "事件节点/自定义变量",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "variableName",
        label: "变量名",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "oldValue",
        label: "变化前值",
        kind: "data-out",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "newValue",
        label: "变化后值",
        kind: "data-out",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "event.customVariableChanged",
    displayName: "自定义变量变化时",
    category: "事件节点/自定义变量",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "variableName",
        label: "变量名",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "oldValue",
        label: "变化前值",
        kind: "data-out",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "newValue",
        label: "变化后值",
        kind: "data-out",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },

  // ───────────────────────────── 01-预设状态 ─────────────────────────────
  // 事件节点/预设状态
  {
    id: "event.presetStateChanged",
    displayName: "预设状态变化时",
    category: "事件节点/预设状态",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "presetIndex",
        label: "预设状态索引",
        kind: "data-out",
        valueType: "int",
      },
      { id: "oldValue", label: "变化前值", kind: "data-out", valueType: "int" },
      { id: "newValue", label: "变化后值", kind: "data-out", valueType: "int" },
    ],
  },

  // ───────────────────────────── 02-实体相关 ─────────────────────────────
  // 事件节点/实体相关
  {
    id: "event.characterMoveSpeedReached",
    displayName: "角色移动速度达到条件时",
    category: "事件节点/实体相关",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "stateConfigId",
        label: "单位状态配置ID",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "cmpType",
        label: "条件：比较类型",
        kind: "data-out",
        valueType: "enum",
      },
      {
        id: "cmpValue",
        label: "条件：比较值",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "currentSpeed",
        label: "当前移动速度",
        kind: "data-out",
        valueType: "float",
      },
    ],
  },
  {
    id: "event.entityCreated",
    displayName: "实体创建时",
    category: "事件节点/实体相关",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
    ],
  },
  {
    id: "event.entityDestroyed",
    displayName: "实体销毁时",
    category: "事件节点/实体相关",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      { id: "position", label: "位置", kind: "data-out", valueType: "vector3" },
      { id: "rotation", label: "朝向", kind: "data-out", valueType: "vector3" },
      {
        id: "entityType",
        label: "实体类型",
        kind: "data-out",
        valueType: "enum",
      },
      { id: "camp", label: "阵营", kind: "data-out", valueType: "camp" },
      {
        id: "damageSource",
        label: "伤害来源",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "ownerEntity",
        label: "归属者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "customVarsSnap",
        label: "自定义变量组件快照",
        kind: "data-out",
        valueType: "any",
      },
    ],
  },
  {
    id: "event.entityRemovedOrDestroyed",
    displayName: "实体移除/销毁时",
    category: "事件节点/实体相关",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
    ],
  },
  // ───────────────────────────── 03-关卡相关 ─────────────────────────────
  // 事件节点/关卡相关

  // ───────────────────────────── 04-阵营相关 ─────────────────────────────
  // 事件节点/阵营相关
  {
    id: "event.entityCampChanged",
    displayName: "实体阵营变化时",
    category: "事件节点/阵营相关",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "oldCamp",
        label: "变化前阵营",
        kind: "data-out",
        valueType: "camp",
      },
      {
        id: "newCamp",
        label: "变化后阵营",
        kind: "data-out",
        valueType: "camp",
      },
    ],
  },

  // ───────────────────────────── 05-玩家与角色相关 ─────────────────────────────
  // 事件节点/玩家与角色相关
  {
    id: "event.playerTeleportFinished",
    displayName: "玩家传送完成时",
    category: "事件节点/玩家与角色相关",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "playerGuid",
        label: "玩家GUID",
        kind: "data-out",
        valueType: "guid",
      },
    ],
  },
  {
    id: "event.playerAbnormalDownAndRevived",
    displayName: "玩家异常倒下并复苏时",
    category: "事件节点/玩家与角色相关",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },
  {
    id: "event.playerAllCharactersRevived",
    displayName: "玩家所有角色复苏时",
    category: "事件节点/玩家与角色相关",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },
  {
    id: "event.playerAllCharactersDown",
    displayName: "玩家所有角色倒下时",
    category: "事件节点/玩家与角色相关",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-out",
        valueType: "entity",
      },
      { id: "reason", label: "原因", kind: "data-out", valueType: "enum" },
    ],
  },
  {
    id: "event.characterRevived",
    displayName: "角色复苏时",
    category: "事件节点/玩家与角色相关",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "characterEntity",
        label: "角色实体",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },
  {
    id: "event.characterDown",
    displayName: "角色倒下时",
    category: "事件节点/玩家与角色相关",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "characterEntity",
        label: "角色实体",
        kind: "data-out",
        valueType: "entity",
      },
      { id: "reason", label: "原因", kind: "data-out", valueType: "enum" },
      {
        id: "attackerEntity",
        label: "击倒者实体",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },

  // ───────────────────────────── 06-碰撞触发器 ─────────────────────────────
  // 事件节点/碰撞触发器
  {
    id: "event.leaveCollisionTrigger",
    displayName: "离开碰撞触发器时",
    category: "事件节点/碰撞触发器",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "leaverEntity",
        label: "离开者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "leaverGuid",
        label: "离开者实体GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "triggerEntity",
        label: "触发器实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "triggerGuid",
        label: "触发器实体GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "triggerIndex",
        label: "触发器序号",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "event.enterCollisionTrigger",
    displayName: "进入碰撞触发器时",
    category: "事件节点/碰撞触发器",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "entererEntity",
        label: "进入者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "entererGuid",
        label: "进入者实体GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "triggerEntity",
        label: "触发器实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "triggerGuid",
        label: "触发器实体GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "triggerIndex",
        label: "触发器序号",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 07-战斗 ─────────────────────────────
  // 事件节点/战斗
  {
    id: "event.healIssued",
    displayName: "发起恢复生命值时",
    category: "事件节点/战斗",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "healTarget",
        label: "恢复目标实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "healAmount",
        label: "恢复量",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "healTags",
        label: "恢复标签列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "event.enterInterruptible",
    displayName: "进入易受打断状态时",
    category: "事件节点/战斗",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "attacker",
        label: "攻击者",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },
  {
    id: "event.attackHit",
    displayName: "攻击命中时",
    category: "事件节点/战斗",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "victim",
        label: "受击者实体",
        kind: "data-out",
        valueType: "entity",
      },
      { id: "damage", label: "伤害量", kind: "data-out", valueType: "float" },
      {
        id: "attackTags",
        label: "攻击标签列表",
        kind: "data-out",
        valueType: "list",
      },
      {
        id: "elementType",
        label: "元素类型",
        kind: "data-out",
        valueType: "enum",
      },
      {
        id: "elementAdv",
        label: "元素攻击强效",
        kind: "data-out",
        valueType: "float",
      },
    ],
  },
  {
    id: "event.attacked",
    displayName: "受到攻击时",
    category: "事件节点/战斗",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "attacker",
        label: "攻击者实体",
        kind: "data-out",
        valueType: "entity",
      },
      { id: "damage", label: "伤害量", kind: "data-out", valueType: "float" },
      {
        id: "attackTags",
        label: "攻击标签列表",
        kind: "data-out",
        valueType: "list",
      },
      {
        id: "elementType",
        label: "元素类型",
        kind: "data-out",
        valueType: "enum",
      },
      {
        id: "elementAdv",
        label: "元素攻击强效",
        kind: "data-out",
        valueType: "float",
      },
    ],
  },
  {
    id: "event.healed",
    displayName: "被恢复生命值时",
    category: "事件节点/战斗",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "healer",
        label: "治疗者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "healAmount",
        label: "恢复量",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "healTags",
        label: "恢复标签列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },

  // ───────────────────────────── 08-运动器 ─────────────────────────────
  // 事件节点/运动器
  {
    id: "event.pathReachedWaypoint",
    displayName: "路径到达路点时",
    category: "事件节点/运动器",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "moverName",
        label: "运动器名称",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "waypointIndex",
        label: "路径点序号",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "event.basicMoverStopped",
    displayName: "基础运动器停止时",
    category: "事件节点/运动器",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "moverName",
        label: "运动器名称",
        kind: "data-out",
        valueType: "string",
      },
    ],
  },

  // ───────────────────────────── 09-命中判定 ─────────────────────────────
  // 事件节点/命中判定
  {
    id: "event.hitCheckTriggered",
    displayName: "命中检测触发时",
    category: "事件节点/命中判定",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "hitHurtbox",
        label: "是否命中受击盒",
        kind: "data-out",
        valueType: "bool",
      },
      {
        id: "hitEntity",
        label: "命中实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "hitPosition",
        label: "命中位置",
        kind: "data-out",
        valueType: "vector3",
      },
    ],
  },

  // ───────────────────────────── 10-定时器 ─────────────────────────────
  // 事件节点/定时器
  {
    id: "event.timerTriggered",
    displayName: "定时器触发时",
    category: "事件节点/定时器",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "timerName",
        label: "定时器名称",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "timerSeqIndex",
        label: "定时器序列序号",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "loopCount",
        label: "循环次数",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 11-全局计时器 ─────────────────────────────
  // 事件节点/全局计时器
  {
    id: "event.globalTimerTriggered",
    displayName: "全局计时器触发时",
    category: "事件节点/全局计时器",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "timerName",
        label: "计时器名称",
        kind: "data-out",
        valueType: "string",
      },
    ],
  },

  // ───────────────────────────── 12-界面控件组 ─────────────────────────────
  // 事件节点/界面控件组
  {
    id: "event.uiControlGroupTriggered",
    displayName: "界面控件组触发时",
    category: "事件节点/界面控件组",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "groupComboIndex",
        label: "界面控件组组合索引",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "groupIndex",
        label: "界面控件组索引",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 13-单位状态 ─────────────────────────────
  // 事件节点/单位状态
  {
    id: "event.elementReaction",
    displayName: "发生元素反应事件时",
    category: "事件节点/单位状态",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "reactionType",
        label: "元素反应类型",
        kind: "data-out",
        valueType: "enum",
      },
      {
        id: "triggerEntity",
        label: "触发者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "triggerGuid",
        label: "触发者GUID",
        kind: "data-out",
        valueType: "guid",
      },
    ],
  },
  {
    id: "event.shieldAttacked",
    displayName: "护盾受到攻击时",
    category: "事件节点/单位状态",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "attackerEntity",
        label: "攻击者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "attackerGuid",
        label: "攻击者GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "stateConfigId",
        label: "单位状态配置ID",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "layerBefore",
        label: "攻击前层数",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "layerAfter",
        label: "攻击后层数",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "shieldAmountBefore",
        label: "攻击前该单位状态的护盾含量",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "shieldAmountAfter",
        label: "攻击后该单位状态的护盾含量",
        kind: "data-out",
        valueType: "float",
      },
    ],
  },
  {
    id: "event.unitStateEnded",
    displayName: "单位状态结束时",
    category: "事件节点/单位状态",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "stateConfigId",
        label: "单位状态配置ID",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "applierEntity",
        label: "施加者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "isInfinite",
        label: "持续时间是否无限",
        kind: "data-out",
        valueType: "bool",
      },
      {
        id: "timeRemain",
        label: "状态剩余时长",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "layerRemain",
        label: "状态剩余层数",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "removerEntity",
        label: "移除者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "removeReason",
        label: "移除原因",
        kind: "data-out",
        valueType: "enum",
      },
      {
        id: "slotIndex",
        label: "槽位序号",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "event.unitStateChanged",
    displayName: "单位状态变更时",
    category: "事件节点/单位状态",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "stateConfigId",
        label: "单位状态配置ID",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "applierEntity",
        label: "施加者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "isInfinite",
        label: "持续时间是否无限",
        kind: "data-out",
        valueType: "bool",
      },
      {
        id: "timeRemain",
        label: "状态剩余时长",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "layerRemain",
        label: "状态剩余层数",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "layerOriginal",
        label: "状态原始层数",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "slotIndex",
        label: "槽位序号",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 14-选项卡 ─────────────────────────────
  // 事件节点/选项卡
  {
    id: "event.tabSelected",
    displayName: "选项卡选中时",
    category: "事件节点/选项卡",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "tabIndex",
        label: "选项卡序号",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "selectorEntity",
        label: "选择者实体",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },

  // ───────────────────────────── 15-造物 ─────────────────────────────
  // 事件节点/造物
  {
    id: "event.constructExitCombat",
    displayName: "造物脱战时",
    category: "事件节点/造物",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
    ],
  },
  {
    id: "event.constructEnterCombat",
    displayName: "造物入战时",
    category: "事件节点/造物",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
    ],
  },

  // ───────────────────────────── 16-职业 ─────────────────────────────
  // 事件节点/职业
  {
    id: "event.playerCareerRemoved",
    displayName: "玩家职业解除时",
    category: "事件节点/职业",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "careerConfigIdOld",
        label: "更改前职业配置ID",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "careerConfigIdNew",
        label: "更改后职业配置ID",
        kind: "data-out",
        valueType: "string",
      },
    ],
  },
  {
    id: "event.playerCareerLevelChanged",
    displayName: "玩家职业等级变化时",
    category: "事件节点/职业",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "levelOld",
        label: "变化前等级",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "levelNew",
        label: "变化后等级",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "event.playerCareerChanged",
    displayName: "玩家职业更改时",
    category: "事件节点/职业",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "careerConfigIdOld",
        label: "更改前职业配置ID",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "careerConfigIdNew",
        label: "更改后职业配置ID",
        kind: "data-out",
        valueType: "string",
      },
    ],
  },

  // ───────────────────────────── 17-技能 ─────────────────────────────
  // 事件节点/技能
  {
    id: "event.skillNodeInvoked",
    displayName: "技能节点调用时",
    category: "事件节点/技能",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "invokerEntity",
        label: "调用者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "invokerGuid",
        label: "调用者GUID",
        kind: "data-out",
        valueType: "guid",
      },
      { id: "param1", label: "参数1", kind: "data-out", valueType: "any" },
      { id: "param2", label: "参数2", kind: "data-out", valueType: "any" },
      { id: "param3", label: "参数3", kind: "data-out", valueType: "any" },
    ],
  },

  // ───────────────────────────── 18-自定义仇恨 ─────────────────────────────
  // 事件节点/自定义仇恨
  {
    id: "event.hatredTargetChanged",
    displayName: "仇恨目标变化时",
    category: "事件节点/自定义仇恨",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "targetOld",
        label: "变化前仇恨目标",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "targetNew",
        label: "变化后仇恨目标",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },
  {
    id: "event.selfExitCombat",
    displayName: "自身脱战时",
    category: "事件节点/自定义仇恨",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
    ],
  },
  {
    id: "event.selfEnterCombat",
    displayName: "自身入战时",
    category: "事件节点/自定义仇恨",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
    ],
  },

  // ───────────────────────────── 19-信号 ─────────────────────────────
  // 事件节点/信号
  {
    id: "event.signalListen",
    displayName: "监听信号",
    category: "事件节点/信号",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "signalName",
        label: "信号名",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "sourceEntity",
        label: "事件源实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "sourceGuid",
        label: "事件源GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "signalFrom",
        label: "信号来源实体",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },

  // ───────────────────────────── 20-卡牌选择器 ─────────────────────────────
  // 事件节点/卡牌选择器
  {
    id: "event.cardPickerCompleted",
    displayName: "卡牌选择器完成时",
    category: "事件节点/卡牌选择器",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "targetPlayer",
        label: "目标玩家",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "resultList",
        label: "选择结果列表",
        kind: "data-out",
        valueType: "list",
      },
      {
        id: "completeReason",
        label: "完成原因",
        kind: "data-out",
        valueType: "enum",
      },
      {
        id: "pickerIndex",
        label: "卡牌选择器索引",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 21-文本气泡 ─────────────────────────────
  // 事件节点/文本气泡
  {
    id: "event.textBubbleCompleted",
    displayName: "文本气泡完成时",
    category: "事件节点/文本气泡",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "气泡归属者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "characterEntity",
        label: "角色实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "bubbleConfigId",
        label: "文本气泡配置ID",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "completeCount",
        label: "文本气泡完成次数",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 22-商店 ─────────────────────────────
  // 事件节点/商店
  {
    id: "event.shopSellCustomItem",
    displayName: "商店出售自定义商品时",
    category: "事件节点/商店",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "shopOwner",
        label: "商店持有者",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "shopOwnerGuid",
        label: "商店持有者GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "buyerEntity",
        label: "购买者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "itemIndex",
        label: "商品序号",
        kind: "data-out",
        valueType: "int",
      },
      { id: "buyCount", label: "购买数量", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "event.shopSellBackpackItem",
    displayName: "商店出售背包物品时",
    category: "事件节点/商店",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "shopOwner",
        label: "商店持有者",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "shopOwnerGuid",
        label: "商店持有者GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "buyerEntity",
        label: "购买者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "itemConfigId",
        label: "道具配置ID",
        kind: "data-out",
        valueType: "string",
      },
      { id: "buyCount", label: "购买数量", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "event.shopBuyItems",
    displayName: "商店收购道具时",
    category: "事件节点/商店",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "shopOwner",
        label: "商店持有者",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "shopOwnerGuid",
        label: "商店持有者GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "sellerEntity",
        label: "出售者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "buyDict",
        label: "收购物品字典",
        kind: "data-out",
        valueType: "any",
      },
    ],
  },

  // ───────────────────────────── 23-装备 ─────────────────────────────
  // 事件节点/装备
  {
    id: "event.equipmentInitialized",
    displayName: "装备初始化时",
    category: "事件节点/装备",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "装备持有者",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "ownerGuid",
        label: "装备持有者GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "equipIndex",
        label: "装备索引",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "event.equipmentAffixValueChanged",
    displayName: "装备的词条数值改变时",
    category: "事件节点/装备",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "装备持有者",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "ownerGuid",
        label: "装备持有者GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "equipIndex",
        label: "装备索引",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "affixIndex",
        label: "词条序号",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "valueOld",
        label: "改变前数值",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "valueNew",
        label: "改变后数值",
        kind: "data-out",
        valueType: "float",
      },
    ],
  },
  {
    id: "event.equipmentEquipped",
    displayName: "装备被穿戴时",
    category: "事件节点/装备",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "装备持有者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "ownerGuid",
        label: "装备持有者GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "equipIndex",
        label: "装备索引",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "event.equipmentUnequipped",
    displayName: "装备被卸下时",
    category: "事件节点/装备",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "装备持有者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "ownerGuid",
        label: "装备持有者GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "equipIndex",
        label: "装备索引",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 24-道具 ─────────────────────────────
  // 事件节点/道具
  {
    id: "event.backpackItemUsed",
    displayName: "背包内道具被使用时",
    category: "事件节点/道具",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "道具持有者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "ownerGuid",
        label: "道具持有者GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "itemConfigId",
        label: "道具配置ID",
        kind: "data-out",
        valueType: "string",
      },
      { id: "useCount", label: "使用数量", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "event.backpackCurrencyChanged",
    displayName: "背包货币数量变化时",
    category: "事件节点/道具",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "货币持有者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "ownerGuid",
        label: "货币持有者GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "currencyConfigId",
        label: "货币配置ID",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "currencyDelta",
        label: "货币变化值",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "event.backpackItemAdded",
    displayName: "背包道具新增时",
    category: "事件节点/道具",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "道具持有者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "ownerGuid",
        label: "道具持有者GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "itemConfigId",
        label: "道具配置ID",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "gainCount",
        label: "获得数量",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "event.backpackItemCountChanged",
    displayName: "背包道具数量变化时",
    category: "事件节点/道具",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "道具持有者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "ownerGuid",
        label: "道具持有者GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "itemConfigId",
        label: "道具配置ID",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "countBefore",
        label: "变化前数量",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "countAfter",
        label: "变化后数量",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "changeReason",
        label: "变化原因",
        kind: "data-out",
        valueType: "enum",
      },
    ],
  },
  {
    id: "event.backpackItemLost",
    displayName: "背包道具失去时",
    category: "事件节点/道具",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "ownerEntity",
        label: "道具持有者实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "ownerGuid",
        label: "道具持有者GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "itemConfigId",
        label: "道具配置ID",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "lostCount",
        label: "失去数量",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 25-造物巡逻 ─────────────────────────────
  // 事件节点/造物巡逻
  {
    id: "event.constructReachedPatrolWaypoint",
    displayName: "造物抵达巡逻路点时",
    category: "事件节点/造物巡逻",
    kind: "event",
    headerColor: EVENT_HEADER,
    ports: [
      { id: "flowOut", label: "事件", kind: "flow-out" },
      {
        id: "constructEntity",
        label: "造物实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "constructGuid",
        label: "造物GUID",
        kind: "data-out",
        valueType: "guid",
      },
      {
        id: "patrolTemplateIndex",
        label: "当前巡逻模板序号",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "pathIndex",
        label: "当前路径索引",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "currentWaypointIndex",
        label: "当前抵达路点序号",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "nextWaypointIndex",
        label: "即将前往路点序号",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 00-通用 ─────────────────────────────
  // 流程控制节点/通用
  {
    id: "flow.branch.multi",
    displayName: "多分支",
    category: "流程控制节点/通用",
    kind: "flow-control",
    headerColor: FLOW_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      {
        id: "controlExpr",
        label: "控制表达式",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "compareParam",
        label: "判断参数",
        kind: "data-in",
        valueType: "any",
      },
      { id: "default", label: "默认", kind: "flow-out" },
    ],
  },
  {
    id: "flow.branch.ifElse",
    displayName: "双分支",
    category: "流程控制节点/通用",
    kind: "flow-control",
    headerColor: FLOW_HEADER,
    ports: [
      { id: "flowIn", label: "执行", kind: "flow-in" },
      {
        id: "condition",
        label: "条件",
        kind: "data-in",
        valueType: "bool",
        defaultValue: false,
      },
      { id: "true", label: "是", kind: "flow-out" },
      { id: "false", label: "否", kind: "flow-out" },
    ],
  },
  // ───────────────────────────── 00-通用 ─────────────────────────────
  // 查询节点/通用
  {
    id: "query.matchModeAndPlayerCount",
    displayName: "查询对局游玩方式及人数",
    category: "查询节点/通用",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "playerCount",
        label: "游玩人数",
        kind: "data-out",
        valueType: "int",
      },
      { id: "mode", label: "游玩方式", kind: "data-out", valueType: "string" },
    ],
  },
  {
    id: "query.getLocalVariable",
    displayName: "获取局部变量",
    category: "查询节点/通用",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "initialValue",
        label: "初始值",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "localVariable",
        label: "局部变量",
        kind: "data-out",
        valueType: "string",
      },
      {
        id: "value",
        label: "值",
        kind: "data-out",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },

  // ───────────────────────────── 01-数学 ─────────────────────────────
  // 查询节点/数学
  {
    id: "query.vector3.up",
    displayName: "三维向量：上方",
    category: "查询节点/数学",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "vector",
        label: "(0,1,0)",
        kind: "data-out",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "query.vector3.down",
    displayName: "三维向量：下方",
    category: "查询节点/数学",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "vector",
        label: "(0,-1,0)",
        kind: "data-out",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "query.vector3.forward",
    displayName: "三维向量：前方",
    category: "查询节点/数学",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "vector",
        label: "(0,0,1)",
        kind: "data-out",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "query.vector3.back",
    displayName: "三维向量：后方",
    category: "查询节点/数学",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "vector",
        label: "(0,0,-1)",
        kind: "data-out",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "query.vector3.right",
    displayName: "三维向量：右侧",
    category: "查询节点/数学",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "vector",
        label: "(1,0,0)",
        kind: "data-out",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "query.vector3.left",
    displayName: "三维向量：左侧",
    category: "查询节点/数学",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "vector",
        label: "(-1,0,0)",
        kind: "data-out",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "query.vector3.zero",
    displayName: "三维向量：零向量",
    category: "查询节点/数学",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "vector",
        label: "(0,0,0)",
        kind: "data-out",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "query.pi",
    displayName: "圆周率",
    category: "查询节点/数学",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "pi", label: "圆周率（π）", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "query.weightedRandomIndex",
    displayName: "权重随机",
    category: "查询节点/数学",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "weights", label: "权重列表", kind: "data-in", valueType: "list" },
      { id: "index", label: "权重序号", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "query.utcTimestamp",
    displayName: "查询时间戳（UTC+0时区）",
    category: "查询节点/数学",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "timestamp", label: "时间戳", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "query.serverTimezone",
    displayName: "查询服务器时区",
    category: "查询节点/数学",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "timezone", label: "时区", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "query.randomInt",
    displayName: "获取随机整数",
    category: "查询节点/数学",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "lower",
        label: "下限",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "upper",
        label: "上限",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "query.randomFloat",
    displayName: "获取随机浮点数",
    category: "查询节点/数学",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "lower",
        label: "下限",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "upper",
        label: "上限",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "float" },
    ],
  },

  // ───────────────────────────── 02-列表相关 ─────────────────────────────
  // 查询节点/列表相关
  {
    id: "query.list.contains",
    displayName: "列表是否包含该值",
    category: "查询节点/列表相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "list",
        label: "列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
      {
        id: "value",
        label: "值",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      { id: "result", label: "是否包含", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "query.list.findIndicesByValue",
    displayName: "查找列表并返回值的序号",
    category: "查询节点/列表相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetList",
        label: "目标列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
      {
        id: "value",
        label: "值",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "indexList",
        label: "序号列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.list.getAt",
    displayName: "获取列表对应值",
    category: "查询节点/列表相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "list",
        label: "列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
      {
        id: "index",
        label: "序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "value",
        label: "值",
        kind: "data-out",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "query.list.max",
    displayName: "获取列表最大值",
    category: "查询节点/列表相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "list",
        label: "列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
      {
        id: "max",
        label: "最大值",
        kind: "data-out",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "query.list.min",
    displayName: "获取列表最小值",
    category: "查询节点/列表相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "list",
        label: "列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
      {
        id: "min",
        label: "最小值",
        kind: "data-out",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "query.list.length",
    displayName: "获取列表长度",
    category: "查询节点/列表相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "list",
        label: "列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
      { id: "length", label: "长度", kind: "data-out", valueType: "int" },
    ],
  },
  // ───────────────────────────── 03-自定义变量 ─────────────────────────────
  // 查询节点/自定义变量
  {
    id: "query.customVar.snapshot",
    displayName: "查询自定义变量快照",
    category: "查询节点/自定义变量",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "snapshot",
        label: "自定义变量组件快照",
        kind: "data-in",
        valueType: "any",
      },
      {
        id: "varName",
        label: "变量名",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "value",
        label: "变量值",
        kind: "data-out",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "query.customVar.get",
    displayName: "获取自定义变量",
    category: "查询节点/自定义变量",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "varName",
        label: "变量名",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "value",
        label: "变量值",
        kind: "data-out",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "query.graphVar.get",
    displayName: "获取节点图变量",
    category: "查询节点/自定义变量",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "varName",
        label: "变量名",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "value",
        label: "变量值",
        kind: "data-out",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },

  // ───────────────────────────── 04-预设状态 ─────────────────────────────
  // 查询节点/预设状态
  {
    id: "query.presetState.get",
    displayName: "获取预设状态",
    category: "查询节点/预设状态",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "presetIndex",
        label: "预设状态索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "presetValue",
        label: "预设状态值",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 05-实体相关 ─────────────────────────────
  // 查询节点/实体相关
  {
    id: "query.entity.byGuid",
    displayName: "以GUID查询实体",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "guid", label: "GUID", kind: "data-in", valueType: "guid" },
      { id: "entity", label: "实体", kind: "data-out", valueType: "entity" },
    ],
  },
  {
    id: "query.guid.byEntity",
    displayName: "以实体查询GUID",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "entity", label: "实体", kind: "data-in", valueType: "entity" },
      { id: "guid", label: "GUID", kind: "data-out", valueType: "guid" },
    ],
  },
  {
    id: "query.entity.isAlive",
    displayName: "查询实体是否在场",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "isAlive", label: "是否在场", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "query.character.moveSpeed",
    displayName: "查询角色当前移动速度",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "character",
        label: "角色实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "speed", label: "当前速度", kind: "data-out", valueType: "float" },
      {
        id: "speedVector",
        label: "速度向量",
        kind: "data-out",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "query.entities.getAll",
    displayName: "获取场上所有实体",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "entities",
        label: "实体列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.entities.byComponentOnField",
    displayName: "获取场上指定元件ID的实体",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "componentId",
        label: "元件ID",
        kind: "data-in",
        valueType: "componentId",
      },
      {
        id: "entities",
        label: "实体列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.entities.byTypeOnField",
    displayName: "获取场上指定类型实体",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "entityType",
        label: "实体类型",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "entities",
        label: "实体列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.entity.transform",
    displayName: "获取实体位置与旋转",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "position", label: "位置", kind: "data-out", valueType: "vector3" },
      { id: "rotation", label: "旋转", kind: "data-out", valueType: "vector3" },
    ],
  },
  {
    id: "query.entity.elementStats",
    displayName: "获取实体元素属性",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "pyroBonus",
        label: "火元素伤害加成",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "pyroRes",
        label: "火元素抗性",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "hydroBonus",
        label: "水元素伤害加成",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "hydroRes",
        label: "水元素抗性",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "dendroBonus",
        label: "草元素伤害加成",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "dendroRes",
        label: "草元素抗性",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "electroBonus",
        label: "雷元素伤害加成",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "electroRes",
        label: "雷元素抗性",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "anemoBonus",
        label: "风元素伤害加成",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "anemoRes",
        label: "风元素抗性",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "cryoBonus",
        label: "冰元素伤害加成",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "cryoRes",
        label: "冰元素抗性",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "geoBonus",
        label: "岩元素伤害加成",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "geoRes",
        label: "岩元素抗性",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "physicalBonus",
        label: "物理伤害加成",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "physicalRes",
        label: "物理抗性",
        kind: "data-out",
        valueType: "float",
      },
    ],
  },
  {
    id: "query.entity.upVector",
    displayName: "获取实体向上向量",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "up", label: "向上向量", kind: "data-out", valueType: "vector3" },
    ],
  },
  {
    id: "query.entity.forwardVector",
    displayName: "获取实体向前向量",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "forward",
        label: "向前向量",
        kind: "data-out",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "query.entity.rightVector",
    displayName: "获取实体向右向量",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "right",
        label: "向右向量",
        kind: "data-out",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "query.entity.ownedEntities",
    displayName: "获取实体拥有的实体列表",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "entities",
        label: "实体列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.entity.type",
    displayName: "获取实体类型",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "entityType",
        label: "实体类型",
        kind: "data-out",
        valueType: "string",
      },
    ],
  },
  {
    id: "query.entity.advancedStats",
    displayName: "获取实体进阶属性",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "critRate", label: "暴击率", kind: "data-out", valueType: "float" },
      {
        id: "critDmg",
        label: "暴击伤害",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "healBonus",
        label: "治疗加成",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "healedBonus",
        label: "受治疗加成",
        kind: "data-out",
        valueType: "float",
      },
      { id: "er", label: "元素充能效率", kind: "data-out", valueType: "float" },
      { id: "cdr", label: "冷却缩减", kind: "data-out", valueType: "float" },
      {
        id: "shieldStr",
        label: "护盾强效",
        kind: "data-out",
        valueType: "float",
      },
    ],
  },
  {
    id: "query.entity.owner",
    displayName: "获取拥有者实体",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "ownerEntity",
        label: "拥有者实体",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },
  {
    id: "query.entities.filterByComponentId",
    displayName: "获取指定元件ID的实体列表",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "sourceList",
        label: "目标实体列表",
        kind: "data-in",
        valueType: "list",
      },
      {
        id: "componentId",
        label: "元件ID",
        kind: "data-in",
        valueType: "componentId",
      },
      {
        id: "resultList",
        label: "结果列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.entities.filterByType",
    displayName: "获取指定类型的实体列表",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "sourceList",
        label: "目标实体列表",
        kind: "data-in",
        valueType: "list",
      },
      {
        id: "entityType",
        label: "实体类型",
        kind: "data-in",
        valueType: "enum",
      },
      {
        id: "resultList",
        label: "结果列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.entities.filterByRange",
    displayName: "获取指定范围的实体列表",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "sourceList",
        label: "目标实体列表",
        kind: "data-in",
        valueType: "list",
      },
      { id: "center", label: "中心点", kind: "data-in", valueType: "vector3" },
      {
        id: "radius",
        label: "半径",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "resultList",
        label: "结果列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.entities.filterByCamp",
    displayName: "获取指定阵营的实体列表",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "sourceList",
        label: "目标实体列表",
        kind: "data-in",
        valueType: "list",
      },
      { id: "camp", label: "阵营", kind: "data-in", valueType: "camp" },
      {
        id: "resultList",
        label: "结果列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.object.stats",
    displayName: "获取物件属性",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "objectEntity",
        label: "物件实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "level", label: "等级", kind: "data-out", valueType: "int" },
      {
        id: "hpCur",
        label: "当前生命值",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "hpMax",
        label: "上限生命值",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "atkCur",
        label: "当前攻击力",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "atkBase",
        label: "基础攻击力",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "defCur",
        label: "当前防御力",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "defBase",
        label: "基础防御力",
        kind: "data-out",
        valueType: "float",
      },
    ],
  },
  {
    id: "query.entity.self",
    displayName: "获取自身实体",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "self", label: "自身实体", kind: "data-out", valueType: "entity" },
    ],
  },
  {
    id: "query.character.stats",
    displayName: "获取角色属性",
    category: "查询节点/实体相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "level", label: "等级", kind: "data-out", valueType: "int" },
      {
        id: "hpCur",
        label: "当前生命值",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "hpMax",
        label: "上限生命值",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "atkCur",
        label: "当前攻击力",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "atkBase",
        label: "基础攻击力",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "defCur",
        label: "当前防御力",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "defBase",
        label: "基础防御力",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "poiseMax",
        label: "受打断值上限",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "poiseCur",
        label: "当前受打断值",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "poiseState",
        label: "当前受打断状态",
        kind: "data-out",
        valueType: "bool",
      },
    ],
  },
  // ───────────────────────────── 06-关卡相关 ─────────────────────────────
  // 查询节点/关卡相关
  {
    id: "query.level.environmentTime",
    displayName: "查询当前环境时间",
    category: "查询节点/关卡相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "envTime",
        label: "当前环境时间",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "dayCount",
        label: "当前循环天数",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "query.level.gameElapsed",
    displayName: "获取游戏已进行时间",
    category: "查询节点/关卡相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "elapsed",
        label: "游戏已进行时间",
        kind: "data-out",
        valueType: "float",
      },
    ],
  },

  // ───────────────────────────── 07-阵营相关 ─────────────────────────────
  // 查询节点/阵营相关
  {
    id: "query.camp.ofEntity",
    displayName: "查询实体阵营",
    category: "查询节点/阵营相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "camp", label: "阵营", kind: "data-out", valueType: "camp" },
    ],
  },
  {
    id: "query.camp.isHostile",
    displayName: "获取阵营是否敌对",
    category: "查询节点/阵营相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "campA", label: "阵营1", kind: "data-in", valueType: "camp" },
      { id: "campB", label: "阵营2", kind: "data-in", valueType: "camp" },
      { id: "hostile", label: "是否敌对", kind: "data-out", valueType: "bool" },
    ],
  },

  // ───────────────────────────── 08-玩家与角色相关 ─────────────────────────────
  // 查询节点/玩家与角色相关
  {
    id: "query.player.allCharactersDown",
    displayName: "查询玩家角色是否全部倒下",
    category: "查询节点/玩家与角色相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "player", label: "玩家实体", kind: "data-in", valueType: "entity" },
      { id: "result", label: "结果", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "query.playerIndex.byGuid",
    displayName: "根据玩家GUID获取玩家序号",
    category: "查询节点/玩家与角色相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "playerGuid",
        label: "玩家GUID",
        kind: "data-in",
        valueType: "guid",
      },
      {
        id: "playerIndex",
        label: "玩家序号",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "query.playerGuid.byIndex",
    displayName: "根据玩家序号获取玩家GUID",
    category: "查询节点/玩家与角色相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "playerIndex",
        label: "玩家序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "playerGuid",
        label: "玩家GUID",
        kind: "data-out",
        valueType: "guid",
      },
    ],
  },
  {
    id: "query.players.inField",
    displayName: "获取在场玩家实体列表",
    category: "查询节点/玩家与角色相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "players",
        label: "玩家实体列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.player.allCharacterEntities",
    displayName: "获取指定玩家所有角色实体",
    category: "查询节点/玩家与角色相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "player", label: "玩家实体", kind: "data-in", valueType: "entity" },
      {
        id: "characters",
        label: "角色实体列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.player.reviveRemaining",
    displayName: "获取玩家剩余复苏次数",
    category: "查询节点/玩家与角色相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "player", label: "玩家实体", kind: "data-in", valueType: "entity" },
      { id: "count", label: "剩余次数", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "query.player.reviveDuration",
    displayName: "获取玩家复苏耗时",
    category: "查询节点/玩家与角色相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "player", label: "玩家实体", kind: "data-in", valueType: "entity" },
      { id: "duration", label: "时长", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "query.player.inputDeviceType",
    displayName: "获得玩家客户端输入设备类型",
    category: "查询节点/玩家与角色相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "player", label: "玩家实体", kind: "data-in", valueType: "entity" },
      {
        id: "inputType",
        label: "输入设备类型",
        kind: "data-out",
        valueType: "enum",
      },
    ],
  },
  {
    id: "query.player.nickname",
    displayName: "获取玩家昵称",
    category: "查询节点/玩家与角色相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "player", label: "玩家实体", kind: "data-in", valueType: "entity" },
      {
        id: "nickname",
        label: "玩家昵称",
        kind: "data-out",
        valueType: "string",
      },
    ],
  },
  {
    id: "query.player.ofCharacter",
    displayName: "获取角色归属的玩家实体",
    category: "查询节点/玩家与角色相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "character",
        label: "角色实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "owner",
        label: "所属玩家实体",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },

  // ───────────────────────────── 09-跟随运动器 ─────────────────────────────
  // 查询节点/跟随运动器
  {
    id: "query.follower.target",
    displayName: "获取跟随运动器的目标",
    category: "查询节点/跟随运动器",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "follower",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "targetEntity",
        label: "跟随目标实体",
        kind: "data-out",
        valueType: "entity",
      },
      {
        id: "targetGuid",
        label: "跟随目标GUID",
        kind: "data-out",
        valueType: "guid",
      },
    ],
  },

  // ───────────────────────────── 10-全局计时器 ─────────────────────────────
  // 查询节点/全局计时器
  {
    id: "query.timer.globalCurrent",
    displayName: "获取全局计时器当前时间",
    category: "查询节点/全局计时器",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "timerName",
        label: "计时器名称",
        kind: "data-in",
        valueType: "string",
        ui: { placeholder: "输入字符串" },
      },
      {
        id: "currentTime",
        label: "当前时间",
        kind: "data-out",
        valueType: "float",
      },
    ],
  },

  // ───────────────────────────── 11-界面控件组 ─────────────────────────────
  // 查询节点/界面控件组
  {
    id: "query.ui.currentLayout",
    displayName: "获取玩家当前界面布局",
    category: "查询节点/界面控件组",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "player", label: "玩家实体", kind: "data-in", valueType: "entity" },
      {
        id: "layoutIdx",
        label: "布局索引",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 12-造物 ─────────────────────────────
  // 查询节点/造物
  {
    id: "query.creation.stats",
    displayName: "获取造物属性",
    category: "查询节点/造物",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "creation",
        label: "造物实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "level", label: "等级", kind: "data-out", valueType: "int" },
      {
        id: "hpCur",
        label: "当前生命值",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "hpMax",
        label: "上限生命值",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "atkCur",
        label: "当前攻击力",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "atkBase",
        label: "基础攻击力",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "poiseMax",
        label: "受打断值上限",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "poiseCur",
        label: "当前受打断值",
        kind: "data-out",
        valueType: "float",
      },
      {
        id: "poiseState",
        label: "当前受打断状态",
        kind: "data-out",
        valueType: "bool",
      },
    ],
  },
  {
    id: "query.creation.currentTarget",
    displayName: "获取造物当前目标",
    category: "查询节点/造物",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "creation",
        label: "造物实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "target",
        label: "目标实体",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },
  {
    id: "query.creation.defaultAggroList",
    displayName: "获取默认模式的造物仇恨列表",
    category: "查询节点/造物",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "creation",
        label: "造物实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "aggro", label: "仇恨列表", kind: "data-out", valueType: "list" },
    ],
  },

  // ───────────────────────────── 13-职业 ─────────────────────────────
  // 查询节点/职业
  {
    id: "query.career.ofPlayer",
    displayName: "查询玩家职业",
    category: "查询节点/职业",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "player", label: "玩家实体", kind: "data-in", valueType: "entity" },
      {
        id: "careerId",
        label: "职业配置ID",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "query.career.level",
    displayName: "查询玩家职业的等级",
    category: "查询节点/职业",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "player", label: "玩家实体", kind: "data-in", valueType: "entity" },
      {
        id: "careerId",
        label: "职业配置ID",
        kind: "data-in",
        valueType: "int",
      },
      { id: "level", label: "等级", kind: "data-out", valueType: "int" },
    ],
  },

  // ───────────────────────────── 14-技能 ─────────────────────────────
  // 查询节点/技能
  {
    id: "query.character.skill",
    displayName: "查询角色技能",
    category: "查询节点/技能",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "character",
        label: "角色实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "slot", label: "角色技能槽位", kind: "data-in", valueType: "enum" },
      {
        id: "skillConfig",
        label: "技能配置ID",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  // ───────────────────────────── 15-单位状态 ─────────────────────────────
  // 查询节点/单位状态
  {
    id: "query.unitState.slotIndexList",
    displayName: "查询单位状态的槽位序号列表",
    category: "查询节点/单位状态",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "查询目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "configId",
        label: "单位状态配置ID",
        kind: "data-in",
        valueType: "int",
      },
      {
        id: "slotIndexList",
        label: "槽位序号列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.unitState.hasState",
    displayName: "查询实体是否具有单位状态",
    category: "查询节点/单位状态",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "configId",
        label: "单位状态配置ID",
        kind: "data-in",
        valueType: "int",
      },
      { id: "exists", label: "是否具有", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "query.unitState.layerCountBySlot",
    displayName: "根据槽位序号查询单位状态层数",
    category: "查询节点/单位状态",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "查询目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "configId",
        label: "单位状态配置ID",
        kind: "data-in",
        valueType: "int",
      },
      {
        id: "slotIndex",
        label: "槽位序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      { id: "layers", label: "层数", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "query.unitState.applierBySlot",
    displayName: "根据槽位序号查询单位状态施加者",
    category: "查询节点/单位状态",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "查询目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "configId",
        label: "单位状态配置ID",
        kind: "data-in",
        valueType: "int",
      },
      {
        id: "slotIndex",
        label: "槽位序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "applier",
        label: "施加者实体",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },

  // ───────────────────────────── 16-标签 ─────────────────────────────
  // 查询节点/标签
  {
    id: "query.tags.entitiesByUnitTagIndex",
    displayName: "获取单位标签的实体列表",
    category: "查询节点/标签",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "unitTagIndex",
        label: "单位标签索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "entities",
        label: "实体列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.tags.ofEntity",
    displayName: "获取实体单位标签列表",
    category: "查询节点/标签",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "unitTags",
        label: "单位标签列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },

  // ───────────────────────────── 17-自定义仇恨 ─────────────────────────────
  // 查询节点/自定义仇恨
  {
    id: "query.hatred.globalTransferMultiplier",
    displayName: "查询全局仇恨转移倍率",
    category: "查询节点/自定义仇恨",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "multiplier",
        label: "全局仇恨转移倍率",
        kind: "data-out",
        valueType: "float",
      },
    ],
  },
  {
    id: "query.hatred.isInCombat",
    displayName: "查询指定实体是否已入战",
    category: "查询节点/自定义仇恨",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "查询目标",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "inCombat",
        label: "是否入战",
        kind: "data-out",
        valueType: "bool",
      },
    ],
  },
  {
    id: "query.hatred.multiplierOfEntity",
    displayName: "查询指定实体的仇恨倍率",
    category: "查询节点/自定义仇恨",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "查询目标",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "multiplier",
        label: "仇恨倍率",
        kind: "data-out",
        valueType: "float",
      },
    ],
  },
  {
    id: "query.hatred.valueOfEntity",
    displayName: "查询指定实体的仇恨值",
    category: "查询节点/自定义仇恨",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "查询目标",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "ownerEntity",
        label: "仇恨拥有者",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "hatred", label: "仇恨值", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "query.hatred.ownersByTarget",
    displayName: "获取以目标为仇恨目标的拥有者列表",
    category: "查询节点/自定义仇恨",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "owners",
        label: "仇恨拥有者列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.hatred.listOfEntity",
    displayName: "获取指定实体的仇恨列表",
    category: "查询节点/自定义仇恨",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "hatredList",
        label: "仇恨列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.hatred.targetOfOwner",
    displayName: "获取指定实体的仇恨目标",
    category: "查询节点/自定义仇恨",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "ownerEntity",
        label: "仇恨拥有者",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "hatredTarget",
        label: "仇恨目标",
        kind: "data-out",
        valueType: "entity",
      },
    ],
  },
  {
    id: "query.hatred.ownersByListContainingTarget",
    displayName: "获取目标所在仇恨列表的拥有者列表",
    category: "查询节点/自定义仇恨",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "查询目标",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "owners",
        label: "仇恨拥有者列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },

  // ───────────────────────────── 18-路径 ─────────────────────────────
  // 查询节点/路径
  {
    id: "query.path.pointInfo",
    displayName: "获取指定路径点信息",
    category: "查询节点/路径",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "pathIndex",
        label: "路径索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "pointIndex",
        label: "路径路点序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "position",
        label: "路点位置",
        kind: "data-out",
        valueType: "vector3",
      },
      {
        id: "rotation",
        label: "路点朝向",
        kind: "data-out",
        valueType: "vector3",
      },
    ],
  },

  // ───────────────────────────── 19-预设点 ─────────────────────────────
  // 查询节点/预设点
  {
    id: "query.preset.indicesByUnitTag",
    displayName: "以单位标签获取预设点位列表",
    category: "查询节点/预设点",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "unitTagIndex",
        label: "单位标签索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "indexList",
        label: "点位索引列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.preset.transformByIndex",
    displayName: "查询预设点位置旋转",
    category: "查询节点/预设点",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "pointIndex",
        label: "点位索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      { id: "position", label: "位置", kind: "data-out", valueType: "vector3" },
      { id: "rotation", label: "旋转", kind: "data-out", valueType: "vector3" },
    ],
  },

  // ───────────────────────────── 20-关卡结算 ─────────────────────────────
  // 查询节点/关卡结算
  {
    id: "query.settlement.playerSuccess",
    displayName: "获取玩家结算成功状态",
    category: "查询节点/关卡结算",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "success", label: "结算状态", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "query.settlement.playerRankValue",
    displayName: "获取玩家结算排名数值",
    category: "查询节点/关卡结算",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "playerEntity",
        label: "玩家实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "rankValue",
        label: "排名数值",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "query.settlement.campSuccess",
    displayName: "获取阵营结算成功状态",
    category: "查询节点/关卡结算",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "camp", label: "阵营", kind: "data-in", valueType: "camp" },
      { id: "success", label: "结算状态", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "query.settlement.campRankValue",
    displayName: "获取阵营结算排名数值",
    category: "查询节点/关卡结算",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "camp", label: "阵营", kind: "data-in", valueType: "camp" },
      {
        id: "rankValue",
        label: "排名数值",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 21-字典 ─────────────────────────────
  // 查询节点/字典
  {
    id: "query.dict.getByKey",
    displayName: "以键查询字典值",
    category: "查询节点/字典",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "dict", label: "字典", kind: "data-in", valueType: "any" },
      {
        id: "key",
        label: "键",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "value",
        label: "值",
        kind: "data-out",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "query.dict.containsValue",
    displayName: "查询字典是否包含特定值",
    category: "查询节点/字典",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "dict", label: "字典", kind: "data-in", valueType: "any" },
      {
        id: "value",
        label: "值",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "contains",
        label: "是否包含",
        kind: "data-out",
        valueType: "bool",
      },
    ],
  },
  {
    id: "query.dict.containsKey",
    displayName: "查询字典是否包含特定键",
    category: "查询节点/字典",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "dict", label: "字典", kind: "data-in", valueType: "any" },
      {
        id: "key",
        label: "键",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "contains",
        label: "是否包含",
        kind: "data-out",
        valueType: "bool",
      },
    ],
  },
  {
    id: "query.dict.length",
    displayName: "查询字典长度",
    category: "查询节点/字典",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "dict", label: "字典", kind: "data-in", valueType: "any" },
      { id: "length", label: "长度", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "query.dict.values",
    displayName: "获取字典中值组成的列表",
    category: "查询节点/字典",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "dict", label: "字典", kind: "data-in", valueType: "any" },
      {
        id: "values",
        label: "值列表",
        kind: "data-out",
        valueType: "list",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "query.dict.keys",
    displayName: "获取字典中键组成的列表",
    category: "查询节点/字典",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "dict", label: "字典", kind: "data-in", valueType: "any" },
      {
        id: "keys",
        label: "键列表",
        kind: "data-out",
        valueType: "list",
        ui: { accessory: "gear" },
      },
    ],
  },
  // ───────────────────────────── 22-商店 ─────────────────────────────
  // 查询节点/商店
  {
    id: "query.shop.purchaseInfo",
    displayName: "查询商店商品收购信息",
    category: "查询节点/商店",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "shopOwner",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "itemConfigId",
        label: "道具配置ID",
        kind: "data-in",
        valueType: "int",
      },
      {
        id: "currencyDict",
        label: "收购货币字典",
        kind: "data-out",
        valueType: "any",
      },
      {
        id: "canPurchase",
        label: "是否可收购",
        kind: "data-out",
        valueType: "bool",
      },
    ],
  },
  {
    id: "query.shop.purchaseList",
    displayName: "查询商店收购物品列表",
    category: "查询节点/商店",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "shopOwner",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "itemIds",
        label: "道具配置ID列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.shop.backpackSellInfo",
    displayName: "查询背包商店商品出售信息",
    category: "查询节点/商店",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "shopOwner",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "itemConfigId",
        label: "道具配置ID",
        kind: "data-in",
        valueType: "int",
      },
      {
        id: "sellCurrency",
        label: "出售货币字典",
        kind: "data-out",
        valueType: "any",
      },
      {
        id: "priority",
        label: "排序优先级",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "canSell",
        label: "是否可出售",
        kind: "data-out",
        valueType: "bool",
      },
    ],
  },
  {
    id: "query.shop.backpackSellList",
    displayName: "查询背包商店物品出售列表",
    category: "查询节点/商店",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "shopOwner",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "itemIds",
        label: "道具配置ID列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.shop.customSellInfo",
    displayName: "查询自定义商店商品出售信息",
    category: "查询节点/商店",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "shopOwner",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "goodsIndex",
        label: "商品序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "itemConfig",
        label: "道具配置ID",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "sellCurrency",
        label: "出售货币字典",
        kind: "data-out",
        valueType: "any",
      },
      {
        id: "tabIndex",
        label: "所属页签序号",
        kind: "data-out",
        valueType: "int",
      },
      { id: "limited", label: "是否限购", kind: "data-out", valueType: "bool" },
      {
        id: "limitCount",
        label: "限购数量",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "priority",
        label: "排序优先级",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "canSell",
        label: "是否可出售",
        kind: "data-out",
        valueType: "bool",
      },
    ],
  },
  {
    id: "query.shop.customSellList",
    displayName: "查询自定义商店商品出售列表",
    category: "查询节点/商店",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "shopOwner",
        label: "商店归属者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "shopIndex",
        label: "商店序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "goodsIndexList",
        label: "商品序号列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },

  // ───────────────────────────── 23-装备 ─────────────────────────────
  // 查询节点/装备
  {
    id: "query.equip.tagList",
    displayName: "查询装备标签列表",
    category: "查询节点/装备",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "equipIndex",
        label: "装备索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      { id: "tags", label: "标签列表", kind: "data-out", valueType: "list" },
    ],
  },
  {
    id: "query.equip.configIdByIndex",
    displayName: "根据装备索引查询装备配置ID",
    category: "查询节点/装备",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "equipIndex",
        label: "装备索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "equipConfigId",
        label: "装备配置ID",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "query.equip.entryList",
    displayName: "获取装备词条列表",
    category: "查询节点/装备",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "equipIndex",
        label: "装备索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "entryList",
        label: "装备词条列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.equip.entryValue",
    displayName: "获取装备词条数值",
    category: "查询节点/装备",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "equipIndex",
        label: "装备索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "entryIndex",
        label: "词条序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "entryValue",
        label: "装备数值",
        kind: "data-out",
        valueType: "float",
      },
    ],
  },
  {
    id: "query.equip.entryConfigId",
    displayName: "获取装备词条配置ID",
    category: "查询节点/装备",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "equipIndex",
        label: "装备索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "entryIndex",
        label: "词条序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "entryConfigId",
        label: "词条配置ID",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 24-道具 ─────────────────────────────
  // 查询节点/道具
  {
    id: "query.drop.coinCount",
    displayName: "获取凋落物组件货币数量",
    category: "查询节点/道具",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "dropEntity",
        label: "掉落物实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "currencyId",
        label: "货币配置ID",
        kind: "data-in",
        valueType: "int",
      },
      {
        id: "coinCount",
        label: "货币数量",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "query.reward.allCoins",
    displayName: "获取战利品所有货币",
    category: "查询节点/道具",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "looter",
        label: "掉落者实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "coins", label: "货币字典", kind: "data-out", valueType: "any" },
    ],
  },
  {
    id: "query.reward.allItems",
    displayName: "获取战利品所有道具",
    category: "查询节点/道具",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "looter",
        label: "掉落者实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "items", label: "道具字典", kind: "data-out", valueType: "any" },
    ],
  },
  {
    id: "query.drop.allEquip",
    displayName: "获取掉落物件所有装备",
    category: "查询节点/道具",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "dropEntity",
        label: "掉落物实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "equipIndexList",
        label: "装备索引列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.drop.itemCount",
    displayName: "获取掉落物组件道具数量",
    category: "查询节点/道具",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "dropEntity",
        label: "掉落物实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "itemConfigId",
        label: "道具配置ID",
        kind: "data-in",
        valueType: "int",
      },
      {
        id: "itemCount",
        label: "道具数量",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "query.backpack.capacity",
    displayName: "获取背包容量",
    category: "查询节点/道具",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "owner",
        label: "背包持有者实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "capacity", label: "背包容量", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "query.backpack.basicItems",
    displayName: "获取背包所有基础道具",
    category: "查询节点/道具",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "owner",
        label: "背包持有者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "basicDict",
        label: "基础道具字典",
        kind: "data-out",
        valueType: "any",
      },
    ],
  },
  {
    id: "query.backpack.allEquip",
    displayName: "获取背包所有装备",
    category: "查询节点/道具",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "owner",
        label: "背包持有者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "equipIndexList",
        label: "装备索引列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.backpack.allCoins",
    displayName: "获取背包所有货币",
    category: "查询节点/道具",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "owner",
        label: "背包持有者实体",
        kind: "data-in",
        valueType: "entity",
      },
      { id: "coins", label: "货币字典", kind: "data-out", valueType: "any" },
    ],
  },
  {
    id: "query.backpack.coinCount",
    displayName: "获取背包货币数量",
    category: "查询节点/道具",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "owner",
        label: "背包持有者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "currencyId",
        label: "货币配置ID",
        kind: "data-in",
        valueType: "int",
      },
      {
        id: "resourceNum",
        label: "资源数量",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "query.backpack.itemCount",
    displayName: "获取背包道具数量",
    category: "查询节点/道具",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "owner",
        label: "背包持有者实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "itemConfigId",
        label: "道具配置ID",
        kind: "data-in",
        valueType: "int",
      },
      {
        id: "itemCount",
        label: "道具数量",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 25-碰撞触发器 ─────────────────────────────
  // 查询节点/碰撞触发器
  {
    id: "query.collisionTrigger.entitiesIn",
    displayName: "获取碰撞触发器内所有实体",
    category: "查询节点/碰撞触发器",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "triggerIndex",
        label: "触发器序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "entities",
        label: "实体列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },

  // ───────────────────────────── 26-小地图标识组件 ─────────────────────────────
  // 查询节点/小地图标识组件
  {
    id: "query.minimap.markerInfo",
    displayName: "查询指定小地图标识信息",
    category: "查询节点/小地图标识组件",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "markerIndex",
        label: "小地图标识序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      { id: "enabled", label: "生效状态", kind: "data-out", valueType: "bool" },
      {
        id: "visiblePlayers",
        label: "可见标识的玩家列表",
        kind: "data-out",
        valueType: "list",
      },
      {
        id: "trackingPlayers",
        label: "追踪标识的玩家列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  {
    id: "query.minimap.markerStates",
    displayName: "获取实体的小地图标识状态",
    category: "查询节点/小地图标识组件",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "allMarkers",
        label: "全量小地图标识序号列表",
        kind: "data-out",
        valueType: "list",
      },
      {
        id: "enabledMarkers",
        label: "生效的小地图标识序号列表",
        kind: "data-out",
        valueType: "list",
      },
      {
        id: "disabledMarkers",
        label: "未生效的小地图标识序号列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },
  // ───────────────────────────── 27-造物巡逻 ─────────────────────────────
  // 查询节点/造物巡逻
  {
    id: "query.creation.patrolTemplate",
    displayName: "获取当前造物的巡逻模板",
    category: "查询节点/造物巡逻",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "creation",
        label: "造物实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "templateIdx",
        label: "巡逻模板序号",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "pathIndex",
        label: "路径索引",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "targetPoint",
        label: "目标路点序号",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 28-成就 ─────────────────────────────
  // 查询节点/成就
  {
    id: "query.achievement.isCompleted",
    displayName: "查询成就是否完成",
    category: "查询节点/成就",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "achievementIndex",
        label: "成就序号",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "completed",
        label: "是否完成",
        kind: "data-out",
        valueType: "bool",
      },
    ],
  },

  // ───────────────────────────── 29-扫描标签 ─────────────────────────────
  // 查询节点/扫描标签
  {
    id: "query.scanTag.activeConfigId",
    displayName: "获取当前生效的扫描标签配置ID",
    category: "查询节点/扫描标签",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "targetEntity",
        label: "目标实体",
        kind: "data-in",
        valueType: "entity",
      },
      {
        id: "configId",
        label: "扫描标签配置ID",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },

  // ───────────────────────────── 30-段位 ─────────────────────────────
  // 查询节点/段位
  {
    id: "query.rank.info",
    displayName: "获取玩家段位信息",
    category: "查询节点/段位",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "player", label: "玩家实体", kind: "data-in", valueType: "entity" },
      {
        id: "total",
        label: "玩家段位总分",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "winStreak",
        label: "玩家连胜次数",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "loseStreak",
        label: "玩家连败次数",
        kind: "data-out",
        valueType: "int",
      },
      {
        id: "runStreak",
        label: "玩家连续逃跑次数",
        kind: "data-out",
        valueType: "int",
      },
    ],
  },
  {
    id: "query.rank.deltaScore",
    displayName: "获取玩家段位变化分数",
    category: "查询节点/段位",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "player", label: "玩家实体", kind: "data-in", valueType: "entity" },
      { id: "result", label: "结算状态", kind: "data-in", valueType: "enum" },
      { id: "score", label: "分数", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "query.rank.escapeLegal",
    displayName: "获取玩家逃跑合法性",
    category: "查询节点/段位",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "player", label: "玩家实体", kind: "data-in", valueType: "entity" },
      { id: "legal", label: "是否合法", kind: "data-out", valueType: "bool" },
    ],
  },

  // ───────────────────────────── 31-实体布设组 ─────────────────────────────
  // 查询节点/实体布设组
  {
    id: "query.entityLayoutGroups.active",
    displayName: "查询当前激活的实体布设组列表",
    category: "查询节点/实体布设组",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      {
        id: "groupIndexList",
        label: "实体布设组索引列表",
        kind: "data-out",
        valueType: "list",
      },
    ],
  },

  // ───────────────────────────── 32-奇域礼盒相关 ─────────────────────────────
  // 查询节点/奇域礼盒相关
  {
    id: "query.giftBox.count",
    displayName: "查询对应礼盒数量",
    category: "查询节点/奇域礼盒相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "player", label: "玩家实体", kind: "data-in", valueType: "entity" },
      {
        id: "boxIndex",
        label: "礼盒索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      { id: "count", label: "数量", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "query.giftBox.consumeCount",
    displayName: "查询对应礼盒消耗数量",
    category: "查询节点/奇域礼盒相关",
    kind: "query",
    headerColor: QUERY_HEADER,
    ports: [
      { id: "player", label: "玩家实体", kind: "data-in", valueType: "entity" },
      {
        id: "boxIndex",
        label: "礼盒索引",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      { id: "count", label: "数量", kind: "data-out", valueType: "int" },
    ],
  },
  // ───────────────────────────── 00-通用 ─────────────────────────────
  // 运算节点/通用
  {
    id: "math.enumEquals",
    displayName: "枚举是否相等",
    category: "运算节点/通用",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "enum1",
        label: "枚举1",
        kind: "data-in",
        valueType: "enum",
        ui: { accessory: "gear" },
      },
      {
        id: "enum2",
        label: "枚举2",
        kind: "data-in",
        valueType: "enum",
        ui: { accessory: "gear" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "math.list.assemble",
    displayName: "拼装列表",
    category: "运算节点/通用",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "item0",
        label: "0",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      { id: "list", label: "列表", kind: "data-out", valueType: "list" },
    ],
  },
  {
    id: "math.equals",
    displayName: "是否相等",
    category: "运算节点/通用",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "input1",
        label: "输入1",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "input2",
        label: "输入2",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "math.typeCast",
    displayName: "数据类型转换",
    category: "运算节点/通用",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "input",
        label: "输入",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      { id: "output", label: "输出", kind: "data-out", valueType: "any" },
    ],
  },
  // ───────────────────────────── 01-数学 ─────────────────────────────
  // 运算节点/数学
  {
    id: "math.vector3.dot",
    displayName: "三维向量内积",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "a", label: "三维向量1", kind: "data-in", valueType: "vector3" },
      { id: "b", label: "三维向量2", kind: "data-in", valueType: "vector3" },
      { id: "result", label: "结果", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.vector3.sub",
    displayName: "三维向量减法",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "a", label: "三维向量1", kind: "data-in", valueType: "vector3" },
      { id: "b", label: "三维向量2", kind: "data-in", valueType: "vector3" },
      { id: "result", label: "结果", kind: "data-out", valueType: "vector3" },
    ],
  },
  {
    id: "math.vector3.add",
    displayName: "三维向量加法",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "a", label: "三维向量1", kind: "data-in", valueType: "vector3" },
      { id: "b", label: "三维向量2", kind: "data-in", valueType: "vector3" },
      { id: "result", label: "结果", kind: "data-out", valueType: "vector3" },
    ],
  },
  {
    id: "math.vector3.cross",
    displayName: "三维向量外积",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "a", label: "三维向量1", kind: "data-in", valueType: "vector3" },
      { id: "b", label: "三维向量2", kind: "data-in", valueType: "vector3" },
      { id: "result", label: "结果", kind: "data-out", valueType: "vector3" },
    ],
  },
  {
    id: "math.vector3.angle",
    displayName: "三维向量夹角",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "a", label: "三维向量1", kind: "data-in", valueType: "vector3" },
      { id: "b", label: "三维向量2", kind: "data-in", valueType: "vector3" },
      {
        id: "radians",
        label: "夹角(弧度)",
        kind: "data-out",
        valueType: "float",
      },
    ],
  },
  {
    id: "math.vector3.normalize",
    displayName: "三维向量归一化",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "v", label: "三维向量", kind: "data-in", valueType: "vector3" },
      { id: "result", label: "结果", kind: "data-out", valueType: "vector3" },
    ],
  },
  {
    id: "math.vector3.rotate",
    displayName: "三维向量旋转",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "rotation", label: "旋转", kind: "data-in", valueType: "vector3" },
      {
        id: "vector",
        label: "被旋转的三维向量",
        kind: "data-in",
        valueType: "vector3",
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "vector3" },
    ],
  },
  {
    id: "math.vector3.magnitude",
    displayName: "三维向量模运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "v", label: "三维向量", kind: "data-in", valueType: "vector3" },
      { id: "result", label: "结果", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.vector3.scale",
    displayName: "三维向量缩放",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "v", label: "三维向量", kind: "data-in", valueType: "vector3" },
      {
        id: "scale",
        label: "缩放倍率",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "vector3" },
    ],
  },
  {
    id: "math.vector3.distance",
    displayName: "两坐标点距离",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "p1", label: "坐标点1", kind: "data-in", valueType: "vector3" },
      { id: "p2", label: "坐标点2", kind: "data-in", valueType: "vector3" },
      { id: "distance", label: "距离", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.mul",
    displayName: "乘法运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "a",
        label: "输入1",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "b",
        label: "输入2",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "result",
        label: "结果",
        kind: "data-out",
        valueType: "float",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "math.cos",
    displayName: "余弦函数",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "radians",
        label: "弧度",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.sub",
    displayName: "减法运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "a",
        label: "输入1",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "b",
        label: "输入2",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "result",
        label: "结果",
        kind: "data-out",
        valueType: "float",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "math.div",
    displayName: "除法运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "a",
        label: "输入1",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "b",
        label: "输入2",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "result",
        label: "结果",
        kind: "data-out",
        valueType: "float",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "math.vector3.create",
    displayName: "创建三维向量",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "x",
        label: "X分量",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "y",
        label: "Y分量",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "z",
        label: "Z分量",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      {
        id: "vector",
        label: "三维向量",
        kind: "data-out",
        valueType: "vector3",
      },
    ],
  },
  {
    id: "math.add",
    displayName: "加法运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "a",
        label: "输入1",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "b",
        label: "输入2",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "result",
        label: "结果",
        kind: "data-out",
        valueType: "float",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "math.acos",
    displayName: "反余弦函数",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "input",
        label: "输入",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "radians", label: "弧度", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.atan",
    displayName: "反正切函数",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "input",
        label: "输入",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "radians", label: "弧度", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.asin",
    displayName: "反正弦函数",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "input",
        label: "输入",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "radians", label: "弧度", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.truncate",
    displayName: "取整数运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "input",
        label: "输入",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "mode", label: "取整方式", kind: "data-in", valueType: "enum" },
      { id: "result", label: "结果", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "math.sign",
    displayName: "取符号运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "input",
        label: "输入",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "result",
        label: "结果",
        kind: "data-out",
        valueType: "int",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "math.max",
    displayName: "取较大值",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "a",
        label: "输入1",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "b",
        label: "输入2",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "max",
        label: "较大值",
        kind: "data-out",
        valueType: "float",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "math.min",
    displayName: "取较小值",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "a",
        label: "输入1",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "b",
        label: "输入2",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "min",
        label: "较小值",
        kind: "data-out",
        valueType: "float",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "math.shift.right",
    displayName: "右移运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "value",
        label: "输入1",
        kind: "data-in",
        valueType: "int",
        ui: { accessory: "gear" },
      },
      {
        id: "offset",
        label: "偏移位数",
        kind: "data-in",
        valueType: "int",
        ui: { accessory: "gear" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "math.log",
    displayName: "对数运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "input",
        label: "输入",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.shift.left",
    displayName: "左移运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "value",
        label: "输入1",
        kind: "data-in",
        valueType: "int",
        ui: { accessory: "gear" },
      },
      {
        id: "offset",
        label: "偏移位数",
        kind: "data-in",
        valueType: "int",
        ui: { accessory: "gear" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "math.pow",
    displayName: "幂运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "base",
        label: "输入1",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "exp",
        label: "指数",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.rad2deg",
    displayName: "弧度转角度",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "radians",
        label: "弧度",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "degrees", label: "角度", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.vector3.split",
    displayName: "拆分三维向量",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "vector",
        label: "三维向量",
        kind: "data-in",
        valueType: "vector3",
      },
      { id: "x", label: "X分量", kind: "data-out", valueType: "float" },
      { id: "y", label: "Y分量", kind: "data-out", valueType: "float" },
      { id: "z", label: "Z分量", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.bit.and",
    displayName: "按位与",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "a",
        label: "输入1",
        kind: "data-in",
        valueType: "int",
        ui: { accessory: "gear" },
      },
      {
        id: "b",
        label: "输入2",
        kind: "data-in",
        valueType: "int",
        ui: { accessory: "gear" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "math.bit.write",
    displayName: "按位写入",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "value", label: "输入", kind: "data-in", valueType: "int" },
      {
        id: "index",
        label: "序号",
        kind: "data-in",
        valueType: "int",
        ui: { accessory: "gear" },
      },
      {
        id: "bit",
        label: "值",
        kind: "data-in",
        valueType: "bool",
        ui: { accessory: "gear" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "math.bit.not",
    displayName: "按位取补",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "value",
        label: "输入",
        kind: "data-in",
        valueType: "int",
        ui: { accessory: "gear" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "math.bit.xor",
    displayName: "按位异或",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "a",
        label: "输入1",
        kind: "data-in",
        valueType: "int",
        ui: { accessory: "gear" },
      },
      {
        id: "b",
        label: "输入2",
        kind: "data-in",
        valueType: "int",
        ui: { accessory: "gear" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "math.bit.or",
    displayName: "按位或",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "a",
        label: "输入1",
        kind: "data-in",
        valueType: "int",
        ui: { accessory: "gear" },
      },
      {
        id: "b",
        label: "输入2",
        kind: "data-in",
        valueType: "int",
        ui: { accessory: "gear" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "math.bit.read",
    displayName: "按位读出",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "value", label: "输入", kind: "data-in", valueType: "int" },
      {
        id: "index",
        label: "序号",
        kind: "data-in",
        valueType: "int",
        ui: { accessory: "gear" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "math.gt",
    displayName: "数值大于",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "a",
        label: "输入1",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "b",
        label: "输入2",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      { id: "ok", label: "结果", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "math.gte",
    displayName: "数值大于等于",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "a",
        label: "输入1",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "b",
        label: "输入2",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      { id: "ok", label: "结果", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "math.lt",
    displayName: "数值小于",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "a",
        label: "输入1",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "b",
        label: "输入2",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      { id: "ok", label: "结果", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "math.lte",
    displayName: "数值小于等于",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "a",
        label: "输入1",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "b",
        label: "输入2",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      { id: "ok", label: "结果", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "math.direction.rotate",
    displayName: "方向向量旋转",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "rotation", label: "旋转", kind: "data-in", valueType: "vector3" },
      { id: "dir", label: "方向向量", kind: "data-in", valueType: "vector3" },
      { id: "result", label: "结果", kind: "data-out", valueType: "vector3" },
    ],
  },
  {
    id: "math.time.weekdayFromTimestamp",
    displayName: "根据时间戳计算星期几",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "timestamp",
        label: "时间戳",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      { id: "weekday", label: "星期几", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "math.time.formatFromTimestamp",
    displayName: "根据时间戳计算格式化时间",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "timestamp",
        label: "时间戳",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      { id: "year", label: "年", kind: "data-out", valueType: "int" },
      { id: "month", label: "月", kind: "data-out", valueType: "int" },
      { id: "day", label: "日", kind: "data-out", valueType: "int" },
      { id: "hour", label: "时", kind: "data-out", valueType: "int" },
      { id: "minute", label: "分", kind: "data-out", valueType: "int" },
      { id: "second", label: "秒", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "math.time.timestampFromFormat",
    displayName: "根据格式化时间计算时间戳",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "year",
        label: "年",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "month",
        label: "月",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "day",
        label: "日",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "hour",
        label: "时",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "minute",
        label: "分",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "second",
        label: "秒",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      { id: "timestamp", label: "时间戳", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "math.mod",
    displayName: "模运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "a",
        label: "输入整数",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      {
        id: "b",
        label: "输入整数",
        kind: "data-in",
        valueType: "int",
        ui: { placeholder: "输入整数" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "int" },
    ],
  },
  {
    id: "math.tan",
    displayName: "正切函数",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "radians",
        label: "弧度",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.sin",
    displayName: "正弦函数",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "radians",
        label: "弧度",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.sqrt",
    displayName: "算术平方根运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "input",
        label: "输入",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "result", label: "结果", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.abs",
    displayName: "绝对值运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "input",
        label: "输入",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "result",
        label: "结果",
        kind: "data-out",
        valueType: "float",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "math.clamp",
    displayName: "范围限制运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "input",
        label: "输入",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "min",
        label: "下限",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "max",
        label: "上限",
        kind: "data-in",
        valueType: "float",
        ui: { accessory: "gear" },
      },
      {
        id: "result",
        label: "结果",
        kind: "data-out",
        valueType: "float",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "math.deg2rad",
    displayName: "角度转弧度",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "degrees",
        label: "角度值",
        kind: "data-in",
        valueType: "float",
        ui: { placeholder: "输入浮点数" },
      },
      { id: "radians", label: "弧度值", kind: "data-out", valueType: "float" },
    ],
  },
  {
    id: "math.logic.and",
    displayName: "逻辑与运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "a", label: "输入1", kind: "data-in", valueType: "bool" },
      { id: "b", label: "输入2", kind: "data-in", valueType: "bool" },
      { id: "result", label: "结果", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "math.logic.xor",
    displayName: "逻辑异或运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "a", label: "输入1", kind: "data-in", valueType: "bool" },
      { id: "b", label: "输入2", kind: "data-in", valueType: "bool" },
      { id: "result", label: "结果", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "math.logic.or",
    displayName: "逻辑或运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "a", label: "输入1", kind: "data-in", valueType: "bool" },
      { id: "b", label: "输入2", kind: "data-in", valueType: "bool" },
      { id: "result", label: "结果", kind: "data-out", valueType: "bool" },
    ],
  },
  {
    id: "math.logic.not",
    displayName: "逻辑非运算",
    category: "运算节点/数学",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      { id: "input", label: "输入", kind: "data-in", valueType: "bool" },
      { id: "result", label: "结果", kind: "data-out", valueType: "bool" },
    ],
  },
  // ───────────────────────────── 02-字典 ─────────────────────────────
  // 运算节点/字典
  {
    id: "math.dict.create",
    displayName: "建立字典",
    category: "运算节点/字典",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "keys",
        label: "键列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
      {
        id: "values",
        label: "值列表",
        kind: "data-in",
        valueType: "list",
        ui: { accessory: "gear" },
      },
      { id: "dict", label: "字典", kind: "data-out", valueType: "any" },
    ],
  },
  {
    id: "math.dict.assemble",
    displayName: "拼装字典",
    category: "运算节点/字典",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "key0",
        label: "键0",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      {
        id: "value0",
        label: "值0",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
      { id: "dict", label: "字典", kind: "data-out", valueType: "any" },
    ],
  },

  // ───────────────────────────── 03-结构体 ─────────────────────────────
  // 运算节点/结构体
  {
    id: "math.struct.decompose",
    displayName: "拆分结构体",
    category: "运算节点/结构体",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "targetStruct",
        label: "目标结构体",
        kind: "data-in",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },
  {
    id: "math.struct.assemble",
    displayName: "拼装结构体",
    category: "运算节点/结构体",
    kind: "math",
    headerColor: MATH_HEADER,
    ports: [
      {
        id: "struct",
        label: "结构体",
        kind: "data-out",
        valueType: "any",
        ui: { accessory: "gear" },
      },
    ],
  },
];

export const nodeDefinitionsById = Object.fromEntries(
  nodeDefinitions.map((def) => [def.id, def])
);

export const categories = Array.from(
  new Set(nodeDefinitions.map((node) => node.category))
).sort();
