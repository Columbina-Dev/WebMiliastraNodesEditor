import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import classNames from 'classnames';
import './EffectsPage.css';
import gifsJsText from '../external/ys-keqizu/gifs.js?raw';
import gifs2JsText from '../external/ys-keqizu/gifs2.js?raw';
import { useI18n } from '../utils/i18nContext';

type EffectCategory = 'limited' | 'loop';

interface EffectEntry {
  id?: string;
  name: string;
  filename: string;
}

interface EffectsPageProps {
  version?: string;
  onBack: () => void;
}

const REMOTE_ROOT = 'https://ys.keqizu.com';

const CATEGORY_META: Record<
  EffectCategory,
  { labelKey: string; preferredBase: string; fallbackBase: string }
> = {
  limited: {
    labelKey: 'effects.category.limited',
    preferredBase: `${REMOTE_ROOT}/GIFS`,
    fallbackBase: `${REMOTE_ROOT}/gifs`,
  },
  loop: {
    labelKey: 'effects.category.loop',
    preferredBase: `${REMOTE_ROOT}/GIFS2`,
    fallbackBase: `${REMOTE_ROOT}/gifs2`,
  },
};

const SCALE_OPTIONS = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5];
const INITIAL_BATCH = 60;
const LOAD_STEP = 48;
const STORAGE_KEY_SCALE = 'effectsTileScale';

const parseScriptArray = (script: string, key: string) => {
  const pattern = new RegExp(`${key}\\s*=\\s*(\\[[\\s\\S]*?\\])\\s*;?\\s*$`, 'm');
  const match = script.match(pattern);
  if (!match) {
    throw new Error(`Unable to extract effect list from ${key}`);
  }
  return JSON.parse(match[1]) as EffectEntry[];
};

