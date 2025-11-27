export type StructKind = 'basic' | 'runtime';

export type StructPrimitiveType =
  | 'String'
  | 'Int32'
  | 'Float'
  | 'Bool'
  | 'Vector3'
  | 'Entity'
  | 'Guid'
  | 'ConfigReference'
  | 'EntityReference'
  | 'Army';

export type StructParamType =
  | StructPrimitiveType
  | `${StructPrimitiveType}List`
  | 'Dict'
  | 'DictList'
  | 'Struct'
  | 'StructList';

export type StructDictKeyType =
  | 'String'
  | 'Int32'
  | 'Entity'
  | 'Guid'
  | 'ConfigReference'
  | 'EntityReference'
  | 'Army';

export interface StructDictValuePayload {
  type: 'Dict';
  key_type: StructDictKeyType;
  value_type: StructParamType;
  value: Array<{ key: string; value: unknown }>;
}

export interface StructValueBase<T extends StructParamType = StructParamType, V = unknown> {
  param_type: T;
  value: V;
}

export type StructValue =
  | StructValueBase<'String', string>
  | StructValueBase<'Int32', string>
  | StructValueBase<'Float', string>
  | StructValueBase<'Bool', string>
  | StructValueBase<'Vector3', string>
  | StructValueBase<'Entity', string>
  | StructValueBase<'Guid', string>
  | StructValueBase<'ConfigReference', string>
  | StructValueBase<'EntityReference', string>
  | StructValueBase<'Army', string>
  | StructValueBase<'Struct', { structId: string | null }>
  | StructValueBase<'StructList', string[]>
  | StructValueBase<'Dict', StructDictValuePayload>
  | StructValueBase<`${StructPrimitiveType}List`, string[]>
  | StructValueBase<'DictList', StructDictValuePayload[]>
  | StructValueBase<StructParamType, unknown>;

export interface StructEntry {
  key: string;
  param_type: StructParamType;
  value: StructValue;
}

export interface StructDocument {
  type: 'Struct';
  struct_type?: StructKind;
  struct_ype?: StructKind;
  name: string;
  config_id?: string;
  value: StructEntry[];
}

export interface StructManifestEntry {
  structId: string;
  name: string;
  path: string;
  groupSlug: string;
  groupName?: string;
  structType: StructKind;
  createdAt?: string;
  updatedAt?: string;
}

export interface StructManifestGroup {
  groupSlug: string;
  groupName: string;
  structType?: StructKind;
  sortOrder?: number;
}

export const DEFAULT_STRUCT_KIND: StructKind = 'basic';
export const DEFAULT_STRUCT_GROUP_NAME = '未分类页签';
export const DEFAULT_STRUCT_GROUP_SLUG = 'default';

export const STRUCT_PARAM_OPTIONS: Array<{
  value: StructParamType;
  label: string;
}> = [
  { value: 'String', label: '字符串' },
  { value: 'StringList', label: '字符串列表' },
  { value: 'Int32', label: '整数' },
  { value: 'Int32List', label: '整数列表' },
  { value: 'Float', label: '浮点数' },
  { value: 'FloatList', label: '浮点数列表' },
  { value: 'Bool', label: '布尔值' },
  { value: 'BoolList', label: '布尔值列表' },
  { value: 'Vector3', label: '三维向量' },
  { value: 'Vector3List', label: '三维向量列表' },
  { value: 'Entity', label: '实体' },
  { value: 'EntityList', label: '实体列表' },
  { value: 'Guid', label: 'GUID' },
  { value: 'GuidList', label: 'GUID列表' },
  { value: 'ConfigReference', label: '配置ID' },
  { value: 'ConfigReferenceList', label: '配置ID列表' },
  { value: 'EntityReference', label: '元件ID' },
  { value: 'EntityReferenceList', label: '元件ID列表' },
  { value: 'Army', label: '阵营' },
  { value: 'ArmyList', label: '阵营列表' },
  { value: 'Dict', label: '字典' },
  { value: 'DictList', label: '字典列表' },
  { value: 'Struct', label: '结构体' },
  { value: 'StructList', label: '结构体列表' },
];

export const STRUCT_KIND_LABELS: Record<StructKind, string> = {
  basic: '基础结构体',
  runtime: '局内存档结构体',
};
