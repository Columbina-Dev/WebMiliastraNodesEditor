import { useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import type { EditorSettings } from '../utils/storage';
// import type { EditorSettings, EditorSelectionActivation } from '../utils/storage';
import { UI_LANGUAGE_OPTIONS, getDefaultSecondaryLanguage, type UiLanguage } from '../utils/i18n';
import { useI18n } from '../utils/i18nContext';
import { getAvatarDataUrl, sanitizeNickname } from '../utils/collaborationProfile';
import Avatar from './Avatar';
import './SettingsPage.css';
const ICON_INFO = new URL('../assets/icons/info.png', import.meta.url).href;

interface SettingsPageProps {
  iconBack: string;
  settings: EditorSettings;
  onUpdateSettings: (updater: (prev: EditorSettings) => EditorSettings) => void;
  onClose: () => void;
  returnTarget: 'home' | 'editor';
  isTouchEnvironment?: boolean;
}

const SETTINGS_GROUP_KEYS = {
  global: 'global',
  editorControls: 'editorControls',
  collaboration: 'collaboration',
  gilExport: 'gilExport',
  giaExport: 'giaExport',
} as const;

const SettingsPage = ({
  iconBack,
  settings,
  onUpdateSettings,
  onClose,
  returnTarget,
  isTouchEnvironment = false,
}: SettingsPageProps) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'general' | 'collaboration' | 'export'>('general');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isAvatarBusy, setIsAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const isFixedUidValid = useMemo(() => /^\d{9,10}$/.test(settings.giaFixedUid), [settings.giaFixedUid]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOptionChange = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
    onUpdateSettings((prev) => {
      if (prev[key] === value) {
        return prev;
      }
      return { ...prev, [key]: value };
    });
  };

  const handleFixedUidChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 10);
    onUpdateSettings((prev) => (prev.giaFixedUid === cleaned ? prev : { ...prev, giaFixedUid: cleaned }));
  };

  const handleCollabNicknameChange = (value: string) => {
    const cleaned = sanitizeNickname(value);
    onUpdateSettings((prev) => {
      if (prev.collabDefaultNickname === cleaned) {
        return prev;
      }
      return { ...prev, collabDefaultNickname: cleaned };
    });
  };

  const handleCollabAvatarClear = () => {
    onUpdateSettings((prev) => {
      if (!prev.collabAvatar) return prev;
      return { ...prev, collabAvatar: '' };
    });
  };

  const handleCollabAvatarChange = async (file: File) => {
    setAvatarError(null);
    setIsAvatarBusy(true);
    try {
      const dataUrl = await getAvatarDataUrl(file);
      onUpdateSettings((prev) => ({ ...prev, collabAvatar: dataUrl }));
    } catch (error) {
      console.error(error);
      setAvatarError(t('settings.collab.avatar.error'));
    } finally {
      setIsAvatarBusy(false);
    }
  };

  const handlePrimaryLanguageChange = (value: UiLanguage) => {
    onUpdateSettings((prev) => {
      const nextPrimary = value;
      const nextSecondary =
        prev.uiSecondaryLanguage === nextPrimary
          ? getDefaultSecondaryLanguage(nextPrimary)
          : prev.uiSecondaryLanguage;
      if (prev.uiPrimaryLanguage === nextPrimary && prev.uiSecondaryLanguage === nextSecondary) {
        return prev;
      }
      return { ...prev, uiPrimaryLanguage: nextPrimary, uiSecondaryLanguage: nextSecondary };
    });
  };

  const handleSecondaryLanguageChange = (value: UiLanguage) => {
    onUpdateSettings((prev) => {
      const nextSecondary = value === prev.uiPrimaryLanguage
        ? getDefaultSecondaryLanguage(prev.uiPrimaryLanguage)
        : value;
      if (prev.uiSecondaryLanguage === nextSecondary) {
        return prev;
      }
      return { ...prev, uiSecondaryLanguage: nextSecondary };
    });
  };

  const renderChoiceButtons = <T extends string | number | boolean>(
    options: Array<{ value: T; label: string; hint?: string }>,
    current: T,
    onSelect: (value: T) => void,
  ) => (
    <div className="settings-choice-row">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={classNames('settings-choice', { 'is-active': current === option.value })}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const renderGeneralTab = () => {
    const multiSelectDescriptions: Record<EditorSettings['multiSelectBehavior'], string> = {
      touch: t('settings.editorControls.multiSelect.touch.desc'),
      box: t('settings.editorControls.multiSelect.box.desc'),
      leftTouchRightBox: t('settings.editorControls.multiSelect.leftTouchRightBox.desc'),
      leftBoxRightTouch: t('settings.editorControls.multiSelect.leftBoxRightTouch.desc'),
    };

    // const selectionActivationNotes: Record<EditorSelectionActivation, string> = {
    //   drag: '需要按住左键拖动创建选框。',
    //   click: '第一次点击确定起点，第二次点击确定终点。',
    // };

    return (
      <div className="settings-panel">
        <div className="settings-group">
          <button
            type="button"
            className="settings-group__header"
            onClick={() => toggleGroup(SETTINGS_GROUP_KEYS.global)}
          >
            <span>{t('settings.group.global')}</span>
            <span
              className={classNames('settings-group__caret', {
                'is-collapsed': collapsedGroups[SETTINGS_GROUP_KEYS.global],
              })}
            />
          </button>
          {!collapsedGroups[SETTINGS_GROUP_KEYS.global] && (
            <div className="settings-group__body">
              <div className="settings-option">
                <div className="settings-option__label">{t('settings.global.primaryLanguage.label')}</div>
                <select
                  className="settings-select"
                  value={settings.uiPrimaryLanguage}
                  onChange={(event) => handlePrimaryLanguageChange(event.target.value as UiLanguage)}
                >
                  {UI_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
                <p className="settings-option__hint">{t('settings.global.primaryLanguage.hint')}</p>
              </div>
              <div className="settings-option">
                <div className="settings-option__label">{t('settings.global.secondaryLanguage.label')}</div>
                <select
                  className="settings-select"
                  value={settings.uiSecondaryLanguage}
                  onChange={(event) => handleSecondaryLanguageChange(event.target.value as UiLanguage)}
                >
                  {UI_LANGUAGE_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={option.value === settings.uiPrimaryLanguage}
                    >
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
                <p className="settings-option__hint">{t('settings.global.secondaryLanguage.hint')}</p>
              </div>
              <div className="settings-option">
                <div className="settings-option__label">{t('settings.global.pointerStyle.label')}</div>
                {renderChoiceButtons(
                  [
                    { value: 'sandbox' as const, label: t('settings.global.pointerStyle.sandbox') },
                    { value: 'system' as const, label: t('settings.global.pointerStyle.system') },
                  ],
                  settings.pointerStyle,
                  (value) => handleOptionChange('pointerStyle', value),
                )}
                <p className="settings-option__hint">{t('settings.global.pointerStyle.hint')}</p>
              </div>
            </div>
          )}
        </div>
        <div className="settings-group">
          <button
            type="button"
            className="settings-group__header"
            onClick={() => toggleGroup(SETTINGS_GROUP_KEYS.editorControls)}
          >
            <span>{t('settings.group.editorControls')}</span>
            <span className={classNames('settings-group__caret', {
              'is-collapsed': collapsedGroups[SETTINGS_GROUP_KEYS.editorControls],
            })}
            />
          </button>
          {!collapsedGroups[SETTINGS_GROUP_KEYS.editorControls] && (
            <div className="settings-group__body">
              <p className="settings-group__tip">{t('settings.editorControls.tip')}</p>
              {isTouchEnvironment && (
                <p className="settings-group__note">{t('settings.editorControls.touchNote')}</p>
              )}
              <div className="settings-option">
                <div className="settings-option__label">{t('settings.editorControls.panButton.label')}</div>
                {renderChoiceButtons(
                  [
                    { value: 'right' as const, label: t('settings.editorControls.panButton.right') },
                    { value: 'middle' as const, label: t('settings.editorControls.panButton.middle') },
                  ],
                  settings.panButton,
                  (value) => handleOptionChange('panButton', value),
                )}
                <p className="settings-option__hint">{t('settings.editorControls.panButton.hint')}</p>
              </div>
              <div className="settings-option">
                <div className="settings-option__label">{t('settings.editorControls.zoomControl.label')}</div>
                {renderChoiceButtons(
                  [
                    { value: 'wheel' as const, label: t('settings.editorControls.zoomControl.wheel') },
                    { value: 'keys' as const, label: t('settings.editorControls.zoomControl.keys') },
                    { value: 'both' as const, label: t('settings.editorControls.zoomControl.both') },
                  ],
                  settings.zoomControl,
                  (value) => handleOptionChange('zoomControl', value),
                )}
                <p className="settings-option__hint">{t('settings.editorControls.zoomControl.hint')}</p>
              </div>
              {/* 由于bug较难修复，暂时移除此设置的UI。默认为`左键拖拽` */}
              {/* <div className="settings-option">
                <div className="settings-option__label">*框选控制</div>
                {renderChoiceButtons(
                  [
                    { value: 'drag' as const, label: '左键拖拽' },
                    { value: 'click' as const, label: '左键点击' },
                  ],
                  settings.selectionActivation,
                  (value) => handleOptionChange('selectionActivation', value),
                )}
                <p className="settings-option__hint">{selectionActivationNotes[settings.selectionActivation]}</p>
              </div> */}
              <div className="settings-option">
                <div className="settings-option__label">{t('settings.editorControls.multiSelect.label')}</div>
                {renderChoiceButtons(
                  [
                    { value: 'touch' as const, label: t('settings.editorControls.multiSelect.touch') },
                    { value: 'box' as const, label: t('settings.editorControls.multiSelect.box') },
                    { value: 'leftTouchRightBox' as const, label: t('settings.editorControls.multiSelect.leftTouchRightBox') },
                    { value: 'leftBoxRightTouch' as const, label: t('settings.editorControls.multiSelect.leftBoxRightTouch') },
                  ],
                  settings.multiSelectBehavior,
                  (value) => handleOptionChange('multiSelectBehavior', value),
                )}
                <p className="settings-option__hint">{multiSelectDescriptions[settings.multiSelectBehavior]}</p>
              </div>
              <div className="settings-option">
                <div className="settings-option__label">{t('settings.editorControls.enterInputOnNodeInsert.label')}</div>
                {renderChoiceButtons(
                  [
                    { value: true as const, label: t('common.yes') },
                    { value: false as const, label: t('common.no') },
                  ],
                  settings.enterInputOnNodeInsert,
                  (value) => handleOptionChange('enterInputOnNodeInsert', value),
                )}
                <p className="settings-option__hint">{t('settings.editorControls.enterInputOnNodeInsert.hint')}</p>
              </div>
              <div className="settings-option">
                <div className="settings-option__label">{t('settings.editorControls.searchAllLanguages.label')}</div>
                {renderChoiceButtons(
                  [
                    { value: true as const, label: t('common.yes') },
                    { value: false as const, label: t('common.no') },
                  ],
                  settings.allowSearchAllLanguageNodeNames,
                  (value) => handleOptionChange('allowSearchAllLanguageNodeNames', value),
                )}
                <p className="settings-option__hint">{t('settings.editorControls.searchAllLanguages.hint')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderExportTab = () => (
    <div className="settings-panel">
      <div className="settings-group">
        <button
          type="button"
          className="settings-group__header"
          onClick={() => toggleGroup(SETTINGS_GROUP_KEYS.gilExport)}
        >
          <span>{t('settings.group.gilExport')}</span>
          <span
            className={classNames('settings-group__caret', {
              'is-collapsed': collapsedGroups[SETTINGS_GROUP_KEYS.gilExport],
            })}
          />
        </button>
        {!collapsedGroups[SETTINGS_GROUP_KEYS.gilExport] && (
          <div className="settings-group__body">
            <div className="settings-option">
              <div className="settings-option__label">{t('settings.gilExport.enable.label')}</div>
              {renderChoiceButtons(
                [
                  { value: true as const, label: t('common.yes') },
                  { value: false as const, label: t('common.no') },
                ],
                settings.enableGilExport,
                (value) => handleOptionChange('enableGilExport', value),
              )}
              <p className="settings-option__hint">{t('settings.gilExport.enable.hint')}</p>
            </div>
          </div>
        )}
      </div>
      <div className="settings-group">
        <button
          type="button"
          className="settings-group__header"
          onClick={() => toggleGroup(SETTINGS_GROUP_KEYS.giaExport)}
        >
          <span>{t('settings.group.giaExport')}</span>
          <span
            className={classNames('settings-group__caret', {
              'is-collapsed': collapsedGroups[SETTINGS_GROUP_KEYS.giaExport],
            })}
          />
        </button>
        {!collapsedGroups[SETTINGS_GROUP_KEYS.giaExport] && (
          <div className="settings-group__body">
            <div className="settings-option">
              <div className="settings-option__label">{t('settings.giaExport.enable.label')}</div>
              {renderChoiceButtons(
                [
                  { value: true as const, label: t('common.yes') },
                  { value: false as const, label: t('common.no') },
                ],
                settings.enableGiaExport,
                (value) => handleOptionChange('enableGiaExport', value),
              )}
              <p className="settings-option__hint">{t('settings.giaExport.enable.hint')}</p>
            </div>
            <div className="settings-option">
              <div className="settings-option__label">{t('settings.giaExport.uidMode.label')}</div>
              {renderChoiceButtons(
                [
                  { value: 'perExport' as const, label: t('settings.giaExport.uidMode.perExport') },
                  { value: 'perSession' as const, label: t('settings.giaExport.uidMode.perSession') },
                  { value: 'fixed' as const, label: t('settings.giaExport.uidMode.fixed') },
                ],
                settings.giaUidMode,
                (value) => handleOptionChange('giaUidMode', value),
              )}
              {settings.giaUidMode === 'fixed' && (
                <div className="settings-fixed-uid">
                  <input
                    value={settings.giaFixedUid}
                    onChange={(event) => handleFixedUidChange(event.target.value)}
                    placeholder={t('settings.giaExport.fixedUid.placeholder')}
                    className={classNames({ 'is-invalid': !isFixedUidValid && settings.giaFixedUid.length > 0 })}
                    inputMode="numeric"
                  />
                  <p className="settings-option__hint">
                    {t('settings.giaExport.fixedUid.hint')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderCollaborationTab = () => {
    const displayNickname = settings.collabDefaultNickname || t('settings.collab.nickname.fallback');
    return (
      <div className="settings-panel">
        <div className="settings-group">
          <button
            type="button"
            className="settings-group__header"
            onClick={() => toggleGroup(SETTINGS_GROUP_KEYS.collaboration)}
          >
            <span>{t('settings.group.collaboration')}</span>
            <span
              className={classNames('settings-group__caret', {
                'is-collapsed': collapsedGroups[SETTINGS_GROUP_KEYS.collaboration],
              })}
            />
          </button>
          {!collapsedGroups[SETTINGS_GROUP_KEYS.collaboration] && (
            <div className="settings-group__body">
              <div className="settings-option">
                <div className="settings-option__label">{t('settings.collab.nickname.label')}</div>
                <input
                  className="settings-text-input"
                  value={settings.collabDefaultNickname}
                  onChange={(event) => handleCollabNicknameChange(event.target.value)}
                  placeholder={t('settings.collab.nickname.placeholder')}
                  maxLength={12}
                  autoComplete="off"
                />
                <p className="settings-option__hint">{t('settings.collab.nickname.hint')}</p>
              </div>
              <div className="settings-option">
                <div className="settings-option__label">{t('settings.collab.avatar.label')}</div>
                <div className="settings-collab-avatar">
                  <Avatar
                    src={settings.collabAvatar || undefined}
                    label={displayNickname}
                    size={64}
                  />
                  <div className="settings-collab-avatar__actions">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isAvatarBusy}
                    >
                      {isAvatarBusy
                        ? t('settings.collab.avatar.processing')
                        : t('settings.collab.avatar.upload')}
                    </button>
                    {settings.collabAvatar && (
                      <button type="button" onClick={handleCollabAvatarClear}>
                        {t('settings.collab.avatar.clear')}
                      </button>
                    )}
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = '';
                      if (!file) return;
                      void handleCollabAvatarChange(file);
                    }}
                  />
                </div>
                <p className="settings-option__hint">{t('settings.collab.avatar.hint')}</p>
                {avatarError && <div className="settings-option__error">{avatarError}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const returnLabel = t('common.back');
  const returnAriaLabel =
    returnTarget === 'editor' ? t('settings.backToEditor') : t('settings.backToHome');

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <div>
          <h1>{t('settings.title')}</h1>
          <p className="settings-page__subtitle">{t('settings.subtitle')}</p>
        </div>
        <button type="button" className="settings-page__back" onClick={onClose} aria-label={returnAriaLabel}>
          <img src={iconBack} alt="" aria-hidden="true" />
          {returnLabel}
        </button>
      </header>
      <div className="settings-page__layout">
        <aside className="settings-page__tabs">
          <div className="settings-page__tabs-list">
            <button
              type="button"
              className={classNames('settings-tab', { 'is-active': activeTab === 'general' })}
              onClick={() => setActiveTab('general')}
            >
              {t('settings.tabs.general')}
            </button>
            <button
              type="button"
              className={classNames('settings-tab', { 'is-active': activeTab === 'collaboration' })}
              onClick={() => setActiveTab('collaboration')}
            >
              {t('settings.tabs.collaboration')}
            </button>
            <button
              type="button"
              className={classNames('settings-tab', { 'is-active': activeTab === 'export' })}
              onClick={() => setActiveTab('export')}
            >
              {t('settings.tabs.export')}
            </button>
          </div>
          <button
            type="button"
            className="settings-tab settings-tab--about"
            onClick={() => setIsAboutOpen(true)}
          >
            <img src={ICON_INFO} alt="" aria-hidden="true" />
            {t('settings.about.title')}
          </button>
        </aside>
        <section className="settings-page__content">
          {activeTab === 'general'
            ? renderGeneralTab()
            : activeTab === 'collaboration'
              ? renderCollaborationTab()
              : renderExportTab()}
        </section>
      </div>
      {isAboutOpen && (
        <div className="settings-about-overlay">
          <div className="settings-about-modal" role="dialog" aria-modal="true">
            <div className="settings-about-header">
              <h2>{t('settings.about.title')}</h2>
              <button type="button" onClick={() => setIsAboutOpen(false)}>
                {t('common.close')}
              </button>
            </div>
            <div className="settings-about-body">
              <p>
                {t('settings.about.disclaimer.p1.prefix')}
                <a
                  href="https://genshin.hoyoverse.com/company/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('settings.about.disclaimer.p1.link')}
                </a>
                {t('settings.about.disclaimer.p1.suffix')}
              </p>
              <p>
                {t('settings.about.disclaimer.p2')}
              </p>
              <br></br>
              <p>
                {t('settings.about.project.p1.prefix')}
                <strong>{t('settings.about.project.p1.license')}</strong>
                {t('settings.about.project.p1.middle')}
                <a
                  href="https://github.com/Columbina-Dev/WebMiliastraNodesEditor"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('settings.about.project.p1.link')}
                </a>
              </p>
              <p>
                {t('settings.about.project.p2.text')}
              </p>
              <br></br>
              <p>
                {t('settings.about.credits.title')}
              </p>
              <p>
                <a href="https://github.com/hackermdch" target="_blank" rel="noopener noreferrer">
                  {t('settings.about.credits.hackermdch.name')}
                </a>
                {t('settings.about.credits.hackermdch.desc')}
              </p>
              <p>
                <a href="https://github.com/SpeedyOrc-C" target="_blank" rel="noopener noreferrer">
                  {t('settings.about.credits.SpeedyOrc-C.name')}
                </a>
                {t('settings.about.credits.SpeedyOrc-C.desc')}
              </p>
              <p>
                <a href="https://github.com/Wu-Yijun" target="_blank" rel="noopener noreferrer">
                  {t('settings.about.credits.wuYijun.name')}
                </a>
                {t('settings.about.credits.wuYijun.desc')}
              </p>
              <br></br><br></br>
              <p>
                {t('settings.about.license.appName')}
              </p>
              <p>
                {t('settings.about.license.copyright')}
              </p>
              <p>
                {t('settings.about.license.p1')}
              </p>
              <p>
                {t('settings.about.license.p2')}
              </p>
              <p>
                {t('settings.about.license.p3.prefix')}
                <a href="https://www.gnu.org/licenses/" target="_blank" rel="noopener noreferrer">
                  {t('settings.about.license.p3.link')}
                </a>
                {t('settings.about.license.p3.suffix')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
