'use client';

/** Alterna pt-BR ⇄ en-US: aplica na hora, grava cookie (via provider) e banco. */
import { Languages } from 'lucide-react';
import { api, getToken } from '../../lib/api-client';
import { useI18n, type Lang } from '../../lib/i18n';

const NEXT: Record<Lang, Lang> = { 'pt-BR': 'en-US', 'en-US': 'pt-BR' };
const SHORT: Record<Lang, string> = { 'pt-BR': 'Português', 'en-US': 'English' };

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();

  const cycle = () => {
    const next = NEXT[lang];
    setLang(next);
    if (getToken() !== null) {
      void api('/settings', { method: 'PUT', body: { language: next } }).catch(() => undefined);
    }
  };

  return (
    <button
      type="button"
      className="btn"
      onClick={cycle}
      aria-label={`${t('lang.switch')}: ${SHORT[lang]}`}
    >
      <Languages size={15} aria-hidden /> {SHORT[lang]}
    </button>
  );
}
