import { useMemo, useState } from 'react';
import classNames from 'classnames';
import type { EditorSettings, EditorSelectionActivation } from '../utils/storage';
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
  const [isAboutOpen, setIsAboutOpen] = useState(false);

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
    };

    return (
      <div className="settings-panel">
        <div className="settings-group">
          <button
            type="button"
            className="settings-group__header"
            onClick={() => toggleGroup(SETTINGS_GROUP_KEYS.global)}
          >
            <span>全局设置</span>
            <span
              className={classNames('settings-group__caret', {
                'is-collapsed': collapsedGroups[SETTINGS_GROUP_KEYS.global],
              })}
            />
          </button>
          {!collapsedGroups[SETTINGS_GROUP_KEYS.global] && (
            <div className="settings-group__body">
              <div className="settings-option">
                <div className="settings-option__label">指针样式</div>
                {renderChoiceButtons(
                  [
                    { value: 'sandbox' as const, label: '千星沙箱' },
                    { value: 'system' as const, label: '系统' },
                  ],
                  settings.pointerStyle,
                  (value) => handleOptionChange('pointerStyle', value),
                )}
                <p className="settings-option__hint">切换网站使用的鼠标样式</p>
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
            <span>节点图编辑器控制</span>
            <span className={classNames('settings-group__caret', {
              'is-collapsed': collapsedGroups[SETTINGS_GROUP_KEYS.editorControls],
            })}
            />
          </button>
          {!collapsedGroups[SETTINGS_GROUP_KEYS.editorControls] && (
            <div className="settings-group__body">
              <p className="settings-group__tip">* 标记的设置对触摸模式无效</p>
              {isTouchEnvironment && (
                <p className="settings-group__note">当前检测为触摸环境，部分设置将不会生效</p>
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
                <p className="settings-option__hint">选择平移画布时使用的鼠标按键</p>
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
                <p className="settings-option__hint">选择缩放时使用的方式</p>
              </div>
              <div className="settings-option">
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
                <p className="settings-option__hint">在创建节点后立即聚焦节点库的搜索输入框（移动端推荐否）</p>
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
              <p className="settings-option__hint">启用后可在顶部文件菜单中选择"导出为.gil存档"</p>
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
              <p className="settings-option__hint">启用后可在操作栏选择"导出为.gia文件（实验）"</p>
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
                    placeholder="请输入固定UID（9~10位数字）"
                    className={classNames({ 'is-invalid': !isFixedUidValid && settings.giaFixedUid.length > 0 })}
                    inputMode="numeric"
                  />
                  <p className="settings-option__hint">
                    UID需为9~10位数字
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const returnLabel = '返回';
  const returnAriaLabel = returnTarget === 'editor' ? '返回节点图编辑器' : '返回主页';

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <div>
          <h1>设置</h1>
          <p className="settings-page__subtitle">所有设置数据仅保存在本地浏览器</p>
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
              通用设置
            </button>
            <button
              type="button"
              className={classNames('settings-tab', { 'is-active': activeTab === 'export' })}
              onClick={() => setActiveTab('export')}
            >
              导出设置
            </button>
          </div>
          <button
            type="button"
            className="settings-tab settings-tab--about"
            onClick={() => setIsAboutOpen(true)}
          >
            <img src={ICON_INFO} alt="" aria-hidden="true" />
            关于
          </button>
        </aside>
        <section className="settings-page__content">
          {activeTab === 'general' ? renderGeneralTab() : renderExportTab()}
        </section>
      </div>
      {isAboutOpen && (
        <div className="settings-about-overlay">
          <div className="settings-about-modal" role="dialog" aria-modal="true">
            <div className="settings-about-header">
              <h2>关于</h2>
              <button type="button" onClick={() => setIsAboutOpen(false)}>
                关闭
              </button>
            </div>
            <div className="settings-about-body">
              <p>
                声明：该项目为同人制作，与米哈游无关联。所有引用的素材归其原始版权所有者所有。该项目90%以上代码均由AI生成。此项目仅供学习和交流使用，严禁用于商业用途。使用时请务必遵守<a href="https://genshin.hoyoverse.com/company/terms" target="_blank" rel="noopener noreferrer">《原神》及《原神·千星奇域》使用条款</a>，如因使用此工具时违反《原神》条款造成原神账号封禁，此项目概不负责。
              </p>
              <p>
                使用此网页应用时即默认表示您已阅读并同意以上声明。
              </p>
              <br></br>
              <p>
                此项目基于 <strong>GPL V3</strong> 协议发布（见页面底部），代码托管于GitHub，欢迎各位用户添加Star和参与贡献：<a href="https://github.com/Columbina-Dev/WebMiliastraNodesEditor" target="_blank" rel="noopener noreferrer">https://github.com/Columbina-Dev/WebMiliastraNodesEditor</a>
              </p>
              <br></br>
              <p>
                特别鸣谢（时间顺序）：
              </p>
              <p>
                <a href="https://github.com/hackermdch" target="_blank" rel="noopener noreferrer">hackermdch</a> - 提供 UgcUtil.dll 帮助编码/解码 .gil 存档文件
              </p>
              <p>
                <a href="https://github.com/Wu-Yijun" target="_blank" rel="noopener noreferrer">Wu-Yijun</a> - 提供 gia.proto及其他工具 帮助编码/解码 .gia 文件
              </p>
              <br></br><br></br>
              <p>
                《原神·千星奇域》节点图模拟器（"Genshin Impact - Miliastra Wonderland" Node Graph Simulator）
              </p>
              <p>
                    Copyright (C) 2025-2026  Columbina-Dev
              </p>
              <p>
                    This program is free software: you can redistribute it and/or modify
                    it under the terms of the GNU General Public License as published by
                    the Free Software Foundation, either version 3 of the License, or
                    (at your option) any later version.
              </p>
              <p>
                    This program is distributed in the hope that it will be useful,
                    but WITHOUT ANY WARRANTY; without even the implied warranty of
                    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
                    GNU General Public License for more details.
              </p>
              <p>
                    You should have received a copy of the GNU General Public License
                    along with this program.  If not, see <a href="https://www.gnu.org/licenses/" target="_blank" rel="noopener noreferrer">https://www.gnu.org/licenses/</a>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
