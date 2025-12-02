import { useMemo, useState } from 'react';
import classNames from 'classnames';
import type { EditorSettings, EditorSelectionActivation } from '../utils/storage';
import './SettingsPage.css';

interface SettingsPageProps {
  iconBack: string;
  settings: EditorSettings;
  onUpdateSettings: (updater: (prev: EditorSettings) => EditorSettings) => void;
  onClose: () => void;
  returnTarget: 'home' | 'editor';
  isTouchEnvironment?: boolean;
}

const SETTINGS_GROUP_KEYS = {
  editorControls: 'editorControls',
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
  const [activeTab, setActiveTab] = useState<'general' | 'export'>('general');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

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
      touch: '选框触碰到节点即可选中（绿色选框）。',
      box: '节点需要完全包含在选框内才能选中（蓝色选框）。',
      leftTouchRightBox: '向左拖动使用触碰选择，向右拖动使用框选。',
      leftBoxRightTouch: '向左拖动使用框选，向右拖动使用触碰。',
    };

    const selectionActivationNotes: Record<EditorSelectionActivation, string> = {
      drag: '需要按住左键拖动创建选框。',
      click: '第一次点击确定起点，第二次点击确定终点。',
      both: '同时启用拖拽与点击选区。',
    };

    return (
      <div className="settings-panel">
        <div className="settings-group">
          <button
            type="button"
            className="settings-group__header"
            onClick={() => toggleGroup(SETTINGS_GROUP_KEYS.editorControls)}
          >
            <span>节点图编辑器控制</span>
            <span className={classNames('settings-group__caret', {
              'is-collapsed': collapsedGroups[SETTINGS_GROUP_KEYS.editorControls],
            })}
            />
          </button>
          {!collapsedGroups[SETTINGS_GROUP_KEYS.editorControls] && (
            <div className="settings-group__body">
              <p className="settings-group__tip">* 标记的设置对触摸模式无效。</p>
              {isTouchEnvironment && (
                <p className="settings-group__note">当前检测为触摸环境，部分设置将保持默认行为。</p>
              )}
              <div className="settings-option">
                <div className="settings-option__label">*平移画布</div>
                {renderChoiceButtons(
                  [
                    { value: 'right' as const, label: '右键' },
                    { value: 'middle' as const, label: '中键' },
                  ],
                  settings.panButton,
                  (value) => handleOptionChange('panButton', value),
                )}
                <p className="settings-option__hint">选择平移画布时使用的鼠标按键。</p>
              </div>
              <div className="settings-option">
                <div className="settings-option__label">*画布缩放</div>
                {renderChoiceButtons(
                  [
                    { value: 'wheel' as const, label: '鼠标滚轮' },
                    { value: 'keys' as const, label: 'Ctrl +/-' },
                    { value: 'both' as const, label: '同时启用' },
                  ],
                  settings.zoomControl,
                  (value) => handleOptionChange('zoomControl', value),
                )}
                <p className="settings-option__hint">选择缩放时使用的方式。</p>
              </div>
              <div className="settings-option">
                <div className="settings-option__label">*框选控制</div>
                <div className="settings-choice-column">
                  {renderChoiceButtons(
                    [
                      { value: 'drag' as const, label: '仅左键拖拽' },
                      { value: 'click' as const, label: '仅左键点击' },
                      { value: 'both' as const, label: '同时启用' },
                    ],
                    settings.selectionActivation,
                    (value) => handleOptionChange('selectionActivation', value),
                  )}
                  <p className="settings-option__hint">{selectionActivationNotes[settings.selectionActivation]}</p>
                </div>
              </div>
              <div className="settings-option">
                <div className="settings-option__label">*多选模式</div>
                {renderChoiceButtons(
                  [
                    { value: 'touch' as const, label: '接触选择' },
                    { value: 'box' as const, label: '框选选择' },
                    { value: 'leftTouchRightBox' as const, label: '向左接触/向右框选' },
                    { value: 'leftBoxRightTouch' as const, label: '向左框选/向右接触' },
                  ],
                  settings.multiSelectBehavior,
                  (value) => handleOptionChange('multiSelectBehavior', value),
                )}
                <p className="settings-option__hint">{multiSelectDescriptions[settings.multiSelectBehavior]}</p>
              </div>
              <div className="settings-option">
                <div className="settings-option__label">插入节点时是否立刻进入输入模式</div>
                {renderChoiceButtons(
                  [
                    { value: true as const, label: '是' },
                    { value: false as const, label: '否' },
                  ],
                  settings.enterInputOnNodeInsert,
                  (value) => handleOptionChange('enterInputOnNodeInsert', value),
                )}
                <p className="settings-option__hint">在创建节点后立即聚焦节点名称输入框。</p>
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
          <span>GIL导出设置</span>
          <span
            className={classNames('settings-group__caret', {
              'is-collapsed': collapsedGroups[SETTINGS_GROUP_KEYS.gilExport],
            })}
          />
        </button>
        {!collapsedGroups[SETTINGS_GROUP_KEYS.gilExport] && (
          <div className="settings-group__body">
            <div className="settings-option">
              <div className="settings-option__label">实验：开启GIL导出功能</div>
              {renderChoiceButtons(
                [
                  { value: true as const, label: '是' },
                  { value: false as const, label: '否' },
                ],
                settings.enableGilExport,
                (value) => handleOptionChange('enableGilExport', value),
              )}
              <p className="settings-option__hint">启用后可在菜单中导出为 .gil 存档。</p>
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
          <span>GIA导出设置</span>
          <span
            className={classNames('settings-group__caret', {
              'is-collapsed': collapsedGroups[SETTINGS_GROUP_KEYS.giaExport],
            })}
          />
        </button>
        {!collapsedGroups[SETTINGS_GROUP_KEYS.giaExport] && (
          <div className="settings-group__body">
            <div className="settings-option">
              <div className="settings-option__label">实验：开启GIA导出功能</div>
              {renderChoiceButtons(
                [
                  { value: true as const, label: '是' },
                  { value: false as const, label: '否' },
                ],
                settings.enableGiaExport,
                (value) => handleOptionChange('enableGiaExport', value),
              )}
              <p className="settings-option__hint">启用后可在操作栏导出为 .gia 文件（实验）。</p>
            </div>
            <div className="settings-option">
              <div className="settings-option__label">设定UID</div>
              {renderChoiceButtons(
                [
                  { value: 'perExport' as const, label: '导出时随机生成' },
                  { value: 'perSession' as const, label: '每次进入网页时随机生成' },
                  { value: 'fixed' as const, label: '固定UID' },
                ],
                settings.giaUidMode,
                (value) => handleOptionChange('giaUidMode', value),
              )}
              {settings.giaUidMode === 'fixed' && (
                <div className="settings-fixed-uid">
                  <input
                    value={settings.giaFixedUid}
                    onChange={(event) => handleFixedUidChange(event.target.value)}
                    placeholder="请输入9-10位数字"
                    className={classNames({ 'is-invalid': !isFixedUidValid && settings.giaFixedUid.length > 0 })}
                    inputMode="numeric"
                  />
                  <p className="settings-option__hint">
                    UID 需要为 9~10 位数字，输入非法字符会被自动移除。
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const returnLabel = returnTarget === 'editor' ? '返回节点图编辑器' : '返回主页';

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <div>
          <h1>设置</h1>
          <p className="settings-page__subtitle">所有设置数据仅保存在本地浏览器</p>
        </div>
        <button type="button" className="settings-page__back" onClick={onClose}>
          <img src={iconBack} alt="" aria-hidden="true" />
          {returnLabel}
        </button>
      </header>
      <div className="settings-page__layout">
        <aside className="settings-page__tabs">
          <button
            type="button"
            className={classNames('settings-tab', { 'is-active': activeTab === 'general' })}
            onClick={() => setActiveTab('general')}
          >
            通用设置
          </button>
          <button
            type="button"
            className={classNames('settings-tab', { 'is-active': activeTab === 'export' })}
            onClick={() => setActiveTab('export')}
          >
            导出设置
          </button>
        </aside>
        <section className="settings-page__content">
          {activeTab === 'general' ? renderGeneralTab() : renderExportTab()}
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
