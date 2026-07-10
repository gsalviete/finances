'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { AnimatePresence, motion } from '../../components/motion';
import { ApiError } from '../../lib/api-client';
import { useSession } from '../../lib/session';

export default function LoginPage() {
  const { user, login, register } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user !== null) router.replace('/');
  }, [user, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro inesperado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="content" style={{ maxWidth: 400, paddingTop: 64 }}>
      <motion.div
        className="card card-hero grid"
        style={{ gap: 16 }}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="row" style={{ fontWeight: 700, fontSize: 22 }}>
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 38,
              height: 38,
              borderRadius: 11,
              background: 'var(--brand-gradient)',
              color: '#fff',
              boxShadow: 'var(--brand-glow)',
            }}
          >
            <Wallet size={20} aria-hidden />
          </span>
          <span className="brand-mark">finances</span>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Quanto eu ainda posso gastar até o final deste mês?
        </p>
        <form onSubmit={submit} className="grid" style={{ gap: 12 }}>
          <AnimatePresence initial={false}>
            {mode === 'register' && (
              <motion.div
                className="field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <label htmlFor="name">Nome</label>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={mode === 'register' ? 8 : 1}
              required
            />
          </div>
          {error && (
            <p className="badge badge-danger" role="alert" style={{ justifySelf: 'start' }}>
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        <button
          type="button"
          className="btn"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Primeiro acesso? Criar conta' : 'Já tenho conta'}
        </button>
      </motion.div>
    </main>
  );
}
