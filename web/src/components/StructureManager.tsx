import classNames from 'classnames';
import JSZip from 'jszip';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { useProjectStore } from '../state/projectStore';
import type { ProjectDocument } from '../types/project';
import {
  DEFAULT_STRUCT_GROUP_NAME,
  DEFAULT_STRUCT_GROUP_SLUG,
  DEFAULT_STRUCT_KIND,
  STRUCT_KIND_LABEL_KEYS,
  STRUCT_PARAM_OPTIONS,
  type StructDocument,
  type StructEntry,
  type StructKind,
  type StructManifestEntry,
  type StructParamType,
  type StructValue,
  type StructDictValuePayload,
  type StructDictKeyType,
} from '../types/struct';
import {
  buildStructPath,
  createStructId,
  deriveStructGroupNameFromSlug,
  ensureStructManifestGroups,
  resolveStructLocation,
  slugifyStructGroupName,
} from '../utils/project';
import { useI18n } from '../utils/i18nContext';
import './StructureManager.css';

const ICON_SAVE = new URL('../assets/icons/save.png', import.meta.url).href;
const ICON_MORE = new URL('../assets/icons/more.png', import.meta.url).href;
const ICON_SEARCH = new URL('../assets/icons/search.svg', import.meta.url).href;
const ICON_COPY = new URL('../assets/icons/copy.png', import.meta.url).href;

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface StructureManagerProps {
  projectDocument: ProjectDocument | null;
  dirtyStructIds: Record<string, true>;
  onRequestSave: () => boolean;
  isReadOnly?: boolean;
}

type ContextMenuState =
  | null
  | { type: 'group'; groupSlug: string; x: number; y: number }
  | { type: 'struct'; structId: string; x: number; y: number }
  | { type: 'empty'; x: number; y: number };

type FieldClipboard = StructEntry | null;

const HISTORY_LIMIT = 80;

const cloneStruct = (doc: StructDocument): StructDocument =>
  JSON.parse(JSON.stringify(doc));

const defaultValueForType = (paramType: StructParamType): StructValue => {
  if (paramType.endsWith('List') && paramType !== 'DictList' && paramType !== 'StructList') {
    return { param_type: paramType, value: [] };
  }
  switch (paramType) {
    case 'String':
    case 'Int32':
    case 'ConfigReference':
    case 'EntityReference':
    case 'Entity':
    case 'Army':
      return { param_type: paramType, value: '0' };
    case 'Guid':
      return { param_type: paramType, value: '' };
    case 'Float':
      return { param_type: paramType, value: '0.00' };
    case 'Bool':
      return { param_type: paramType, value: 'False' };
    case 'Vector3':
      return { param_type: paramType, value: '0,0,0' };
    case 'Struct':
      return { param_type: paramType, value: { structId: null } };
    case 'StructList':
      return { param_type: paramType, value: [] };
    case 'Dict':
      return {
        param_type: paramType,
        value: {
          type: 'Dict',
          key_type: 'String',
          value_type: 'String',
          value: [],
        } satisfies StructDictValuePayload,
      };
    case 'DictList':
      return {
        param_type: paramType,
        value: [],
      };
    default:
      return { param_type: paramType, value: '' };
  }
};

const parseVector = (raw: unknown): [string, string, string] => {
  const parts = String(raw ?? '0,0,0').split(',');
  return [parts[0] ?? '0', parts[1] ?? '0', parts[2] ?? '0'];
};

const joinVector = (parts: [string, string, string]) =>
  `${parts[0] || '0'},${parts[1] || '0'},${parts[2] || '0'}`;

const normalizeStructDoc = (
  doc: StructDocument,
  structId: string,
  kind: StructKind,
): StructDocument => {
  const cloned = cloneStruct(doc);
  cloned.struct_type = cloned.struct_type ?? cloned.struct_ype ?? kind;
  cloned.struct_ype = cloned.struct_type;
  cloned.config_id = cloned.config_id ?? structId;
  cloned.value = Array.isArray(cloned.value)
    ? cloned.value.map((entry) => ({
        key: entry.key ?? '',
        param_type: entry.param_type,
        value: entry.value ?? defaultValueForType(entry.param_type),
      }))
    : [];
  return cloned;
};

const containsSelfReference = (doc: StructDocument, structId: string): boolean => {
  const scanValue = (value: StructValue): boolean => {
    if (value.param_type === 'Struct') {
      const v = (value as { value: { structId?: string | null } }).value;
      return v?.structId === structId;
    }
    if (value.param_type === 'StructList' && Array.isArray(value.value)) {
      return (value.value as (string | null)[]).some((item) => item === structId);
    }
    if (value.param_type === 'Dict') {
      const payload = value.value as StructDictValuePayload;
      return Array.isArray(payload.value)
        ? payload.value.some((item) => scanValue(item.value as StructValue))
        : false;
    }
    if (typeof value.value === 'object' && value.value && Array.isArray((value as { value: unknown }).value)) {
      return (value.value as StructValue[]).some((item) => scanValue(item));
    }
    return false;
  };
  return doc.value.some((entry) => scanValue(entry.value));
};

const sanitizeInteger = (value: string, allowNegative: boolean): string => {
  const cleaned = value.replace(/[^\d-]/g, '');
  if (!allowNegative) {
    return cleaned.replace(/-/g, '');
  }
  if (!cleaned.includes('-')) {
    return cleaned;
  }
  const unsigned = cleaned.replace(/-/g, '');
  const isNegative = cleaned.trim().startsWith('-');
  return isNegative ? `-${unsigned}` : unsigned;
};

const sanitizeFloatString = (value: string): string => {
  const cleaned = value.replace(/[^\d\-.]/g, '');
  const isNegative = cleaned.trim().startsWith('-');
  const unsigned = cleaned.replace(/-/g, '');
  const [integerPart = '', ...decimalParts] = unsigned.split('.');
  const decimals = decimalParts.join('');
  let result = (isNegative ? '-' : '') + integerPart;
  if (decimals.length > 0) {
    result += `.${decimals}`;
  }
  return result;
};

const sanitizeGuidString = (value: string): string =>
  value.replace(/\D+/g, '');

const sanitizeVectorString = (value: string): string => {
  const parts = parseVector(value);
  const sanitized = parts.map((part) => {
    const cleaned = sanitizeFloatString(part);
    return cleaned === '' ? '0' : cleaned;
  }) as [string, string, string];
  return joinVector(sanitized);
};

const getListItemType = (paramType: StructParamType): StructParamType | null => {
  if (paramType === 'StructList') return 'Struct';
  if (paramType === 'DictList') return 'Dict';
  if (paramType.endsWith('List')) {
    return paramType.slice(0, -4) as StructParamType;
  }
  return null;
};

const coerceStructValue = (paramType: StructParamType, raw: unknown): StructValue => {
  if (
    raw &&
    typeof raw === 'object' &&
    'param_type' in (raw as Record<string, unknown>) &&
    'value' in (raw as Record<string, unknown>)
  ) {
    return raw as StructValue;
  }
  return {
    param_type: paramType,
    value: raw,
  };
};

const sanitizeDictKey = (keyType: StructDictKeyType, value: string): string => {
  switch (keyType) {
    case 'Int32':
      return sanitizeInteger(value, true);
    case 'Guid':
      return sanitizeGuidString(value);
    case 'Entity':
    case 'ConfigReference':
    case 'EntityReference':
    case 'Army':
      return sanitizeInteger(value, false);
    default:
      return value ?? '';
  }
};

const sanitizeDictPayload = (payload: StructDictValuePayload): StructDictValuePayload => {
  const normalized: StructDictValuePayload = {
    type: 'Dict',
    key_type: payload?.key_type ?? 'String',
    value_type: payload?.value_type ?? 'String',
    value: [],
  };
  const list = Array.isArray(payload?.value) ? payload.value : [];
  normalized.value = list.map((item) => {
    const nextValue = sanitizeStructValue(
      normalized.value_type,
      coerceStructValue(normalized.value_type, item.value),
    );
    return {
      key: sanitizeDictKey(normalized.key_type, item.key ?? ''),
      value: nextValue,
    };
  });
  return normalized;
};

const sanitizeValuePayload = (paramType: StructParamType, rawValue: unknown): unknown => {
  switch (paramType) {
    case 'Int32':
      return sanitizeInteger(String(rawValue ?? ''), true);
    case 'Float':
      return sanitizeFloatString(String(rawValue ?? ''));
    case 'Guid':
      return sanitizeGuidString(String(rawValue ?? ''));
    case 'Bool':
      return String(rawValue) === 'True' ? 'True' : 'False';
    case 'Vector3':
      return sanitizeVectorString(String(rawValue ?? ''));
    case 'ConfigReference':
    case 'EntityReference':
    case 'Entity':
    case 'Army':
      return sanitizeInteger(String(rawValue ?? ''), false);
    case 'Struct':
      return {
        structId:
          typeof (rawValue as { structId?: string | null })?.structId === 'string'
            ? ((rawValue as { structId?: string | null }).structId || null)
            : null,
      };
    case 'StructList': {
      const list = Array.isArray(rawValue) ? rawValue : [];
      return list.map((item) =>
        typeof item === 'string' && item.trim().length > 0 ? item : null,
      );
    }
    case 'Dict':
      return sanitizeDictPayload(
        (rawValue as StructDictValuePayload) ??
          (defaultValueForType('Dict').value as StructDictValuePayload),
      );
    case 'DictList': {
      const list = Array.isArray(rawValue) ? rawValue : [];
      return list.map((item) =>
        sanitizeDictPayload(item as StructDictValuePayload),
      );
    }
    default: {
      const baseType = getListItemType(paramType);
      if (baseType) {
        const list = Array.isArray(rawValue) ? rawValue : [];
        return list.map((item) => sanitizeValuePayload(baseType, item));
      }
      return typeof rawValue === 'string' ? rawValue : String(rawValue ?? '');
    }
  }
};

const sanitizeStructValue = (paramType: StructParamType, value: StructValue): StructValue => ({
  ...value,
  param_type: paramType,
  value: sanitizeValuePayload(paramType, value?.value),
});