const EffectsPage = ({ onBack }: EffectsPageProps) => {
  const { t } = useI18n();
  const [limitedEffects, setLimitedEffects] = useState<EffectEntry[]>([]);
  const [loopEffects, setLoopEffects] = useState<EffectEntry[]>([]);
  const [category, setCategory] = useState<EffectCategory>('limited');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(INITIAL_BATCH);
  const [scale, setScale] = useState(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY_SCALE) : null;
    const parsed = saved ? Number.parseFloat(saved) : 1;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const limitedScript = gifsJsText;
        const loopScript = gifs2JsText;
        if (cancelled) return;
        const limited = parseScriptArray(limitedScript, 'window.GIFS_DATA');
        const loop = parseScriptArray(loopScript, 'window.GIFS2_DATA');
        setLimitedEffects(limited);
        setLoopEffects(loop);
      } catch (fetchError) {
        if (cancelled) return;
        console.error(fetchError);
        setError(t('effects.error.loadFailed'));
        setLimitedEffects([]);
        setLoopEffects([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const activeList = category === 'limited' ? limitedEffects : loopEffects;

  const filteredEffects = useMemo(() => {
    if (!normalizedSearch) {
      return activeList;
    }
    return activeList.filter((effect) => {
      const haystack = `${effect.name ?? ''} ${effect.id ?? ''} ${effect.filename}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [activeList, normalizedSearch]);

  useEffect(() => {
    setDisplayCount((prev) => {
      const baseline = Math.min(INITIAL_BATCH, filteredEffects.length || INITIAL_BATCH);
      return Math.min(baseline, filteredEffects.length || baseline, prev);
    });
  }, [filteredEffects.length, category, normalizedSearch]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    if (displayCount >= filteredEffects.length) return;
    const sentinel = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setDisplayCount((prev) => Math.min(prev + LOAD_STEP, filteredEffects.length));
          }
        });
      },
      {
        root: listRef.current,
        rootMargin: '480px',
        threshold: 0,
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [displayCount, filteredEffects.length]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2000);
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [toastMessage]);

  const displayedEffects = useMemo(
    () => filteredEffects.slice(0, displayCount),
    [filteredEffects, displayCount],
  );

  const searchBadge = useMemo(() => {
    if (!normalizedSearch || !filteredEffects.length) {
      return null;
    }
    return t('effects.search.badge', { query: normalizedSearch, count: filteredEffects.length });
  }, [filteredEffects.length, normalizedSearch, t]);

  const statsText = useMemo(() => {
    if (normalizedSearch) {
      return t('effects.stats.filtered', { count: filteredEffects.length });
    }
    return t('effects.stats.all', { limited: limitedEffects.length, loop: loopEffects.length });
  }, [filteredEffects.length, limitedEffects.length, loopEffects.length, normalizedSearch, t]);

  const handleCategoryChange = useCallback((next: EffectCategory) => {
    setCategory(next);
    setDisplayCount(INITIAL_BATCH);
  }, []);

  const handleScaleChange = useCallback((value: number) => {
    setScale(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY_SCALE, String(value));
    }
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const handleCopy = useCallback(
    async (text: string, label: string) => {
      if (!text) return;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          throw new Error('clipboard unavailable');
        }
        showToast(t('effects.toast.copied', { label, text }));
      } catch {
        showToast(t('effects.toast.copyFailed'));
      }
    },
    [showToast, t],
  );

  const [selectedEffect, setSelectedEffect] = useState<{
    effect: EffectEntry;
    category: EffectCategory;
  } | null>(null);

  const closeModal = useCallback(() => {
    setSelectedEffect(null);
  }, []);

  const modalImageSources = useMemo(() => {
    if (!selectedEffect) {
      return null;
    }
    const meta = CATEGORY_META[selectedEffect.category];
    return {
      preferred: `${meta.preferredBase}/${selectedEffect.effect.filename}`,
      fallback: `${meta.fallbackBase}/${selectedEffect.effect.filename}`,
    };
  }, [selectedEffect]);

  const gridStyle = useMemo(
    () =>
      ({
        ['--tile-scale' as string]: String(scale),
      }) as CSSProperties,
    [scale],
  );

  useEffect(() => {
    if (!selectedEffect) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedEffect, closeModal]);

  return (
    <div className="effects-page" style={gridStyle}>
      <header className="effects-page__header">
        <div className="effects-page__title">
          <h1>{t('effects.title')}</h1>
        </div>
        <div className="effects-page__header-actions">
          <button type="button" className="tutorial__close" onClick={onBack}>
            {t('common.backHome')}
          </button>
          <a
            className="watermark"
            aria-label={t('effects.watermark.aria')}
            href="https://space.bilibili.com/2448140"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('effects.watermark.text')}
          </a>
        </div>
      </header>

      <div className="effects-page__controls">
        <div className="effects-page__tabs" role="tablist" aria-label={t('effects.categories.aria')}>
          {(Object.keys(CATEGORY_META) as EffectCategory[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              className={classNames('effects-page__tab', { 'is-active': category === key })}
              aria-selected={category === key}
              onClick={() => handleCategoryChange(key)}
            >
              {t(CATEGORY_META[key].labelKey)}
            </button>
          ))}
        </div>

        <div className="effects-page__filters">
          <label className="effects-page__scale">
            <span>{t('effects.scale.label')}</span>
            <select
              value={String(scale)}
              onChange={(event) => {
                const value = Number.parseFloat(event.target.value);
                handleScaleChange(Number.isFinite(value) && value > 0 ? value : 1);
              }}
            >
              {SCALE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {Math.round(option * 100)}%
                </option>
              ))}
            </select>
          </label>

          <div className="effects-page__search">
            <input
              type="search"
              value={searchTerm}
              placeholder={t('effects.search.placeholder')}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label={t('effects.search.aria')}
            />
          </div>
        </div>
      </div>

      <div className="effects-page__meta" aria-live="polite">
        {searchBadge && <div className="effects-page__badge">{searchBadge}</div>}
        <span className="effects-page__stats">{statsText}</span>
      </div>

      <div className="effects-page__grid-container" ref={listRef}>
        {error && <div className="effects-page__error">{error}</div>}
        {loading && (
          <div className="effects-page__loading" role="status">
            <span>{t('effects.loading')}</span>
          </div>
        )}
        {!loading && !error && !displayedEffects.length && (
          <div className="effects-page__empty">{t('effects.empty')}</div>
        )}
        <div className="effects-page__grid">
          {displayedEffects.map((effect) => {
            const bases = CATEGORY_META[category];
            const fallbackSrc = `${bases.fallbackBase}/${effect.filename}`;
            const preferredSrc = `${bases.preferredBase}/${effect.filename}`;
            return (
              <button
                key={`${category}_${effect.id ?? effect.filename}`}
                type="button"
                className="effects-page__card"
                onClick={() => setSelectedEffect({ effect, category })}
              >
                <div className="effects-page__image-wrapper">
                  <img
                    src={preferredSrc}
                    data-alt={fallbackSrc}
                    loading="lazy"
                    alt={effect.name}
                    className="effects-page__image"
                    onError={(event) => {
                      const target = event.currentTarget;
                      const altSrc = target.dataset.alt;
                      if (altSrc && target.src !== altSrc) {
                        target.src = altSrc;
                      }
                    }}
                  />
                </div>
                <div className="effects-page__info">
                  <div className="effects-page__name">{effect.name}</div>
                  <div className="effects-page__id">
                    {effect.id ? t('common.idWithValue', { id: effect.id }) : t('common.noId')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div ref={sentinelRef} className="effects-page__sentinel" />
      </div>

      {selectedEffect && modalImageSources && (
        <div className="effects-page__modal-backdrop" role="dialog" aria-modal="true" onClick={closeModal}>
          <div
            className="effects-page__modal"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="effects-page__modal-close" onClick={closeModal}>
              {t('common.close')}
            </button>
            <div className="effects-page__modal-body">
              <img
                src={modalImageSources.preferred}
                data-alt={modalImageSources.fallback}
                alt={selectedEffect.effect.name}
                className="effects-page__modal-image"
                onError={(event) => {
                  const target = event.currentTarget;
                  const altSrc = target.dataset.alt;
                  if (altSrc && target.src !== altSrc) {
                    target.src = altSrc;
                  }
                }}
              />
              <div className="effects-page__modal-info">
                <button
                  type="button"
                  className="effects-page__modal-title"
                  onClick={() => handleCopy(selectedEffect.effect.name ?? '', t('common.name'))}
                >
                  {selectedEffect.effect.name}
                </button>
                <button
                  type="button"
                  className="effects-page__modal-id"
                  onClick={() => handleCopy(selectedEffect.effect.id ?? '', t('common.id'))}
                  disabled={!selectedEffect.effect.id}
                >
                  {selectedEffect.effect.id
                    ? t('common.idWithValue', { id: selectedEffect.effect.id })
                    : t('common.noId')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="effects-page__toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default EffectsPage;




