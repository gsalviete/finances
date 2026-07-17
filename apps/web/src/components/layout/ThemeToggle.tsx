'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { Theme } from '@finances/shared';
import { api, getToken } from '../../lib/api-client';
import { useI18n, type MessageKey } from '../../lib/i18n';

const ORDER: Theme[] = ['light', 'dark', 'system'];
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const LABEL_KEYS: Record<Theme, MessageKey> = {
  light: 'theme.light',
  dark: 'theme.dark',
  system: 'theme.system',
};

/** Troca instantânea (FR-035) + persistência em banco e hint em cookie (FR-036). */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="skeleton" style={{ width: 90, height: 34 }} />;

  const current = (ORDER.includes(theme as Theme) ? theme : 'system') as Theme;
  const Icon = ICONS[current];

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] as Theme;
    setTheme(next);
    document.cookie = `finances-theme=${next};path=/;max-age=31536000`; // hint anti-FOUC
    if (getToken() !== null) {
      void api('/settings', { method: 'PUT', body: { theme: next } }).catch(() => undefined);
    }
  };

  return (
    <button
      type="button"
      className="btn"
      onClick={cycle}
      aria-label={`${t('theme.label')}: ${t(LABEL_KEYS[current])}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={current}
          className="row"
          style={{ gap: 8 }}
          initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
          transition={{ duration: 0.18 }}
        >
          <Icon size={15} aria-hidden /> {t(LABEL_KEYS[current])}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