const sanitizeStructEntry = (entry: StructEntry): StructEntry => ({
  ...entry,
  key: entry.key ?? '',
  value: sanitizeStructValue(entry.param_type, entry.value),
});

const isValidInteger = (value: string, allowNegative: boolean): boolean => {
  if (!value) return false;
  return allowNegative ? /^-?\d+$/.test(value) : /^\d+$/.test(value);
};

const isValidFloat = (value: string): boolean => /^-?\d+(\.\d+)?$/.test(value);

const isValidGuid = (value: string): boolean => {
  if (!value) return true;
  return /^\d+$/.test(value);
};

const isValidVector = (value: string): boolean => {
  const parts = value.split(',');
  if (parts.length !== 3) return false;
  return parts.every((part) => isValidFloat(part.trim()));
};

const validateDictKey = (keyType: StructDictKeyType, value: string): boolean => {
  switch (keyType) {
    case 'Int32':
      return isValidInteger(value, true);
    case 'Guid':
      return isValidGuid(value);
    case 'Entity':
    case 'ConfigReference':
    case 'EntityReference':
    case 'Army':
      return isValidInteger(value, false);
    default:
      return value.trim().length > 0;
  }
};

const describeField = (entry: StructEntry, index: number, t: Translate): string =>
  entry.key?.trim().length
    ? t('struct.validation.variableNamed', { name: entry.key.trim() })
    : t('struct.validation.variableIndex', { index: index + 1 });

const validateDictPayload = (payload: StructDictValuePayload, label: string, t: Translate): string[] => {
  const errors: string[] = [];
  const entries = Array.isArray(payload?.value) ? payload.value : [];
  entries.forEach((item, index) => {
    const key = item.key ?? '';
    const entryLabel = t('struct.validation.dictKeyLabel', { label, index: index + 1 });
    if (!validateDictKey(payload.key_type, key)) {
      errors.push(t('struct.validation.invalidFormat', { label: entryLabel }));
    }
    const nestedLabel = t('struct.validation.dictValueLabel', { label, index: index + 1 });
    errors.push(
      ...validateStructValue(
        payload.value_type,
        sanitizeStructValue(payload.value_type, coerceStructValue(payload.value_type, item.value)),
        nestedLabel,
        t,
      ),
    );
  });
  return errors;
};

const validateStructValue = (
  paramType: StructParamType,
  value: StructValue,
  label: string,
  t: Translate,
): string[] => {
  const errors: string[] = [];
  const raw = (value as { value: unknown }).value;
  switch (paramType) {
    case 'Int32':
      if (!isValidInteger(String(raw ?? ''), true)) {
        errors.push(t('struct.validation.mustBeInteger', { label }));
      }
      break;
    case 'Float':
      if (!isValidFloat(String(raw ?? ''))) {
        errors.push(t('struct.validation.mustBeFloat', { label }));
      }
      break;
    case 'Guid':
      if (!isValidGuid(String(raw ?? ''))) {
        errors.push(t('struct.validation.mustBeGuid', { label }));
      }
      break;
    case 'ConfigReference':
    case 'EntityReference':
    case 'Entity':
    case 'Army':
      if (!isValidInteger(String(raw ?? ''), false)) {
        errors.push(t('struct.validation.mustBePositiveInteger', { label }));
      }
      break;
    case 'Bool': {
      const val = String(raw ?? '');
      if (val !== 'True' && val !== 'False') {
        errors.push(t('struct.validation.mustBeBool', { label }));
      }
      break;
    }
    case 'Vector3':
      if (!isValidVector(String(raw ?? ''))) {
        errors.push(t('struct.validation.mustBeVector3', { label }));
      }
      break;
    case 'Struct':
      break;
    case 'StructList': {
      const list = Array.isArray(raw) ? raw : [];
      list.forEach((item, index) => {
        if (item && typeof item !== 'string') {
          errors.push(t('struct.validation.structListInvalidRef', { label, index: index + 1 }));
        }
      });
      break;
    }
    case 'Dict':
      errors.push(
        ...validateDictPayload(
          (raw as StructDictValuePayload) ??
            (defaultValueForType('Dict').value as StructDictValuePayload),
          label,
          t,
        ),
      );
      break;
    case 'DictList': {
      const list = Array.isArray(raw) ? raw : [];
      list.forEach((payload, index) => {
        errors.push(
          ...validateDictPayload(
            payload as StructDictValuePayload,
            t('struct.validation.dictListLabel', { label, index: index + 1 }),
            t,
          ),
        );
      });
      break;
    }
    default: {
      const baseType = getListItemType(paramType);
      if (baseType) {
        const list = Array.isArray(raw) ? raw : [];
        list.forEach((item, index) => {
          const nestedValue = sanitizeStructValue(
            baseType,
            coerceStructValue(baseType, item),
          );
          errors.push(
            ...validateStructValue(
              baseType,
              nestedValue,
              t('struct.validation.listItemLabel', { label, index: index + 1 }),
              t,
            ),
          );
        });
        break;
      }
    }
  }
  return errors;
};

const validateStructDocument = (doc: StructDocument, t: Translate): string[] => {
  const entries = Array.isArray(doc.value) ? doc.value : [];
  const errors: string[] = [];
  entries.forEach((entry, index) => {
    const sanitizedEntry = sanitizeStructEntry(entry);
    errors.push(
      ...validateStructValue(
        sanitizedEntry.param_type,
        sanitizedEntry.value,
        describeField(sanitizedEntry, index, t),
        t,
      ),
    );
  });
  return errors;
};

const createDraftFingerprint = (
  structId: string,
  groupSlug: string,
  structKind: StructKind,
  doc: StructDocument,
): string =>
  JSON.stringify({
    id: structId,
    group: groupSlug,
    kind: structKind,
    draft: doc,
  });

