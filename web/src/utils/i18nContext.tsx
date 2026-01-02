import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { TextKey, UiLanguage } from './i18n';
import { t as translateText } from './i18n';

export type I18nTranslate = (key: TextKey, params?: Record<string, string | number>) => string;

interface I18nContextValue {
  primaryLanguage: UiLanguage;
  secondaryLanguage: UiLanguage;
  t: I18nTranslate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider = ({
  primaryLanguage,
  secondaryLanguage,
  children,
}: {
  primaryLanguage: UiLanguage;
  secondaryLanguage: UiLanguage;
  children: ReactNode;
}) => {
  const value = useMemo<I18nContextValue>(() => {
    const t: I18nTranslate = (key, params) =>
      translateText(key, primaryLanguage, secondaryLanguage, params);
    return { primaryLanguage, secondaryLanguage, t };
  }, [primaryLanguage, secondaryLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return value;
};

