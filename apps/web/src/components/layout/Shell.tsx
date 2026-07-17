'use client';

/** Shell: sidebar fixa no desktop, drawer no mobile (ARCHITECTURE §6). */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArchiveRestore,
  Heart,
  Home,
  Inbox,
  List,
  LogOut,
  Menu,
  Settings,
  Tags,
  Target,
  Wallet,
  X,
} from 'lucide-react';
import { useSettings } from '../../features/queries';
import { useI18n, type MessageKey } from '../../lib/i18n';
import { useRequireSession } from '../../lib/session';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';

const NAV: { href: string; labelKey: MessageKey; icon: typeof Home }[] = [
  { href: '/', labelKey: 'nav.home', icon: Home },
  { href: '/transactions', labelKey: 'nav.transactions', icon: List },
  { href: '/planning', labelKey: 'nav.planning', icon: Target },
  { href: '/categories', labelKey: 'nav.categories', icon: Tags },
  { href: '/inbox', labelKey: 'nav.inbox', icon: Inbox },
  { href: '/wishlist', labelKey: 'nav.wishlist', icon: Heart },
  { href: '/backup', labelKey: 'nav.backup', icon: ArchiveRestore },
  { href: '/settings', labelKey: 'nav.settings', icon: Settings },
];

function NavLinks({
  onNavigate,
  pillGroup = 'sidebar',
}: {
  onNavigate?: () => void;
  pillGroup?: string;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <>
      {NAV.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`nav-link ${active ? 'active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {active && (
              <motion.span
                layoutId={`nav-pill-${pillGroup}`}
                className="nav-pill"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <Icon size={17} aria-hidden />
            {t(labelKey)}
          </Link>
        );
      })}
    </>
  );
}

/** Preferências persistidas (idioma/moeda/timezone/animações) regem a UI. */
function useSettingsSync() {
  const { data } = useSettings();
  const { syncFromSettings } = useI18n();
  useEffect(() => {
    if (data) {
      syncFromSettings({
        language: data.language,
        currency: data.currency,
        timezone: data.timezone,
        motionLevel: data.motionLevel,
      });
    }
  }, [data, syncFromSettings]);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useRequireSession();
  const { t } = useI18n();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  useSettingsSync();

  if (loading || user === null) {
    return (
      <div className="content" role="status" aria-label={t('common.loading')}>
        <div className="skeleton" style={{ height: 48, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 160 }} />
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar" aria-label={t('nav.main')}>
        <div className="row" style={{ padding: '4px 12px 18px', fontWeight: 700, fontSize: 17 }}>
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 30,
              height: 30,
              borderRadius: 9,
              background: 'var(--brand-gradient)',
              color: 'var(--accent-contrast)',
              boxShadow: 'var(--brand-glow)',
            }}
          >
            <Wallet size={17} aria-hidden />
          </span>
          <span className="brand-mark">finances</span>
        </div>
        <NavLinks />
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <LanguageToggle />
          <ThemeToggle />
          <button type="button" className="btn" onClick={logout}>
            <LogOut size={15} aria-hidden /> {t('nav.logout')}
          </button>
        </div>
      </aside>

      <div>
        <header className="mobile-topbar">
          <button
            type="button"
            className="btn"
            aria-label={t('nav.open')}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={18} aria-hidden />
          </button>
          <strong className="brand-mark">finances</strong>
          <ThemeToggle />
        </header>

        <AnimatePresence>
          {drawerOpen && (
            <motion.div
              className="drawer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
            >
              <motion.nav
                className="drawer-panel"
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -40, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                aria-label={t('nav.main')}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong className="brand-mark">finances</strong>
                  <button
                    type="button"
                    className="btn"
                    aria-label={t('nav.close')}
                    onClick={() => setDrawerOpen(false)}
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
                <NavLinks onNavigate={() => setDrawerOpen(false)} pillGroup="drawer" />
                <LanguageToggle />
                <button type="button" className="btn" onClick={logout}>
                  <LogOut size={15} aria-hidden /> {t('nav.logout')}
                </button>
              </motion.nav>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="content">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