const StructureManager = ({
  projectDocument,
  dirtyStructIds,
  onRequestSave,
  isReadOnly = false,
}: StructureManagerProps) => {
  const { t } = useI18n();
  const defaultGroupNameLabelRaw = t('common.defaultGroupName');
  const defaultGroupNameLabel = defaultGroupNameLabelRaw.trim() &&
    defaultGroupNameLabelRaw.trim() !== 'structure-manager__group-label'
    ? defaultGroupNameLabelRaw
    : DEFAULT_STRUCT_GROUP_NAME;
  const updateDocumentBase = useProjectStore((state) => state.updateDocument);
  const setStructDocumentBase = useProjectStore((state) => state.setStructDocument);
  const setStructManifestEntryBase = useProjectStore((state) => state.setStructManifestEntry);
  const removeStructManifestEntryBase = useProjectStore((state) => state.removeStructManifestEntry);
  const markStructDirtyBase = useProjectStore((state) => state.markStructDirty);
  const setStructSaveValidator = useProjectStore((state) => state.setStructSaveValidator);
  const updateDocument = useCallback(
    (updater: (draftDoc: ProjectDocument) => void) => {
      if (isReadOnly) return;
      updateDocumentBase(updater);
    },
    [isReadOnly, updateDocumentBase],
  );
  const setStructDocument = useCallback(
    (structId: string, doc: StructDocument) => {
      if (isReadOnly) return;
      setStructDocumentBase(structId, doc);
    },
    [isReadOnly, setStructDocumentBase],
  );
  const setStructManifestEntry = useCallback(
    (entry: StructManifestEntry) => {
      if (isReadOnly) return;
      setStructManifestEntryBase(entry);
    },
    [isReadOnly, setStructManifestEntryBase],
  );
  const removeStructManifestEntry = useCallback(
    (structId: string) => {
      if (isReadOnly) return;
      removeStructManifestEntryBase(structId);
    },
    [isReadOnly, removeStructManifestEntryBase],
  );
  const markStructDirty = useCallback(
    (structId: string, dirty: boolean) => {
      if (isReadOnly) return;
      markStructDirtyBase(structId, dirty);
    },
    [isReadOnly, markStructDirtyBase],
  );

  const [activeKind, setActiveKind] = useState<StructKind>('basic');
  const [selectedGroupByKind, setSelectedGroupByKind] = useState<Record<StructKind, string>>({
    basic: DEFAULT_STRUCT_GROUP_SLUG,
    runtime: DEFAULT_STRUCT_GROUP_SLUG,
  });
  const selectedGroup = selectedGroupByKind[activeKind];
  const [selectedStructId, setSelectedStructId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [draft, setDraft] = useState<StructDocument | null>(null);
  const historyRef = useRef<StructDocument[]>([]);
  const futureRef = useRef<StructDocument[]>([]);
  const [clipboard, setClipboard] = useState<StructDocument | null>(null);
  const [fieldClipboard, setFieldClipboard] = useState<FieldClipboard>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [moveTargetStruct, setMoveTargetStruct] = useState<string | null>(null);
  const [selfRefError, setSelfRefError] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const closeActionsMenu = useCallback(() => setShowActionsMenu(false), []);
  const [pendingDeleteStructId, setPendingDeleteStructId] = useState<string | null>(null);
  const [groupDialog, setGroupDialog] = useState<{ mode: 'create' | 'rename'; target?: string } | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');
  const dropInfoRef = useRef<{ type: 'group' | 'struct'; id: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const importStructInputRef = useRef<HTMLInputElement | null>(null);
  const importGroupZipInputRef = useRef<HTMLInputElement | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [infoDialog, setInfoDialog] = useState<{ title: string; message: string } | null>(null);
  const [validationDialog, setValidationDialog] = useState<string[] | null>(null);
  const initialStructCreatedRef = useRef<Record<StructKind, boolean>>({ basic: false, runtime: false });
  const copyToastTimerRef = useRef<number | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const actionsToggleRef = useRef<HTMLButtonElement | null>(null);
  const rowDragIndexRef = useRef<number | null>(null);
  const lastPersistedRef = useRef<string | null>(null);
  const loadedStructFingerprintRef = useRef<string | null>(null);
  const [openRowMenu, setOpenRowMenu] = useState<number | null>(null);
  const [structNameInput, setStructNameInput] = useState('');
  const updateSelectedGroup = useCallback(
    (slug: string) =>
      setSelectedGroupByKind((prev) => ({
        ...prev,
        [activeKind]: slug || DEFAULT_STRUCT_GROUP_SLUG,
      })),
    [activeKind],
  );

  const structGroups = useMemo(() => {
    if (!projectDocument) return [];
    const manifestClone = {
      ...projectDocument.manifest,
      structGroups: (projectDocument.manifest.structGroups ?? []).map((group) => ({ ...group })),
    };
    ensureStructManifestGroups(manifestClone);
    const groups = (manifestClone.structGroups ?? []).filter(
      (group) => (group.structType ?? DEFAULT_STRUCT_KIND) === activeKind,
    );
    const dedup = new Map<string, typeof groups[number]>();
    groups.forEach((group) => {
      const slug = group.groupSlug || DEFAULT_STRUCT_GROUP_SLUG;
      if (!dedup.has(slug)) {
        dedup.set(slug, {
          ...group,
          groupSlug: slug,
          groupName: group.groupName || deriveStructGroupNameFromSlug(slug),
        });
      }
    });
    if (!dedup.has(DEFAULT_STRUCT_GROUP_SLUG)) {
      dedup.set(DEFAULT_STRUCT_GROUP_SLUG, {
        groupSlug: DEFAULT_STRUCT_GROUP_SLUG,
        groupName: DEFAULT_STRUCT_GROUP_NAME,
        structType: activeKind,
        sortOrder: 0,
      });
    }
    (projectDocument.manifest.structures ?? [])
      .filter((entry) => (entry.structType ?? DEFAULT_STRUCT_KIND) === activeKind)
      .forEach((entry, index) => {
        const resolved = resolveStructLocation(entry.structId, entry.path, {
          groupNameHint: entry.groupName,
          preferredGroupSlug: entry.groupSlug,
          structType: entry.structType ?? activeKind,
        });
        if (!dedup.has(resolved.groupSlug)) {
          dedup.set(resolved.groupSlug, {
            groupSlug: resolved.groupSlug,
            groupName: resolved.groupName,
            structType: activeKind,
            sortOrder: dedup.size + index,
          });
        }
      });
    return [...dedup.values()].sort((a, b) => {
      const orderA = a.sortOrder ?? 0;
      const orderB = b.sortOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.groupName.localeCompare(b.groupName, 'zh-CN');
    });
  }, [activeKind, projectDocument]);

  const groupMap = useMemo(
    () => new Map(structGroups.map((group) => [group.groupSlug, group])),
    [structGroups],
  );

  useEffect(() => {
    if (!structGroups.length) return;
    const exists = structGroups.some((group) => group.groupSlug === selectedGroup);
    if (!exists) {
      updateSelectedGroup(structGroups[0].groupSlug ?? DEFAULT_STRUCT_GROUP_SLUG);
    }
    const hasMissingGroup = structGroups.some(
      (group) => !(group.groupSlug in expandedGroups),
    );
    if (!hasMissingGroup) {
      return;
    }
    setExpandedGroups((prev) => {
      const next = { ...prev };
      structGroups.forEach((group) => {
        if (!(group.groupSlug in next)) {
          next[group.groupSlug] = true;
        }
      });
      return next;
    });
  }, [expandedGroups, selectedGroup, structGroups, updateSelectedGroup]);

  const structEntries = useMemo(() => {
    if (!projectDocument) return [];
    const entries = projectDocument.manifest.structures ?? [];
    return entries
      .map((entry) => {
        const structDoc = projectDocument.structs?.[entry.structId];
        const structType =
          entry.structType ?? structDoc?.struct_type ?? structDoc?.struct_ype ?? DEFAULT_STRUCT_KIND;
        const resolved = resolveStructLocation(entry.structId, entry.path, {
          groupNameHint: entry.groupName,
          preferredGroupSlug: entry.groupSlug,
          structType,
        });
        return {
          ...entry,
          structType,
          groupSlug: resolved.groupSlug,
          groupName: resolved.groupName,
          path: buildStructPath(structType, resolved.groupSlug, entry.structId),
        };
      })
      .filter((entry) => entry.structType === activeKind);
  }, [activeKind, projectDocument]);
  const structEntryMap = useMemo(
    () => new Map(structEntries.map((entry) => [entry.structId, entry])),
    [structEntries],
  );

  const structsByGroup = useMemo(() => {
    const map = new Map<string, typeof structEntries>();
    structEntries.forEach((entry) => {
      const slug = entry.groupSlug || DEFAULT_STRUCT_GROUP_SLUG;
      const list = map.get(slug) ?? [];
      list.push(entry);
      map.set(slug, list);
    });
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    }
    return map;
  }, [structEntries]);

  const visibleStructs = useMemo(() => {
    const list = structsByGroup.get(selectedGroup) ?? [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return list;
    return list.filter((entry) => entry.name.toLowerCase().includes(term));
  }, [searchTerm, selectedGroup, structsByGroup]);

  useEffect(() => {
    if (visibleStructs.length === 0) {
      if (selectedStructId !== null) {
        setSelectedStructId(null);
      }
      setDraft((prev) => (prev ? null : prev));
      historyRef.current = [];
      futureRef.current = [];
      return;
    }
    const exists = visibleStructs.some((entry) => entry.structId === selectedStructId);
    if (!exists) {
      const nextStructId = visibleStructs[0]?.structId ?? null;
      if (nextStructId && nextStructId !== selectedStructId) {
        setSelectedStructId(nextStructId);
      }
    }
  }, [selectedStructId, visibleStructs]);

  const selectedStructEntry = useMemo(
    () => structEntries.find((entry) => entry.structId === selectedStructId) ?? null,
    [selectedStructId, structEntries],
  );

  const selectedStruct = useMemo(() => {
    if (!projectDocument || !selectedStructEntry) return null;
    const base = projectDocument.structs?.[selectedStructEntry.structId];
    if (!base) return null;
    const kind = selectedStructEntry.structType ?? activeKind;
    return normalizeStructDoc(base, selectedStructEntry.structId, kind);
  }, [activeKind, projectDocument, selectedStructEntry]);
  const fields = useMemo(() => (draft && Array.isArray(draft.value) ? draft.value : []), [draft]);

  useEffect(() => {
    if (!selectedStruct || !selectedStructEntry) {
      setDraft(null);
      historyRef.current = [];
      futureRef.current = [];
      setStructNameInput('');
      lastPersistedRef.current = null;
      loadedStructFingerprintRef.current = null;
      return;
    }
    const structId = selectedStructEntry.structId;
    const structKind = selectedStructEntry.structType ?? activeKind;
    const groupSlug = selectedStructEntry.groupSlug || DEFAULT_STRUCT_GROUP_SLUG;
    const sanitizedStruct: StructDocument = {
      ...selectedStruct,
      value: selectedStruct.value.map((entry) => sanitizeStructEntry(entry)),
    };
    const fingerprint = createDraftFingerprint(structId, groupSlug, structKind, sanitizedStruct);
    if (loadedStructFingerprintRef.current === fingerprint) {
      return;
    }
    loadedStructFingerprintRef.current = fingerprint;
    lastPersistedRef.current = fingerprint;
    setDraft(sanitizedStruct);
    setStructNameInput(sanitizedStruct.name ?? '');
    historyRef.current = [];
    futureRef.current = [];
  }, [activeKind, selectedStruct, selectedStructEntry]);

  useEffect(() => {
    if (!showActionsMenu) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        actionsMenuRef.current?.contains(target) ||
        actionsToggleRef.current?.contains(target)
      ) {
        return;
      }
      setShowActionsMenu(false);
    };
    window.addEventListener('click', handleClick, { capture: true });
    return () => window.removeEventListener('click', handleClick, { capture: true });
  }, [showActionsMenu]);

  useEffect(() => {
    if (openRowMenu === null) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.struct-editor__row-menu')) return;
      setOpenRowMenu(null);
    };
    window.addEventListener('click', handleClick, { capture: true });
    return () => window.removeEventListener('click', handleClick, { capture: true });
  }, [openRowMenu]);

  const pushHistory = useCallback(
    (snapshot: StructDocument) => {
      const next = [...historyRef.current, snapshot];
      if (next.length > HISTORY_LIMIT) {
        next.shift();
      }
      historyRef.current = next;
      futureRef.current = [];
    },
    [],
  );

  const applyDraftUpdate = useCallback(
    (updater: (doc: StructDocument) => StructDocument) => {
      if (isReadOnly) return;
      setDraft((current) => {
        if (!current) return current;
        const next = updater(cloneStruct(current));
        pushHistory(current);
        return next;
      });
    },
    [isReadOnly, pushHistory],
  );

  const handleUndo = useCallback(() => {
    if (isReadOnly) return;
    const prev = historyRef.current;
    if (!prev.length || !draft) return;
    const previous = prev[prev.length - 1];
    historyRef.current = prev.slice(0, -1);
    futureRef.current = [draft, ...futureRef.current].slice(0, HISTORY_LIMIT);
    setDraft(previous);
  }, [draft, isReadOnly]);

  const handleRedo = useCallback(() => {
    if (isReadOnly) return;
    const future = futureRef.current;
    if (!future.length || !draft) return;
    const [next, ...rest] = future;
    futureRef.current = rest;
    historyRef.current = [...historyRef.current, draft].slice(-HISTORY_LIMIT);
    setDraft(next);
  }, [draft, isReadOnly]);

  useEffect(() => {
    if (isReadOnly) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' || event.key === 'Z') {
          event.preventDefault();
          if (event.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleRedo, handleUndo, isReadOnly]);

  useEffect(
    () => () => {
      if (copyToastTimerRef.current) {
        window.clearTimeout(copyToastTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    setShowCopyToast(false);
  }, [selectedStructEntry?.structId]);

  useEffect(() => {
    setValidationDialog(null);
  }, [selectedStructEntry?.structId]);

  const collectValidationErrors = useCallback(
    () => (draft ? validateStructDocument(draft, t) : []),
    [draft, t],
  );

  const handleSaveAll = useCallback(() => {
    if (isReadOnly) return false;
    const errors = collectValidationErrors();
    if (errors.length) {
      setValidationDialog(errors);
      return false;
    }
    const saved = onRequestSave();
    return saved !== false;
  }, [collectValidationErrors, isReadOnly, onRequestSave]);

  useEffect(() => {
    if (isReadOnly) return;
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key !== 's' && event.key !== 'S') return;
      event.preventDefault();
      event.stopPropagation();
      (event as KeyboardEvent & { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
      handleSaveAll();
    };
    window.addEventListener('keydown', handleSaveShortcut, { capture: true });
    return () => window.removeEventListener('keydown', handleSaveShortcut, { capture: true });
  }, [handleSaveAll, isReadOnly]);

  useEffect(() => {
    const validator = () => handleSaveAll();
    setStructSaveValidator(validator);
    return () => setStructSaveValidator(null);
  }, [handleSaveAll, setStructSaveValidator]);

  useEffect(() => {
    if (!draft || !selectedStructEntry) return;
    const structId = selectedStructEntry.structId;
    const structKind = selectedStructEntry.structType ?? activeKind;
    const groupSlug = selectedStructEntry.groupSlug || DEFAULT_STRUCT_GROUP_SLUG;
    const groupName =
      groupMap.get(groupSlug)?.groupName ?? deriveStructGroupNameFromSlug(groupSlug);
    const fingerprint = createDraftFingerprint(structId, groupSlug, structKind, draft);
    if (lastPersistedRef.current === fingerprint) {
      return;
    }
    lastPersistedRef.current = fingerprint;
    loadedStructFingerprintRef.current = fingerprint;
    const normalizedEntry = {
      ...selectedStructEntry,
      name: draft.name,
      groupSlug,
      groupName,
      path: buildStructPath(structKind, groupSlug, structId),
      structType: structKind,
      updatedAt: new Date().toISOString(),
    };
    setStructDocument(structId, normalizeStructDoc(draft, structId, structKind));
    setStructManifestEntry(normalizedEntry);
    markStructDirty(structId, true);
    setSelfRefError(containsSelfReference(draft, structId));
  }, [
    activeKind,
    draft,
    groupMap,
    markStructDirty,
    selectedStructEntry,
    setStructDocument,
    setStructManifestEntry,
  ]);

  const handleCreateStruct = useCallback(() => {
    if (isReadOnly) return;
    const structId = createStructId();
    const targetGroup = selectedGroup || DEFAULT_STRUCT_GROUP_SLUG;
    const structDoc: StructDocument = {
      type: 'Struct',
      struct_type: activeKind,
      struct_ype: activeKind,
      name: t('struct.defaultName'),
      config_id: structId,
      value: [],
    };
    const normalizedDoc = normalizeStructDoc(structDoc, structId, activeKind);
    const groupName =
      groupMap.get(targetGroup)?.groupName ?? deriveStructGroupNameFromSlug(targetGroup);
    const entry = {
      structId,
      name: structDoc.name,
      groupSlug: targetGroup,
      groupName,
      path: buildStructPath(activeKind, targetGroup, structId),
      structType: activeKind,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setStructDocument(structId, normalizedDoc);
    setStructManifestEntry(entry);
    markStructDirty(structId, true);
    setSelectedStructId(structId);
    updateSelectedGroup(targetGroup);
  }, [
    activeKind,
    groupMap,
    isReadOnly,
    markStructDirty,
    selectedGroup,
    setStructDocument,
    setStructManifestEntry,
    t,
    updateSelectedGroup,
  ]);

  useEffect(() => {
    if (!projectDocument) return;
    if (structEntries.length === 0 && !initialStructCreatedRef.current[activeKind]) {
      initialStructCreatedRef.current[activeKind] = true;
      handleCreateStruct();
    }
  }, [activeKind, handleCreateStruct, projectDocument, structEntries.length]);

  const handleDeleteStruct = useCallback(
    (structId: string) => {
      if (isReadOnly) return;
      if (!projectDocument) return;
      removeStructManifestEntry(structId);
      if (projectDocument.structs?.[structId]) {
        updateDocument((draftDoc) => {
          if (!draftDoc.structs) return;
          delete draftDoc.structs[structId];
        });
      }
      if (selectedStructId === structId) {
        setSelectedStructId(null);
        setDraft(null);
      }
    },
    [isReadOnly, projectDocument, removeStructManifestEntry, selectedStructId, updateDocument],
  );

  const handleRenameStruct = useCallback(
    (name: string) => {
      if (isReadOnly) return;
      const trimmed = name.trim();
      if (!draft) return;
      if (!trimmed) {
        setStructNameInput(draft.name);
        return;
      }
      applyDraftUpdate((doc) => ({ ...doc, name: trimmed }));
      setStructNameInput(trimmed);
    },
    [applyDraftUpdate, draft, isReadOnly],
  );

  const handleCreateGroup = useCallback(() => {
    if (isReadOnly) return;
    setGroupDialog({ mode: 'create' });
    setGroupNameInput('');
  }, [isReadOnly]);

  const handleRenameGroup = useCallback(
    (groupSlug: string) => {
      if (isReadOnly) return;
      setGroupDialog({ mode: 'rename', target: groupSlug });
      setGroupNameInput(groupMap.get(groupSlug)?.groupName ?? '');
    },
    [groupMap, isReadOnly],
  );

  const handleDeleteGroup = useCallback(
    (groupSlug: string) => {
      if (isReadOnly) return;
      if (groupSlug === DEFAULT_STRUCT_GROUP_SLUG) return;
      updateDocument((draftDoc) => {
        ensureStructManifestGroups(draftDoc.manifest);
        draftDoc.manifest.structGroups =
          (draftDoc.manifest.structGroups ?? []).filter(
            (group) =>
              !(
                group.groupSlug === groupSlug &&
                (group.structType ?? DEFAULT_STRUCT_KIND) === activeKind
              ),
          );
        draftDoc.manifest.structures = (draftDoc.manifest.structures ?? []).map((entry) =>
          entry.groupSlug === groupSlug && entry.structType === activeKind
            ? {
                ...entry,
                groupSlug: DEFAULT_STRUCT_GROUP_SLUG,
                groupName: DEFAULT_STRUCT_GROUP_NAME,
                path: buildStructPath(
                  entry.structType ?? DEFAULT_STRUCT_KIND,
                  DEFAULT_STRUCT_GROUP_SLUG,
                  entry.structId,
                ),
              }
            : entry,
        );
      });
      if (selectedGroup === groupSlug) {
        updateSelectedGroup(DEFAULT_STRUCT_GROUP_SLUG);
      }
    },
    [activeKind, isReadOnly, selectedGroup, updateDocument, updateSelectedGroup],
  );

  const handleExportGroup = useCallback(
    async (groupSlug: string) => {
      if (!projectDocument) return;
      const groupStructs = (projectDocument.manifest.structures ?? []).filter(
        (entry) => entry.groupSlug === groupSlug && entry.structType === activeKind,
      );
      if (!groupStructs.length) {
        setInfoDialog({ title: t('structManager.exportGroup.errorTitle'), message: t('structManager.exportGroup.empty') });
        return;
      }
      const zip = new JSZip();
      for (const entry of groupStructs) {
        const structDoc = projectDocument.structs?.[entry.structId];
        if (!structDoc) continue;
        zip.file(entry.path, JSON.stringify(structDoc, null, 2));
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = window.document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${deriveStructGroupNameFromSlug(groupSlug)}-${groupSlug}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    },
    [activeKind, projectDocument, setInfoDialog, t],
  );

  const handleGroupDialogSubmit = useCallback(() => {
    const name = groupNameInput.trim();
    if (!name || !groupDialog) return;
    if (groupDialog.mode === 'create') {
      updateDocument((draftDoc) => {
        ensureStructManifestGroups(draftDoc.manifest);
        const slug = slugifyStructGroupName(name);
        if (!draftDoc.manifest.structGroups?.some((group) => group.groupSlug === slug && (group.structType ?? DEFAULT_STRUCT_KIND) === activeKind)) {
          draftDoc.manifest.structGroups?.push({
            groupSlug: slug,
            groupName: name,
            structType: activeKind,
            sortOrder: (draftDoc.manifest.structGroups?.length ?? 0),
          });
        }
      });
    } else if (groupDialog.mode === 'rename' && groupDialog.target) {
      const targetSlug = groupDialog.target;
      updateDocument((draftDoc) => {
        ensureStructManifestGroups(draftDoc.manifest);
        const target = draftDoc.manifest.structGroups?.find(
          (group) => group.groupSlug === targetSlug && (group.structType ?? DEFAULT_STRUCT_KIND) === activeKind,
        );
        if (target) {
          target.groupName = name;
        }
        draftDoc.manifest.structures = (draftDoc.manifest.structures ?? []).map((entry) =>
          entry.groupSlug === targetSlug && entry.structType === activeKind ? { ...entry, groupName: name } : entry,
        );
      });
    }
    setGroupDialog(null);
    setGroupNameInput('');
  }, [activeKind, groupDialog, groupNameInput, updateDocument]);

  const handleCopyStruct = useCallback(() => {
    if (!draft) return;
    setClipboard(cloneStruct(draft));
  }, [draft]);

  const handlePasteStruct = useCallback(() => {
    if (isReadOnly) return;
    if (!clipboard || !selectedStructId) return;
    const currentName = draft?.name;
    applyDraftUpdate(() => {
      const normalized = normalizeStructDoc(clipboard, selectedStructId, activeKind);
      const sanitized = {
        ...normalized,
        value: normalized.value.map((entry) => sanitizeStructEntry(entry)),
      };
      return currentName ? { ...sanitized, name: currentName } : sanitized;
    });
  }, [activeKind, applyDraftUpdate, clipboard, draft?.name, isReadOnly, selectedStructId]);

  const handleExportVariables = useCallback(() => {
    if (!draft) return;
    const structKind = selectedStructEntry?.structType ?? activeKind;
    const structId = selectedStructEntry?.structId ?? draft.config_id ?? createStructId();
    const normalized = normalizeStructDoc(draft, structId, structKind);
    const sanitized = {
      ...normalized,
      value: normalized.value.map((entry) => sanitizeStructEntry(entry)),
    };
    const exportPayload = {
      type: 'Struct',
      struct_type: sanitized.struct_type,
      struct_ype: sanitized.struct_ype,
      config_id: sanitized.config_id,
      name: sanitized.name,
      value: sanitized.value,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const link = window.document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${sanitized.name || 'struct'}-vars.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [activeKind, draft, selectedStructEntry]);

  const handleImportVariables = useCallback(() => {
    if (isReadOnly) return;
    importStructInputRef.current?.click();
  }, [isReadOnly]);

  const handleImportVariablesFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (isReadOnly) {
        event.target.value = '';
        return;
      }
      const file = event.target.files?.[0];
      if (!file || !draft) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (parsed?.type !== 'Struct' || !Array.isArray(parsed?.value)) {
          throw new Error('Invalid struct payload');
        }
        const structId = selectedStructEntry?.structId ?? draft.config_id ?? '';
        const structKind = selectedStructEntry?.structType ?? activeKind;
        const normalizedDoc = normalizeStructDoc(parsed as StructDocument, structId, structKind);
        const sanitizedEntries = normalizedDoc.value.map((entry) => sanitizeStructEntry(entry));
        applyDraftUpdate((doc) => ({ ...doc, value: sanitizedEntries }));
      } catch (error) {
        console.error(error);
        setInfoDialog({
          title: t('structManager.import.errorTitle'),
          message: t('structManager.import.variables.invalidFormat'),
        });
      } finally {
        event.target.value = '';
      }
    },
    [activeKind, applyDraftUpdate, draft, isReadOnly, selectedStructEntry, setInfoDialog, t],
  );

  const handleImportStructs = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (isReadOnly) {
        event.target.value = '';
        return;
      }
      const files = Array.from(event.target.files ?? []);
      event.target.value = '';
      if (!files.length) return;
      const groupName =
        groupMap.get(selectedGroup)?.groupName ?? deriveStructGroupNameFromSlug(selectedGroup);
      for (const file of files) {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text) as StructDocument;
          if (parsed.type !== 'Struct') continue;
          const structId = createStructId();
          const docNormalized = normalizeStructDoc(parsed, structId, activeKind);
          const sanitizedDoc = {
            ...docNormalized,
            value: docNormalized.value.map((entry) => sanitizeStructEntry(entry)),
          };
          const entry = {
            structId,
            name: sanitizedDoc.name,
            groupSlug: selectedGroup,
            groupName,
            path: buildStructPath(activeKind, selectedGroup, structId),
            structType: activeKind,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setStructDocument(structId, sanitizedDoc);
          setStructManifestEntry(entry);
          markStructDirty(structId, true);
          setSelectedStructId(structId);
        } catch (error) {
          console.error(error);
          setInfoDialog({
            title: t('structManager.import.errorTitle'),
            message: t('structManager.import.errorWithReason', { error: String(error) }),
          });
        }
      }
    },
    [
      activeKind,
      groupMap,
      isReadOnly,
      markStructDirty,
      selectedGroup,
      setInfoDialog,
      setStructDocument,
      setStructManifestEntry,
      t,
    ],
  );

  const handleImportGroupZip = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (isReadOnly) {
        event.target.value = '';
        return;
      }
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        const zip = await JSZip.loadAsync(file);
        const existingSlugs = new Map<StructKind, Set<string>>();
        (projectDocument?.manifest.structGroups ?? []).forEach((group) => {
          const kind = group.structType ?? DEFAULT_STRUCT_KIND;
          const slug = group.groupSlug || DEFAULT_STRUCT_GROUP_SLUG;
          if (!existingSlugs.has(kind)) {
            existingSlugs.set(kind, new Set());
          }
          existingSlugs.get(kind)!.add(slug);
        });
        const slugMap = new Map<string, string>();
        const ensureGroupSlug = (structType: StructKind, slug: string) => {
          const normalized = slug || DEFAULT_STRUCT_GROUP_SLUG;
          const key = `${structType}:${normalized}`;
          if (slugMap.has(key)) {
            return slugMap.get(key)!;
          }
          const used = existingSlugs.get(structType) ?? new Set<string>();
          let candidate = normalized;
          let suffix = 2;
          while (used.has(candidate)) {
            candidate = `${normalized}-${suffix}`;
            suffix += 1;
          }
          used.add(candidate);
          existingSlugs.set(structType, used);
          slugMap.set(key, candidate);
          return candidate;
        };
        const importedStructs: Array<{
          structId: string;
          structKind: StructKind;
          groupSlug: string;
          doc: StructDocument;
        }> = [];
        const entries = Object.values(zip.files);
        for (const zipEntry of entries) {
          if (zipEntry.dir || !zipEntry.name.endsWith('.json')) continue;
          const normalizedName = zipEntry.name.replace(/\\/g, '/');
          const segments = normalizedName.split('/');
          if (segments.length < 4 || segments[0] !== 'struct') continue;
          const structKind: StructKind = segments[1] === 'save' ? 'runtime' : 'basic';
          const originalGroupSlug = segments[2] || DEFAULT_STRUCT_GROUP_SLUG;
          const structFile = segments.slice(3).join('/');
          const structIdFromPath = structFile.replace(/\.json$/i, '');
          const mappedGroupSlug = ensureGroupSlug(structKind, originalGroupSlug);
          try {
            const content = await zipEntry.async('string');
            const parsed = JSON.parse(content) as StructDocument;
            if (parsed.type !== 'Struct') continue;
            let structId = structIdFromPath;
            const alreadyExists =
              !structId ||
              projectDocument?.structs?.[structId] ||
              importedStructs.some((item) => item.structId === structId);
            if (alreadyExists) {
              structId = createStructId();
            }
            const normalizedDoc = normalizeStructDoc(parsed, structId, structKind);
            const sanitizedDoc = {
              ...normalizedDoc,
              value: normalizedDoc.value.map((entry) => sanitizeStructEntry(entry)),
            };
            importedStructs.push({
              structId,
              structKind,
              groupSlug: mappedGroupSlug,
              doc: sanitizedDoc,
            });
          } catch (error) {
            console.error(error);
          }
        }
        if (!importedStructs.length) {
          setInfoDialog({
            title: t('structManager.import.errorTitle'),
            message: t('structManager.import.zip.noStructFiles'),
          });
          return;
        }
        let lastStructId: string | null = null;
        const affectedGroups = new Set<string>();
        importedStructs.forEach((item) => {
          const groupName = deriveStructGroupNameFromSlug(item.groupSlug);
          const entry = {
            structId: item.structId,
            name: item.doc.name,
            groupSlug: item.groupSlug,
            groupName,
            path: buildStructPath(item.structKind, item.groupSlug, item.structId),
            structType: item.structKind,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setStructDocument(item.structId, item.doc);
          setStructManifestEntry(entry);
          markStructDirty(item.structId, true);
          lastStructId = item.structId;
          if (item.structKind === activeKind) {
            affectedGroups.add(item.groupSlug);
          }
        });
        if (lastStructId) {
          setSelectedStructId(lastStructId);
        }
        const firstGroupSlug = Array.from(affectedGroups)[0];
        if (firstGroupSlug) {
          updateSelectedGroup(firstGroupSlug);
        }
        setInfoDialog({
          title: t('structManager.import.zip.successTitle'),
          message: t('structManager.import.zip.successMessage', { count: importedStructs.length }),
        });
      } catch (error) {
        console.error(error);
        setInfoDialog({
          title: t('structManager.import.errorTitle'),
          message: t('structManager.import.zip.parseFailed'),
        });
      }
    },
    [
      activeKind,
      isReadOnly,
      markStructDirty,
      projectDocument,
      setInfoDialog,
      setSelectedStructId,
      setStructDocument,
      setStructManifestEntry,
      t,
      updateSelectedGroup,
    ],
  );

  const handleCopyConfigId = useCallback(() => {
    if (!selectedStructEntry) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(selectedStructEntry.structId).catch(() => undefined);
    }
    if (copyToastTimerRef.current) {
      window.clearTimeout(copyToastTimerRef.current);
    }
    setShowCopyToast(true);
    copyToastTimerRef.current = window.setTimeout(() => {
      setShowCopyToast(false);
      copyToastTimerRef.current = null;
    }, 1400);
  }, [selectedStructEntry]);

  const startMoveStruct = useCallback((structId: string) => {
    setMoveTargetStruct(structId);
  }, []);

  const moveStructToGroup = useCallback(
    (structId: string, targetGroup: string) => {
      const entry = structEntryMap.get(structId);
      if (!entry) return;
      const structType = entry.structType ?? activeKind;
      const groupName =
        groupMap.get(targetGroup)?.groupName ?? deriveStructGroupNameFromSlug(targetGroup);
      const nextEntry = {
        ...entry,
        groupSlug: targetGroup,
        groupName,
        path: buildStructPath(structType, targetGroup, structId),
      };
      setStructManifestEntry(nextEntry);
      markStructDirty(structId, true);
      if (targetGroup !== selectedGroup && selectedStructId === structId) {
        setSelectedStructId(null);
      }
    },
    [
      activeKind,
      groupMap,
      markStructDirty,
      selectedGroup,
      selectedStructId,
      setSelectedStructId,
      setStructManifestEntry,
      structEntryMap,
    ],
  );

  const handleMoveStructConfirm = useCallback(
    (targetGroup: string) => {
      if (!moveTargetStruct) return;
      moveStructToGroup(moveTargetStruct, targetGroup);
      setMoveTargetStruct(null);
    },
    [moveStructToGroup, moveTargetStruct],
  );

  const handleAddField = useCallback(() => {
    applyDraftUpdate((doc) => {
      const current = Array.isArray(doc.value) ? doc.value : [];
      const nextIndex = current.length + 1;
      const entry: StructEntry = {
        key: t('structManager.field.newKey', { index: nextIndex }),
        param_type: 'String',
        value: defaultValueForType('String'),
      };
      return { ...doc, value: [...current, entry] };
    });
  }, [applyDraftUpdate, t]);

  const handleRemoveField = useCallback(
    (index: number) => {
      applyDraftUpdate((doc) => {
        const current = Array.isArray(doc.value) ? doc.value : [];
        const next = [...current];
        next.splice(index, 1);
        return { ...doc, value: next };
      });
    },
    [applyDraftUpdate],
  );

  const handleFieldChange = useCallback(
    (index: number, updater: (entry: StructEntry) => StructEntry) => {
      applyDraftUpdate((doc) => {
        const current = Array.isArray(doc.value) ? doc.value : [];
        const next = [...current];
        const currentEntry = next[index];
        if (!currentEntry) return doc;
        next[index] = sanitizeStructEntry(updater(currentEntry));
        return { ...doc, value: next };
      });
    },
    [applyDraftUpdate],
  );

  const handleFieldMove = useCallback(
    (index: number, delta: number) => {
      applyDraftUpdate((doc) => {
        const current = Array.isArray(doc.value) ? doc.value : [];
        const next = [...current];
        const targetIndex = index + delta;
        if (index < 0 || index >= next.length || targetIndex < 0 || targetIndex >= next.length) {
          return doc;
        }
        const [item] = next.splice(index, 1);
        next.splice(targetIndex, 0, item);
        return { ...doc, value: next };
      });
    },
    [applyDraftUpdate],
  );

  const handleFieldDrop = useCallback(
    (targetIndex: number) => {
      const sourceIndex = rowDragIndexRef.current;
      rowDragIndexRef.current = null;
      if (sourceIndex == null || sourceIndex === targetIndex) return;
      applyDraftUpdate((doc) => {
        const current = Array.isArray(doc.value) ? doc.value : [];
        if (
          sourceIndex < 0 ||
          sourceIndex >= current.length ||
          targetIndex < 0 ||
          targetIndex >= current.length
        ) {
          return doc;
        }
        const next = [...current];
        const [item] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, item);
        return { ...doc, value: next };
      });
    },
    [applyDraftUpdate],
  );

  const handleFieldCopy = useCallback(
    (entry: StructEntry) => {
      setFieldClipboard(JSON.parse(JSON.stringify(entry)) as StructEntry);
    },
    [],
  );

  const handleFieldPaste = useCallback(
    (index: number) => {
      if (!fieldClipboard) return;
      handleFieldChange(index, () => JSON.parse(JSON.stringify(fieldClipboard)) as StructEntry);
    },
    [fieldClipboard, handleFieldChange],
  );

  const handleAddListItem = useCallback(
    (index: number) => {
      handleFieldChange(index, (entry) => {
        const isStructList = entry.param_type === 'StructList';
        const value = Array.isArray(entry.value.value) ? [...(entry.value.value as unknown[])] : [];
        value.push(isStructList ? null : entry.param_type === 'Vector3List' ? '0,0,0' : '');
        return {
          ...entry,
          value: { param_type: entry.value.param_type, value },
        };
      });
    },
    [handleFieldChange],
  );

  const handleListItemChange = useCallback(
    (fieldIndex: number, itemIndex: number, nextValue: string | null) => {
      handleFieldChange(fieldIndex, (entry) => {
        const list = Array.isArray(entry.value.value) ? [...(entry.value.value as unknown[])] : [];
        list[itemIndex] = nextValue;
        return {
          ...entry,
          value: { ...entry.value, value: list },
        };
      });
    },
    [handleFieldChange],
  );

  const handleRemoveListItem = useCallback(
    (fieldIndex: number, itemIndex: number) => {
      handleFieldChange(fieldIndex, (entry) => {
        const list = Array.isArray(entry.value.value) ? [...(entry.value.value as unknown[])] : [];
        list.splice(itemIndex, 1);
        return {
          ...entry,
          value: { ...entry.value, value: list },
        };
      });
    },
    [handleFieldChange],
  );

  const handleDictChange = useCallback(
    (fieldIndex: number, updater: (payload: StructDictValuePayload) => StructDictValuePayload) => {
      handleFieldChange(fieldIndex, (entry) => {
        const payload = (entry.value.value ?? defaultValueForType('Dict').value) as StructDictValuePayload;
        return {
          ...entry,
          value: { ...entry.value, value: updater(payload) },
        };
      });
    },
    [handleFieldChange],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    const closeMenu = () => {
      setContextMenu(null);
      if (typeof window !== 'undefined' && window.document) {
        window.document
          .querySelectorAll('.struct-editor__row-menu.is-open')
          .forEach((el) => el.classList.remove('is-open'));
      }
    };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleGroupDrop = (event: DragEvent<HTMLButtonElement>, targetSlug: string) => {
    if (isReadOnly) return;
    event.preventDefault();
    const source = dropInfoRef.current;
    dropInfoRef.current = null;
    if (!source) return;
    if (source.type === 'struct') {
      moveStructToGroup(source.id, targetSlug);
      return;
    }
    if (source.type !== 'group' || source.id === targetSlug) return;
    const ordered = [...structGroups];
    const sourceIndex = ordered.findIndex((group) => group.groupSlug === source.id);
    const targetIndex = ordered.findIndex((group) => group.groupSlug === targetSlug);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [item] = ordered.splice(sourceIndex, 1);
    ordered.splice(targetIndex, 0, item);
    updateDocument((draftDoc) => {
      ensureStructManifestGroups(draftDoc.manifest);
      const remaining =
        draftDoc.manifest.structGroups?.filter(
          (group) => (group.structType ?? DEFAULT_STRUCT_KIND) !== activeKind,
        ) ?? [];
      const reordered = ordered.map((group, index) => ({
        ...group,
        structType: activeKind,
        sortOrder: index,
      }));
      draftDoc.manifest.structGroups = [...remaining, ...reordered];
    });
  };

  const handleStructDrop = (
    event: DragEvent<HTMLElement>,
    targetId: string | null,
    targetGroupSlug: string,
  ) => {
    if (isReadOnly) return;
    event.preventDefault();
    const source = dropInfoRef.current;
    dropInfoRef.current = null;
    if (!source || source.type !== 'struct') return;
    const sourceEntry = structEntryMap.get(source.id);
    if (!sourceEntry) return;
    const sourceGroup = sourceEntry.groupSlug || DEFAULT_STRUCT_GROUP_SLUG;
    if (sourceGroup !== targetGroupSlug) {
      moveStructToGroup(source.id, targetGroupSlug);
      return;
    }
    if (!targetId || source.id === targetId) return;
    const list = structsByGroup.get(targetGroupSlug);
    if (!list) return;
    const ordered = [...list];
    const sourceIndex = ordered.findIndex((item) => item.structId === source.id);
    const targetIndex = ordered.findIndex((item) => item.structId === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [item] = ordered.splice(sourceIndex, 1);
    ordered.splice(targetIndex, 0, item);
    updateDocument((draftDoc) => {
      const orderMap = new Map(ordered.map((entry, idx) => [entry.structId, idx]));
      const nextStructures = (draftDoc.manifest.structures ?? []).map((entry) => {
        const orderIndex = orderMap.get(entry.structId);
        if (orderIndex == null) {
          return entry;
        }
        return ordered[orderIndex];
      });
      draftDoc.manifest.structures = nextStructures;
    });
  };

  const renderVectorFields = (
    parts: [string, string, string],
    onAxisChange: (axisIndex: number, value: string) => void,
    extraClassName?: string,
  ) => (
    <div className={classNames('struct-editor__vector', extraClassName)}>
      {(['X', 'Y', 'Z'] as const).map((axis, axisIndex) => (
        <label
          key={axis}
          className={classNames('struct-editor__vector-cell', {
            [`struct-editor__vector-cell--${axis.toLowerCase()}`]: true,
          })}
        >
          <span className="struct-editor__vector-tag">{axis}</span>
          <input
            value={parts[axisIndex]}
            onChange={(event) => onAxisChange(axisIndex, event.target.value)}
          />
        </label>
      ))}
    </div>
  );

  const renderValueInput = (entry: StructEntry, index: number) => {
    const { param_type } = entry;
    if (param_type === 'Bool') {
      const value = String((entry.value as { value: string }).value ?? 'False');
      return (
        <select
          value={value}
          onChange={(event) =>
            handleFieldChange(index, (prev) => ({
              ...prev,
              value: { param_type: prev.value.param_type, value: event.target.value },
            }))
          }
        >
          <option value="True">True</option>
          <option value="False">False</option>
        </select>
      );
    }

    if (param_type === 'Vector3') {
      const parts = parseVector((entry.value as { value: string }).value);
      return renderVectorFields(parts, (axisIndex, value) => {
        const next = [...parts] as [string, string, string];
        next[axisIndex] = value;
        handleFieldChange(index, (prev) => ({
          ...prev,
          value: { param_type: prev.value.param_type, value: joinVector(next) },
        }));
      });
    }

    if (param_type === 'Dict') {
      const payload = (entry.value.value as StructDictValuePayload) ?? defaultValueForType('Dict').value;
      return (
        <div className="struct-editor__dict">
          <div className="struct-editor__dict-row">
            <label>{t('common.keyType')}</label>
            <select
              value={payload.key_type}
              onChange={(event) =>
                handleDictChange(index, (prev) => ({ ...prev, key_type: event.target.value as StructDictValuePayload['key_type'] }))
              }
            >
              {['String', 'Int32', 'Entity', 'Guid', 'ConfigReference', 'EntityReference', 'Army'].map((option) => (
                <option key={option} value={option}>
                  {t(STRUCT_PARAM_OPTIONS.find((opt) => opt.value === option)?.labelKey ?? '') ||
                    option}
                </option>
              ))}
            </select>
            <label>{t('common.valueType')}</label>
            <select
              value={payload.value_type}
              onChange={(event) =>
                handleDictChange(index, (prev) => ({ ...prev, value_type: event.target.value as StructParamType }))
              }
            >
              {STRUCT_PARAM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="struct-editor__dict-list">
            {(payload.value ?? []).map((item, itemIndex) => (
              <div key={`${item.key}-${itemIndex}`} className="struct-editor__dict-item">
                <input
                  value={item.key ?? ''}
                  onChange={(event) =>
                    handleDictChange(index, (prev) => {
                      const nextList = [...(prev.value ?? [])];
                      nextList[itemIndex] = { ...nextList[itemIndex], key: event.target.value };
                      return { ...prev, value: nextList };
                    })
                  }
                  placeholder={t('common.key')}
                />
                <input
                  value={String((item.value as { value?: unknown })?.value ?? (item.value as unknown as string) ?? '')}
                  onChange={(event) =>
                    handleDictChange(index, (prev) => {
                      const nextList = [...(prev.value ?? [])];
                      nextList[itemIndex] = {
                        ...nextList[itemIndex],
                        value: {
                          param_type: payload.value_type,
                          value: event.target.value,
                        },
                      };
                      return { ...prev, value: nextList };
                    })
                  }
                  placeholder={t('common.value')}
                />
                <button
                  type="button"
                  className="struct-editor__list-remove"
                  onClick={() =>
                    handleDictChange(index, (prev) => {
                      const nextList = [...(prev.value ?? [])];
                      nextList.splice(itemIndex, 1);
                      return { ...prev, value: nextList };
                    })
                  }
                >
                  {t('common.delete')}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="struct-editor__list-add"
              onClick={() =>
                handleDictChange(index, (prev) => ({
                  ...prev,
                  value: [...(prev.value ?? []), { key: '', value: { param_type: payload.value_type, value: '' } }],
                }))
              }
            >
              {t('structManager.dict.addEntry')}
            </button>
          </div>
        </div>
      );
    }

    if (param_type === 'Struct') {
      const availableStructs = structEntries.filter((item) => item.structId !== selectedStructId);
      return (
        <select
          value={(entry.value as { value: { structId: string | null } }).value?.structId ?? ''}
          onChange={(event) =>
            handleFieldChange(index, (prev) => ({
              ...prev,
              value: { param_type: prev.value.param_type, value: { structId: event.target.value || null } },
            }))
          }
        >
          <option value="">{t('common.uninitialized')}</option>
          {availableStructs.map((item) => (
            <option key={item.structId} value={item.structId}>
              {item.name}
            </option>
          ))}
        </select>
      );
    }

    if (param_type === 'StructList' || param_type.endsWith('List')) {
      const list = Array.isArray(entry.value.value) ? (entry.value.value as (string | null)[]) : [];
      const isBoolList = param_type === 'BoolList';
      return (
        <div className="struct-editor__list">
          <div className="struct-editor__list-header">
            <span>{t('common.listValues')}</span>
            <button type="button" onClick={() => handleAddListItem(index)}>
              +
            </button>
          </div>
          <div className="struct-editor__list-body">
            {list.map((value, itemIndex) => (
              <div className="struct-editor__list-row" key={`${itemIndex}-${value}`}>
                {param_type === 'Vector3List' ? (
                  (() => {
                    const parts = parseVector(value ?? '0,0,0');
                    return renderVectorFields(
                      parts as [string, string, string],
                      (axisIndex, inputValue) => {
                        const nextParts = [...parts] as [string, string, string];
                        nextParts[axisIndex] = inputValue;
                        handleListItemChange(index, itemIndex, joinVector(nextParts));
                      },
                      'struct-editor__vector--list',
                    );
                  })()
                ) : isBoolList ? (
                  <select
                    value={String(value ?? 'False')}
                    onChange={(event) => handleListItemChange(index, itemIndex, event.target.value)}
                  >
                    <option value="True">True</option>
                    <option value="False">False</option>
                  </select>
                ) : (
                  <input
                    value={value ?? ''}
                    onChange={(event) => handleListItemChange(index, itemIndex, event.target.value)}
                    onBlur={(event) => handleListItemChange(index, itemIndex, event.target.value)}
                  />
                )}
                <button
                  type="button"
                  className="struct-editor__list-remove"
                  onClick={() => handleRemoveListItem(index, itemIndex)}
                >
                  {t('common.delete')}
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <input
        value={(entry.value.value as string) ?? ''}
        onChange={(event) =>
          handleFieldChange(index, (prev) => ({
            ...prev,
            value: { param_type: prev.value.param_type, value: event.target.value },
          }))
        }
        onBlur={(event) =>
          handleFieldChange(index, (prev) => ({
            ...prev,
            value: { param_type: prev.value.param_type, value: event.target.value },
          }))
        }
      />
    );
  };

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    if (contextMenu.type === 'group') {
      return (
        <div
          className="struct-manager__menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => { handleRenameGroup(contextMenu.groupSlug); closeContextMenu(); }}>{t('common.rename')}</button>
          <button type="button" onClick={() => { handleDeleteGroup(contextMenu.groupSlug); closeContextMenu(); }}>{t('structManager.group.disband')}</button>
          <button type="button" onClick={() => { handleExportGroup(contextMenu.groupSlug); closeContextMenu(); }}>{t('structManager.group.exportZip')}</button>
        </div>
      );
    }
    if (contextMenu.type === 'struct') {
      return (
        <div
          className="struct-manager__menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => { setSelectedStructId(contextMenu.structId); closeContextMenu(); }}>{t('common.open')}</button>
          <button type="button" onClick={() => { setMoveTargetStruct(contextMenu.structId); closeContextMenu(); }}>{t('structManager.struct.changeGroup')}</button>
          <button type="button" onClick={() => { handleDeleteStruct(contextMenu.structId); closeContextMenu(); }} className="is-danger">{t('common.delete')}</button>
          <button type="button" onClick={() => { setSelectedStructId(contextMenu.structId); handleCopyStruct(); closeContextMenu(); }}>{t('common.copy')}</button>
          <button
            type="button"
            disabled={!clipboard}
            onClick={() => { setSelectedStructId(contextMenu.structId); handlePasteStruct(); closeContextMenu(); }}
          >
            {t('common.paste')}
          </button>
          <button type="button" onClick={() => { setSelectedStructId(contextMenu.structId); handleExportVariables(); closeContextMenu(); }}>{t('structManager.variables.export')}</button>
          <button type="button" onClick={() => { setSelectedStructId(contextMenu.structId); handleImportVariables(); closeContextMenu(); }}>{t('structManager.variables.import')}</button>
        </div>
      );
    }
    return (
      <div
        className="struct-manager__menu"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" onClick={() => { handleCreateStruct(); closeContextMenu(); }}>{t('structManager.struct.create')}</button>
        <button type="button" onClick={() => { importInputRef.current?.click(); closeContextMenu(); }}>{t('structManager.struct.import')}</button>
        <button type="button" onClick={() => { handleCreateGroup(); closeContextMenu(); }}>{t('structManager.group.create')}</button>
        <button
          type="button"
          onClick={() => {
            importGroupZipInputRef.current?.click();
            closeContextMenu();
          }}
        >{t('structManager.group.importZip')}</button>
      </div>
    );
  };

  return (
    <div className="structure-manager" onContextMenu={(event) => event.preventDefault()}>
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        multiple
        hidden
        onChange={handleImportStructs}
        disabled={isReadOnly}
      />
      <input
        ref={importStructInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleImportVariablesFile}
        disabled={isReadOnly}
      />
      <input
        ref={importGroupZipInputRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={handleImportGroupZip}
        disabled={isReadOnly}
      />
      <div className="structure-manager__sidebar">
        <div className="structure-manager__tabs">
          {(['basic', 'runtime'] as StructKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className={classNames('structure-manager__tab', { 'is-active': activeKind === kind })}
              onClick={() => setActiveKind(kind)}
            >
              {t(STRUCT_KIND_LABEL_KEYS[kind])}
            </button>
          ))}
        </div>
        <div className="structure-manager__search">
          <img src={ICON_SEARCH} alt="" aria-hidden="true" />
          <input
            type="text"
            placeholder={t('structManager.search.placeholder')}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div
          className="structure-manager__tree"
          onContextMenu={(event) => {
            if (isReadOnly) return;
            event.preventDefault();
            const item = (event.target as HTMLElement).closest('[data-tree-type]');
            if (item) {
              const type = item.getAttribute('data-tree-type');
              const id = item.getAttribute('data-tree-id') ?? '';
              if (type === 'group') {
                setContextMenu({ type: 'group', groupSlug: id, x: event.clientX, y: event.clientY });
                return;
              }
              if (type === 'struct') {
                setContextMenu({ type: 'struct', structId: id, x: event.clientX, y: event.clientY });
                return;
              }
            }
            setContextMenu({ type: 'empty', x: event.clientX, y: event.clientY });
          }}
        >
          {structGroups.map((group) => {
            const isActiveGroup = group.groupSlug === selectedGroup;
            const isExpanded = expandedGroups[group.groupSlug] ?? true;
            const entries = structsByGroup.get(group.groupSlug) ?? [];
            return (
              <div key={group.groupSlug} className="structure-manager__tree-group">
                <button
                  type="button"
                  data-tree-type="group"
                  data-tree-id={group.groupSlug}
                  className={classNames('structure-manager__group', { 'is-active': isActiveGroup })}
                  onClick={() => {
                    updateSelectedGroup(group.groupSlug);
                    setExpandedGroups((prev) => ({ ...prev, [group.groupSlug]: !isExpanded }));
                  }}
                  onDragStart={
                    isReadOnly
                      ? undefined
                      : () => {
                          dropInfoRef.current = { type: 'group', id: group.groupSlug };
                        }
                  }
                  draggable={!isReadOnly}
                  onDragOver={(event) => {
                    if (isReadOnly) return;
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (isReadOnly) return;
                    handleGroupDrop(event, group.groupSlug);
                  }}
                >
                  <span className="structure-manager__group-arrow">{isExpanded ? '▾' : '▸'}</span>
                  <span className="structure-manager__group-label">
                    {group.groupSlug === DEFAULT_STRUCT_GROUP_SLUG &&
                    group.groupName === DEFAULT_STRUCT_GROUP_NAME
                      ? defaultGroupNameLabel
                      : group.groupName}
                  </span>
                </button>
                {isExpanded && (
                  <div
                    className="structure-manager__tree-list"
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleStructDrop(event, null, group.groupSlug);
                    }}
                  >
                    {entries.map((entry) => {
                      const isActive = entry.structId === selectedStructId;
                      const isDirty = Boolean(dirtyStructIds[entry.structId]);
                      return (
                        <div
                          key={entry.structId}
                          data-tree-type="struct"
                          data-tree-id={entry.structId}
                          draggable={!isReadOnly}
                          onDragStart={
                            isReadOnly
                              ? undefined
                              : () => {
                                  dropInfoRef.current = { type: 'struct', id: entry.structId };
                                }
                          }
                          onDragOver={(event) => {
                            if (isReadOnly) return;
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onDrop={(event) => {
                            if (isReadOnly) return;
                            event.preventDefault();
                            event.stopPropagation();
                            handleStructDrop(event, entry.structId, group.groupSlug);
                          }}
                          className={classNames('structure-manager__list-item', { 'is-active': isActive })}
                          onClick={() => {
                            updateSelectedGroup(group.groupSlug);
                            setSelectedStructId(entry.structId);
                          }}
                        >
                          <span>{entry.name}</span>
                          {isDirty && <span className="structure-manager__dirty">*</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="structure-manager__footer">
          <button
            type="button"
            className="structure-manager__action"
            onClick={handleCreateStruct}
            disabled={isReadOnly}
          >
            {t('structManager.actions.createStruct')}
          </button>
          <button
            type="button"
            className="structure-manager__action"
            onClick={handleSaveAll}
            disabled={isReadOnly}
          >
            <img src={ICON_SAVE} alt="" aria-hidden="true" />
            {t('structManager.actions.applyAll')}
          </button>
        </div>
      </div>

      <div className="structure-manager__editor">
        {draft && selectedStructEntry ? (
          <fieldset className="struct-editor__fieldset" disabled={isReadOnly}>
            <header className="struct-editor__header">
              <div className="struct-editor__title">
                <input
                  value={structNameInput}
                  onChange={(event) => setStructNameInput(event.target.value)}
                  onBlur={() => handleRenameStruct(structNameInput)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                />
                <div className="struct-editor__config-block">
                  <span className="struct-editor__config">{t('common.configId')}: {selectedStructEntry.structId}</span>
                  <button type="button" className="struct-editor__copy-button" onClick={handleCopyConfigId}>
                    <img
                      src={ICON_COPY}
                      alt={t('structManager.copyConfigId')}
                      className="struct-editor__copy"
                    />
                  </button>
                  {showCopyToast && <span className="struct-editor__copy-toast">{t('common.copied')}</span>}
                </div>
              </div>
              <div className="struct-editor__actions">
                <button
                  ref={actionsToggleRef}
                  type="button"
                  className="struct-editor__actions-toggle"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowActionsMenu((prev) => !prev);
                  }}
                >
                  <img src={ICON_MORE} alt={t('common.moreActions')} aria-hidden="true" className="struct-editor__actions-icon" />
                </button>
                {showActionsMenu && (
                  <div
                    ref={actionsMenuRef}
                    className="struct-editor__actions-menu"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        handleCopyStruct();
                        closeActionsMenu();
                      }}
                    >
                      {t('common.copy')}
                    </button>
                    <button
                      type="button"
                      disabled={!clipboard}
                      onClick={() => {
                        handlePasteStruct();
                        closeActionsMenu();
                      }}
                    >
                      {t('common.paste')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleExportVariables();
                        closeActionsMenu();
                      }}
                    >
                      {t('structManager.variables.export')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleImportVariables();
                        closeActionsMenu();
                      }}
                    >
                      {t('structManager.variables.import')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        startMoveStruct(selectedStructEntry.structId);
                        closeActionsMenu();
                      }}
                    >
                      {t('structManager.struct.changeGroup')}
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => {
                        setPendingDeleteStructId(selectedStructEntry.structId);
                        closeActionsMenu();
                      }}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                )}
              </div>
            </header>

            <div className="struct-editor__body">
              {fields.map((entry, index) => (
                <div
                  key={`field-${index}`}
                  className="struct-editor__row"
                  onMouseDown={(event) => event.stopPropagation()}
                  draggable={!isReadOnly}
                  onDragStart={(event) => {
                    if (isReadOnly) return;
                    rowDragIndexRef.current = index;
                    event.dataTransfer?.setData('text/plain', String(index));
                  }}
                  onDragOver={(event) => {
                    if (isReadOnly) return;
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (isReadOnly) return;
                    event.preventDefault();
                    handleFieldDrop(index);
                  }}
                  onDragEnd={() => {
                    if (isReadOnly) return;
                    rowDragIndexRef.current = null;
                  }}
                >
                  <div className="struct-editor__index">
                    <span>{index + 1}</span>
                    <button
                      type="button"
                      className="struct-editor__more"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenRowMenu((prev) => (prev === index ? null : index));
                      }}
                    >
                      <img src={ICON_MORE} alt="" aria-hidden="true" />
                    </button>
                    <div className={classNames('struct-editor__row-menu', { 'is-open': openRowMenu === index })}>
                      <button type="button" onClick={() => handleFieldCopy(entry)}>
                        {t('common.copy')}
                      </button>
                      <button type="button" disabled={!fieldClipboard} onClick={() => handleFieldPaste(index)}>
                        {t('common.paste')}
                      </button>
                      <button type="button" className="is-danger" onClick={() => handleRemoveField(index)}>
                        {t('common.delete')}
                      </button>
                      <button type="button" onClick={() => handleFieldMove(index, -1)}>
                        {t('common.moveUp')}
                      </button>
                      <button type="button" onClick={() => handleFieldMove(index, 1)}>
                        {t('common.moveDown')}
                      </button>
                    </div>
                  </div>
                  <input
                    className="struct-editor__name"
                    value={entry.key}
                    onChange={(event) =>
                      handleFieldChange(index, (prev) => ({ ...prev, key: event.target.value }))
                    }
                    onBlur={(event) =>
                      handleFieldChange(index, (prev) => ({ ...prev, key: event.target.value }))
                    }
                  />
                  <select
                    className="struct-editor__type"
                    value={entry.param_type}
                    onChange={(event) =>
                      handleFieldChange(index, (prev) => ({
                        ...prev,
                        param_type: event.target.value as StructParamType,
                        value: defaultValueForType(event.target.value as StructParamType),
                      }))
                    }
                  >
                    {STRUCT_PARAM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                  <div className="struct-editor__value">{renderValueInput(entry, index)}</div>
                </div>
              ))}
              <div className="struct-editor__add-row">
                <button type="button" onClick={handleAddField}>
                  {t('structManager.field.add')}
                </button>
              </div>
            </div>
          </fieldset>
        ) : (
          <div className="struct-editor__empty">{t('structManager.empty')}</div>
        )}
      </div>

      {!isReadOnly && contextMenu && renderContextMenu()}

      {moveTargetStruct && (
        <div
          className="home__confirm-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setMoveTargetStruct(null)}
        >
          <div className="home__confirm" role="document" onClick={(event) => event.stopPropagation()}>
            <h3>{t('structManager.struct.changeGroup')}</h3>
            <div className="struct-move__list">
              {structGroups.map((group) => (
                <label key={group.groupSlug} className="struct-move__option">
                  <input
                    type="radio"
                    name="move-group"
                    value={group.groupSlug}
                    defaultChecked={group.groupSlug === selectedGroup}
                  />
                  <span>
                    {group.groupSlug === DEFAULT_STRUCT_GROUP_SLUG &&
                    group.groupName === DEFAULT_STRUCT_GROUP_NAME
                      ? defaultGroupNameLabel
                      : group.groupName}
                  </span>
                </label>
              ))}
            </div>
            <div className="home__confirm-actions">
              <button
                type="button"
                onClick={() => {
                  const checked = typeof window !== 'undefined'
                    ? window.document.querySelector<HTMLInputElement>('input[name="move-group"]:checked')
                    : null;
                  handleMoveStructConfirm(checked?.value ?? selectedGroup);
                  setMoveTargetStruct(null);
                }}
              >
                {t('common.confirm')}
              </button>
              <button type="button" onClick={() => setMoveTargetStruct(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {selfRefError && (
        <div className="home__confirm-backdrop" role="alertdialog" aria-modal="true">
          <div className="home__confirm" role="document">
            <h3>{t('common.error')}</h3>
            <p>{t('structManager.error.invalidStruct')}</p>
            <div className="home__confirm-actions">
              <button type="button" onClick={() => setSelfRefError(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteStructId && (
        <div className="home__confirm-backdrop" role="dialog" aria-modal="true">
          <div className="home__confirm" role="document">
            <h3>{t('structManager.deleteStruct.title')}</h3>
            <p>{t('structManager.deleteStruct.message')}</p>
            <div className="home__confirm-actions">
              <button
                type="button"
                className="is-danger"
                onClick={() => {
                  handleDeleteStruct(pendingDeleteStructId);
                  setPendingDeleteStructId(null);
                }}
              >
                {t('common.confirm')}
              </button>
              <button type="button" onClick={() => setPendingDeleteStructId(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}


      {infoDialog && (
        <div
          className="home__confirm-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setInfoDialog(null)}
        >
          <div className="home__confirm" role="document" onClick={(event) => event.stopPropagation()}>
            <h3>{infoDialog.title}</h3>
            <p>{infoDialog.message}</p>
            <div className="home__confirm-actions">
              <button type="button" onClick={() => setInfoDialog(null)}>
                {t('common.ok')}
              </button>
            </div>
          </div>
        </div>
      )}

      {validationDialog && (
        <div className="home__confirm-backdrop" role="alertdialog" aria-modal="true">
          <div className="home__confirm" role="document" onClick={(event) => event.stopPropagation()}>
            <h3>{t('structManager.validationDialog.title')}</h3>
            <div className="home__confirm-message">
              <ul>
                {validationDialog.map((error, index) => (
                  <li key={`validation-${index}`}>{error}</li>
                ))}
              </ul>
            </div>
            <div className="home__confirm-actions">
              <button type="button" onClick={() => setValidationDialog(null)}>
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {groupDialog && (
        <div className="home__confirm-backdrop" role="dialog" aria-modal="true">
          <div className="home__confirm" role="document" onClick={(event) => event.stopPropagation()}>
            <h3>
              {groupDialog.mode === 'create'
                ? t('structManager.groupDialog.createTitle')
                : t('structManager.groupDialog.renameTitle')}
            </h3>
            <div className="home__confirm-message">
              <input
                type="text"
                value={groupNameInput}
                onChange={(event) => setGroupNameInput(event.target.value)}
                placeholder={t('structManager.groupDialog.namePlaceholder')}
              />
            </div>
            <div className="home__confirm-actions">
              <button type="button" onClick={handleGroupDialogSubmit}>
                {t('common.confirm')}
              </button>
              <button type="button" onClick={() => setGroupDialog(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StructureManager;
