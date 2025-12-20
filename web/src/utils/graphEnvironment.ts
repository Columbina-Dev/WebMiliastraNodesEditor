import type {
  ClientGraphEnvironment,
  ClientGraphType,
  GraphEnvironment,
} from '../types/node';
import type { ProjectGraphLocation, ProjectTopFolder } from '../types/project';

export const CLIENT_CATEGORY_BY_KIND: Record<ClientGraphType, string> = {
  'role-skill': 'role-skill',
  'creation-skill': 'creation-skill',
  'creation-state': 'creation-state',
  'creation-state-decision': 'creation-state-decision',
  boolean: 'boolean-filter',
  integer: 'integer-filter',
};

export const GRAPH_ENVIRONMENT_VALUES = [
  'server',
  'client',
  'client:role-skill',
  'client:creation-skill',
  'client:creation-state',
  'client:creation-state-decision',
  'client:boolean',
  'client:integer',
] as const;

export type GraphEnvironmentValue = (typeof GRAPH_ENVIRONMENT_VALUES)[number];

export const isGraphEnvironmentValue = (value: unknown): value is GraphEnvironment =>
  typeof value === 'string' &&
  (GRAPH_ENVIRONMENT_VALUES as readonly string[]).includes(value as GraphEnvironmentValue);

const CLIENT_KIND_BY_CATEGORY_KEY: Record<string, ClientGraphType> = Object.entries(
  CLIENT_CATEGORY_BY_KIND,
).reduce<Record<string, ClientGraphType>>((acc, [kind, key]) => {
  acc[key] = kind as ClientGraphType;
  return acc;
}, {});

export const toClientEnvironment = (kind: ClientGraphType): ClientGraphEnvironment =>
  `client:${kind}` as const;

export const isClientEnvironment = (
  environment?: GraphEnvironment | null,
): environment is ClientGraphEnvironment =>
  environment === 'client' ||
  (typeof environment === 'string' && environment.startsWith('client:'));

export const clientKindFromEnvironment = (
  environment?: GraphEnvironment | null,
): ClientGraphType | null => {
  if (!environment) return null;
  if (environment === 'client') {
    return 'role-skill';
  }
  if (environment.startsWith('client:')) {
    const [, rawKind] = environment.split(':', 2);
    if (
      rawKind === 'role-skill' ||
      rawKind === 'creation-skill' ||
      rawKind === 'creation-state' ||
      rawKind === 'creation-state-decision' ||
      rawKind === 'boolean' ||
      rawKind === 'integer'
    ) {
      return rawKind;
    }
  }
  return null;
};

export const clientKindFromCategoryKey = (categoryKey: string): ClientGraphType | null =>
  CLIENT_KIND_BY_CATEGORY_KEY[categoryKey] ?? null;

export const normalizeGraphEnvironment = (
  environment: GraphEnvironment | undefined,
  options: { fallbackClientKind?: ClientGraphType } = {},
): GraphEnvironment => {
  if (environment === 'server') {
    return 'server';
  }
  const fallbackKind = options.fallbackClientKind ?? 'role-skill';
  const inferredKind = clientKindFromEnvironment(environment);
  if (inferredKind) {
    return toClientEnvironment(inferredKind);
  }
  if (environment === 'client') {
    return toClientEnvironment(fallbackKind);
  }
  return 'server';
};

export const getEnvironmentTopFolder = (environment: GraphEnvironment): ProjectTopFolder =>
  environment === 'server' ? 'server' : 'client';

export const resolveEnvironmentFromLocation = (
  location: ProjectGraphLocation,
): GraphEnvironment => {
  if (location.topFolder === 'server') {
    return 'server';
  }
  const kind = CLIENT_KIND_BY_CATEGORY_KEY[location.categoryKey] ?? 'role-skill';
  return toClientEnvironment(kind);
};

export const categoryKeyFromEnvironment = (environment: GraphEnvironment): string | null => {
  const kind = clientKindFromEnvironment(environment);
  return kind ? CLIENT_CATEGORY_BY_KIND[kind] : null;
};

export const getDefaultExecutionInterval = (
  environment: GraphEnvironment,
): number | undefined => {
  const kind = clientKindFromEnvironment(environment);
  if (!kind) return undefined;
  if (kind === 'boolean' || kind === 'integer') {
    return 0.3;
  }
  return undefined;
};

export const sanitizeExecutionInterval = (
  candidate: unknown,
  fallback: number,
): number => {
  const parsed = typeof candidate === 'number' ? candidate : Number(candidate);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return fallback;
};
