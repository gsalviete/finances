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

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={`nav-link ${pathname === href ? 'active' : ''}`}
          aria-current={pathname === href ? 'page' : undefined}
        >
          <Icon size={17} aria-hidden />
          {label}
        </Link>
      ))}
    </>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useRequireSession();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        <div className="row" style={{ padding: '4px 12px 16px', fontWeight: 700 }}>
          <Wallet size={20} aria-hidden /> finances
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
                <NavLinks onNavigate={() => setDrawerOpen(false)} />
                <button type="button" className="btn" onClick={logout}>
                  <LogOut size={15} aria-hidden /> Sair
                </button>
              </motion.nav>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
