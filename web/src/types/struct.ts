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
  labelKey: string;
}> = [
  { value: 'String', labelKey: 'struct.paramType.string' },
  { value: 'StringList', labelKey: 'struct.paramType.stringList' },
  { value: 'Int32', labelKey: 'struct.paramType.int32' },
  { value: 'Int32List', labelKey: 'struct.paramType.int32List' },
  { value: 'Float', labelKey: 'struct.paramType.float' },
  { value: 'FloatList', labelKey: 'struct.paramType.floatList' },
  { value: 'Bool', labelKey: 'struct.paramType.bool' },
  { value: 'BoolList', labelKey: 'struct.paramType.boolList' },
  { value: 'Vector3', labelKey: 'struct.paramType.vector3' },
  { value: 'Vector3List', labelKey: 'struct.paramType.vector3List' },
  { value: 'Entity', labelKey: 'struct.paramType.entity' },
  { value: 'EntityList', labelKey: 'struct.paramType.entityList' },
  { value: 'Guid', labelKey: 'struct.paramType.guid' },
  { value: 'GuidList', labelKey: 'struct.paramType.guidList' },
  { value: 'ConfigReference', labelKey: 'struct.paramType.configId' },
  { value: 'ConfigReferenceList', labelKey: 'struct.paramType.configIdList' },
  { value: 'EntityReference', labelKey: 'struct.paramType.entityId' },
  { value: 'EntityReferenceList', labelKey: 'struct.paramType.entityIdList' },
  { value: 'Army', labelKey: 'struct.paramType.army' },
  { value: 'ArmyList', labelKey: 'struct.paramType.armyList' },
  { value: 'Dict', labelKey: 'struct.paramType.dict' },
  { value: 'DictList', labelKey: 'struct.paramType.dictList' },
  { value: 'Struct', labelKey: 'struct.paramType.struct' },
  { value: 'StructList', labelKey: 'struct.paramType.structList' },
];

export const STRUCT_KIND_LABEL_KEYS: Record<StructKind, string> = {
  basic: 'struct.kind.basic',
  runtime: 'struct.kind.runtime',
};
