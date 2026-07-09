'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { Theme } from '@finances/shared';
import { api, getToken } from '../../lib/api-client';

const ORDER: Theme[] = ['light', 'dark', 'system'];
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const LABELS = { light: 'Claro', dark: 'Escuro', system: 'Sistema' } as const;

/** Troca instantânea (FR-035) + persistência em banco e hint em cookie (FR-036). */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
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
    <button type="button" className="btn" onClick={cycle} aria-label={`Tema: ${LABELS[current]}`}>
      <Icon size={15} aria-hidden /> {LABELS[current]}
    </button>
  );
}
