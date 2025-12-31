import type { NodeDefinition, PortDefinition } from '../types/node';
import type { UiLanguage } from './i18n';

const normalize = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const getNodeDefinitionDisplayNameForLanguage = (
  definition: NodeDefinition,
  language: UiLanguage,
): string | undefined => {
  switch (language) {
    case 'chs':
      return normalize(definition.displayName);
    case 'en-us':
    case 'en-uk':
    case 'tutorial':
      return normalize(definition.displayNameEN);
    case 'cht':
      return normalize(definition.displayNameCHT);
    case 'jpn':
      return normalize(definition.displayNameJPN);
    default:
      return undefined;
  }
};

export const resolveNodeDefinitionDisplayName = (
  definition: NodeDefinition,
  primaryLanguage: UiLanguage,
  secondaryLanguage: UiLanguage,
): string => {
  return (
    getNodeDefinitionDisplayNameForLanguage(definition, primaryLanguage) ??
    getNodeDefinitionDisplayNameForLanguage(definition, secondaryLanguage) ??
    normalize(definition.displayName) ??
    normalize(definition.displayNameEN) ??
    definition.id
  );
};

export const getPortLabelForLanguage = (
  port: PortDefinition,
  language: UiLanguage,
): string | undefined => {
  switch (language) {
    case 'chs':
      return normalize(port.label);
    case 'en-us':
    case 'en-uk':
    case 'tutorial':
      return normalize(port.labelEN);
    case 'cht':
      return normalize(port.labelCHT);
    case 'jpn':
      return normalize(port.labelJPN);
    default:
      return undefined;
  }
};

export const resolvePortLabel = (
  port: PortDefinition,
  primaryLanguage: UiLanguage,
  secondaryLanguage: UiLanguage,
): string => {
  return (
    getPortLabelForLanguage(port, primaryLanguage) ??
    getPortLabelForLanguage(port, secondaryLanguage) ??
    normalize(port.label) ??
    port.id
  );
};

export const getPortPlaceholderForLanguage = (
  port: PortDefinition,
  language: UiLanguage,
): string | undefined => {
  switch (language) {
    case 'chs':
      return normalize(port.ui?.placeholder);
    case 'en-us':
    case 'en-uk':
    case 'tutorial':
      return normalize(port.ui?.placeholderEN);
    case 'cht':
      return normalize(port.ui?.placeholderCHT);
    case 'jpn':
      return normalize(port.ui?.placeholderJPN);
    default:
      return undefined;
  }
};

export const resolvePortPlaceholder = (
  port: PortDefinition,
  primaryLanguage: UiLanguage,
  secondaryLanguage: UiLanguage,
): string | undefined =>
  getPortPlaceholderForLanguage(port, primaryLanguage) ??
  getPortPlaceholderForLanguage(port, secondaryLanguage) ??
  normalize(port.ui?.placeholder);
