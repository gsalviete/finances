'use client';

/** Ajustes (Fase 17/FR-034–036). */
import { useState } from 'react';
import { useTheme } from 'next-themes';
import type { UpdateSettingsInput } from '@finances/shared';
import { Save } from 'lucide-react';
import { Shell } from '../../components/layout/Shell';
import { useSettings, useSettingsMutation } from '../../features/queries';
import { ApiError } from '../../lib/api-client';

export default function SettingsPage() {
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
      setFeedback('Nada para salvar.');
      return;
    }
    try {
      const saved = await mutation.mutateAsync(draft);
      if (draft.theme) {
        setTheme(saved.theme);
        document.cookie = `finances-theme=${saved.theme};path=/;max-age=31536000`;
      }
      setDraft({});
      setFeedback('Preferências salvas.');
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.message : 'Erro ao salvar');
    }
  };

  return (
    <Shell>
      <section className="card" aria-label="Preferências">
        <p style={{ margin: '0 0 12px', fontWeight: 600 }}>Preferências</p>
        {isLoading || !data ? (
          <div className="skeleton" style={{ height: 140 }} role="status" />
        ) : (
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}
          >
            <div className="field">
              <label htmlFor="set-theme">Tema</label>
              <select
                id="set-theme"
                value={value('theme')}
                onChange={(e) =>
                  setDraft({ ...draft, theme: e.target.value as UpdateSettingsInput['theme'] })
                }
              >
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
                <option value="system">Sistema</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="set-currency">Moeda (ISO 4217)</label>
              <input
                id="set-currency"
                value={value('currency')}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
                maxLength={3}
              />
            </div>
            <div className="field">
              <label htmlFor="set-language">Idioma</label>
              <input
                id="set-language"
                value={value('language')}
                onChange={(e) => setDraft({ ...draft, language: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="set-timezone">Timezone (IANA)</label>
              <input
                id="set-timezone"
                value={value('timezone')}
                onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="set-backup">Frequência de backup</label>
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
                <option value="DAILY">Diário</option>
                <option value="WEEKLY">Semanal</option>
                <option value="MONTHLY">Mensal</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="set-motion">Animações</label>
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
                <option value="FULL">Completas</option>
                <option value="REDUCED">Reduzidas</option>
                <option value="NONE">Nenhuma</option>
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
            <Save size={15} aria-hidden /> Salvar
          </button>
          {feedback && (
            <span className="muted" role="status" style={{ fontSize: 13 }}>
              {feedback}
            </span>
          )}
        </div>
      </section>
    </Shell>
  );
}
