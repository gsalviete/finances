'use client';

/** Ajustes (Fase 17/FR-034–036). */
import { useState } from 'react';
import { useTheme } from 'next-themes';
import type { UpdateSettingsInput } from '@finances/shared';
import { Save } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Shell } from '../../components/layout/Shell';
import { MotionCard } from '../../components/motion';
import { useSettings, useSettingsMutation } from '../../features/queries';
import { ApiError } from '../../lib/api-client';
import { useI18n } from '../../lib/i18n';

export default function SettingsPage() {
  const { t } = useI18n();
  const { data, isLoading } = useSettings();
  const mutation = useSettingsMutation();
  const { setTheme } = useTheme();
  const [draft, setDraft] = useState<UpdateSettingsInput>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const value = <K extends keyof UpdateSettingsInput>(key: K): UpdateSettingsInput[K] =>
    (draft[key] ?? (data?.[key as keyof typeof data] as UpdateSettingsInput[K])) as never;

  const save = async () => {
    setFeedback(null);
    if (Object.keys(draft).length === 0) {
      setFeedback(t('set.nothing'));
      return;
    }
    try {
      const saved = await mutation.mutateAsync(draft);
      if (draft.theme) {
        setTheme(saved.theme);
        document.cookie = `finances-theme=${saved.theme};path=/;max-age=31536000`;
      }
      setDraft({});
      setFeedback(t('set.saved'));
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.message : t('set.error'));
    }
  };

  return (
    <Shell>
      <PageHeader
        eyebrow={t('set.eyebrow')}
        title={t('set.pageTitle')}
        subtitle={t('set.pageSubtitle')}
      />
      <MotionCard interactive={false} aria-label={t('set.aria')}>
        <p className="card-title">{t('set.title')}</p>
        {isLoading || !data ? (
          <div className="skeleton" style={{ height: 140 }} role="status" />
        ) : (
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}
          >
            <div className="field">
              <label htmlFor="set-theme">{t('set.theme')}</label>
              <select
                id="set-theme"
                value={value('theme')}
                onChange={(e) =>
                  setDraft({ ...draft, theme: e.target.value as UpdateSettingsInput['theme'] })
                }
              >
                <option value="light">{t('theme.light')}</option>
                <option value="dark">{t('theme.dark')}</option>
                <option value="system">{t('theme.system')}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="set-currency">{t('set.currency')}</label>
              <input
                id="set-currency"
                value={value('currency')}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
                maxLength={3}
              />
            </div>
            <div className="field">
              <label htmlFor="set-language">{t('set.language')}</label>
              <select
                id="set-language"
                value={value('language')}
                onChange={(e) => setDraft({ ...draft, language: e.target.value })}
              >
                <option value="pt-BR">{t('set.langPt')}</option>
                <option value="en-US">{t('set.langEn')}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="set-timezone">{t('set.timezone')}</label>
              <input
                id="set-timezone"
                value={value('timezone')}
                onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="set-backup">{t('set.backup')}</label>
              <select
                id="set-backup"
                value={value('backupFrequency')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    backupFrequency: e.target.value as UpdateSettingsInput['backupFrequency'],
                  })
                }
              >
                <option value="DAILY">{t('set.daily')}</option>
                <option value="WEEKLY">{t('set.weekly')}</option>
                <option value="MONTHLY">{t('set.monthly')}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="set-motion">{t('set.motion')}</label>
              <select
                id="set-motion"
                value={value('motionLevel')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    motionLevel: e.target.value as UpdateSettingsInput['motionLevel'],
                  })
                }
              >
                <option value="FULL">{t('set.motionFull')}</option>
                <option value="REDUCED">{t('set.motionReduced')}</option>
                <option value="NONE">{t('set.motionNone')}</option>
              </select>
            </div>
          </div>
        )}
        <div className="row" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={mutation.isPending}
          >
            <Save size={15} aria-hidden /> {t('set.save')}
          </button>
          {feedback && (
            <span className="muted" role="status" style={{ fontSize: 13 }}>
              {feedback}
            </span>
          )}
        </div>
      </MotionCard>
    </Shell>
  );
}
