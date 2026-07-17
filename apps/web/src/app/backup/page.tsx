'use client';

/** Backup (Fase 23/FR-031–033): export, import REPLACE com confirmação, backup manual. */
import { useState } from 'react';
import { Download, HardDriveUpload, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Shell } from '../../components/layout/Shell';
import { MotionCard, Stagger } from '../../components/motion';
import { ApiError, apiRaw } from '../../lib/api-client';
import { useI18n } from '../../lib/i18n';

export default function BackupPage() {
  const { t } = useI18n();
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
      setFeedback(t('backup.exportDone'));
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.message : t('backup.exportError'));
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
      setFeedback(t('backup.importDone'));
      setFile(null);
      setConfirmed(false);
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.message : t('backup.importError'));
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
      setFeedback(
        t('backup.runDone', { provider: metadata.providerType, location: metadata.location }),
      );
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.message : t('backup.runError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <PageHeader
        eyebrow={t('backup.eyebrow')}
        title={t('backup.pageTitle')}
        subtitle={t('backup.pageSubtitle')}
      />
      <Stagger className="grid">
        <MotionCard interactive={false} aria-label={t('backup.exportAria')}>
          <p className="card-title" style={{ marginBottom: 4 }}>
            {t('backup.exportTitle')}
          </p>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>
            {t('backup.exportText')}
          </p>
          <button type="button" className="btn btn-primary" onClick={exportZip} disabled={busy}>
            <Download size={15} aria-hidden /> {t('backup.exportBtn')}
          </button>
        </MotionCard>

        <MotionCard interactive={false} aria-label={t('backup.importAria')}>
          <p className="card-title" style={{ marginBottom: 4 }}>
            {t('backup.importTitle')}
          </p>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>
            {t('backup.importText')}
          </p>
          <div className="grid" style={{ gap: 10, justifyItems: 'start' }}>
            <input
              type="file"
              accept=".zip,application/zip"
              aria-label={t('backup.fileAria')}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <label className="row" style={{ gap: 6, fontSize: 13.5 }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {t('backup.importCheck')}
            </label>
            <button
              type="button"
              className="btn btn-danger"
              onClick={importZip}
              disabled={!file || !confirmed || busy}
            >
              <HardDriveUpload size={15} aria-hidden /> {t('backup.importBtn')}
            </button>
          </div>
        </MotionCard>

        <MotionCard interactive={false} aria-label={t('backup.runAria')}>
          <p className="card-title" style={{ marginBottom: 4 }}>
            {t('backup.runTitle')}
          </p>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>
            {t('backup.runText')}
          </p>
          <button type="button" className="btn" onClick={runBackup} disabled={busy}>
            <ShieldCheck size={15} aria-hidden /> {t('backup.runBtn')}
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
