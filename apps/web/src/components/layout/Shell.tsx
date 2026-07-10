'use client';

/** Shell: sidebar fixa no desktop, drawer no mobile (ARCHITECTURE §6). */
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArchiveRestore,
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
import { useRequireSession } from '../../lib/session';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/transactions', label: 'Transações', icon: List },
  { href: '/planning', label: 'Planejamento', icon: Target },
  { href: '/categories', label: 'Categorias', icon: Tags },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/backup', label: 'Backup', icon: ArchiveRestore },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];

function NavLinks({
  onNavigate,
  pillGroup = 'sidebar',
}: {
  onNavigate?: () => void;
  pillGroup?: string;
}) {
  const pathname = usePathname();
  return (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
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
            {label}
          </Link>
        );
      })}
    </>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useRequireSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  if (loading || user === null) {
    return (
      <div className="content" role="status" aria-label="Carregando">
        <div className="skeleton" style={{ height: 48, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 160 }} />
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="row" style={{ padding: '4px 12px 18px', fontWeight: 700, fontSize: 17 }}>
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 30,
              height: 30,
              borderRadius: 9,
              background: 'var(--brand-gradient)',
              color: '#fff',
              boxShadow: 'var(--brand-glow)',
            }}
          >
            <Wallet size={17} aria-hidden />
          </span>
          <span className="brand-mark">finances</span>
        </div>
        <NavLinks />
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ThemeToggle />
          <button type="button" className="btn" onClick={logout}>
            <LogOut size={15} aria-hidden /> Sair
          </button>
        </div>
      </aside>

      <div>
        <header className="mobile-topbar">
          <button
            type="button"
            className="btn"
            aria-label="Abrir menu"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={18} aria-hidden />
          </button>
          <strong>finances</strong>
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
                transition={{ duration: 0.2 }}
                aria-label="Navegação principal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>finances</strong>
                  <button
                    type="button"
                    className="btn"
                    aria-label="Fechar menu"
                    onClick={() => setDrawerOpen(false)}
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
                <NavLinks onNavigate={() => setDrawerOpen(false)} pillGroup="drawer" />
                <button type="button" className="btn" onClick={logout}>
                  <LogOut size={15} aria-hidden /> Sair
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
