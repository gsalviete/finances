'use client';

/** Backup (Fase 23/FR-031–033): export, import REPLACE com confirmação, backup manual. */
import { useState } from 'react';
import { Download, HardDriveUpload, ShieldCheck } from 'lucide-react';
import { Shell } from '../../components/layout/Shell';
import { MotionCard, Stagger } from '../../components/motion';
import { ApiError, apiRaw } from '../../lib/api-client';

export default function BackupPage() {
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const exportZip = async () => {
    setFeedback(null);
    setBusy(true);
    try {
      const response = await apiRaw('/backup/export');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'finances-export.zip';
      anchor.click();
      URL.revokeObjectURL(url);
      setFeedback('Export gerado — o download começou.');
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.message : 'Erro no export');
    } finally {
      setBusy(false);
    }
  };

  const importZip = async () => {
    if (!file || !confirmed) return;
    setFeedback(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('strategy', 'REPLACE');
      await apiRaw('/backup/import', { method: 'POST', body: form });
      setFeedback('Import concluído: seus dados foram SUBSTITUÍDOS pelo conteúdo do arquivo.');
      setFile(null);
      setConfirmed(false);
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.message : 'Erro no import');
    } finally {
      setBusy(false);
    }
  };

  const runBackup = async () => {
    setFeedback(null);
    setBusy(true);
    try {
      const response = await apiRaw('/backup/run', { method: 'POST' });
      const metadata = (await response.json()) as { location: string; providerType: string };
      setFeedback(`Backup gravado via ${metadata.providerType}: ${metadata.location}`);
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.message : 'Erro no backup');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Stagger className="grid">
        <MotionCard interactive={false} aria-label="Exportar dados">
          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Exportar meus dados</p>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>
            ZIP com transações, categorias, planejamentos, recorrências e preferências. Nunca inclui
            senha ou dados sensíveis. Seus dados são seus (Filosofia #8).
          </p>
          <button type="button" className="btn btn-primary" onClick={exportZip} disabled={busy}>
            <Download size={15} aria-hidden /> Exportar ZIP
          </button>
        </MotionCard>

        <MotionCard interactive={false} aria-label="Importar dados">
          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Importar (restaurar)</p>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>
            Estratégia REPLACE: o conteúdo do arquivo <strong>substitui integralmente</strong> os
            dados atuais. Arquivo inválido é rejeitado sem tocar em nada.
          </p>
          <div className="grid" style={{ gap: 10, justifyItems: 'start' }}>
            <input
              type="file"
              accept=".zip,application/zip"
              aria-label="Arquivo de backup"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <label className="row" style={{ gap: 6, fontSize: 13.5 }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Entendo que meus dados atuais serão substituídos
            </label>
            <button
              type="button"
              className="btn btn-danger"
              onClick={importZip}
              disabled={!file || !confirmed || busy}
            >
              <HardDriveUpload size={15} aria-hidden /> Importar e substituir
            </button>
          </div>
        </MotionCard>

        <MotionCard interactive={false} aria-label="Backup manual">
          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Backup agora</p>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>
            Grava um artefato pelo provedor configurado (Local em dev, Object Storage em produção) e
            registra os metadados.
          </p>
          <button type="button" className="btn" onClick={runBackup} disabled={busy}>
            <ShieldCheck size={15} aria-hidden /> Executar backup
          </button>
        </MotionCard>

        {feedback && (
          <p className="muted" role="status" style={{ margin: 0, fontSize: 13.5 }}>
            {feedback}
          </p>
        )}
      </Stagger>
    </Shell>
  );
}
