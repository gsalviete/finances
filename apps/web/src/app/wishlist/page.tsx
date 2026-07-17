'use client';

/** Wishlist (ADR-018): cadastro por URL com extração de nome/preço/imagem. */
import { useState } from 'react';
import { ExternalLink, ImageOff, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Money, WISHLIST_PRIORITIES, type WishlistItem } from '@finances/shared';
import { PageHeader } from '../../components/layout/PageHeader';
import { Shell } from '../../components/layout/Shell';
import { AnimatePresence, MotionCard, Stagger, StaggerItem } from '../../components/motion';
import { useWishlist, useWishlistMutations } from '../../features/queries';
import { ApiError } from '../../lib/api-client';
import { parseDecimalToCents } from '../../lib/format';
import { useI18n, type MessageKey } from '../../lib/i18n';

type Mutations = ReturnType<typeof useWishlistMutations>;

function WishlistCard({
  item,
  mutations,
  notify,
}: {
  item: WishlistItem;
  mutations: Mutations;
  notify: (message: string) => void;
}) {
  const { t, lang, fmtDate } = useI18n();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(
    item.priceCents === null
      ? ''
      : Money.fromCents(item.priceCents).toDecimalString().replace('.', ','),
  );
  const [priority, setPriority] = useState(item.priority);

  const run = async (action: Promise<unknown>, ok: string, fail: MessageKey) => {
    try {
      await action;
      notify(ok);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : t(fail));
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    let priceCents: number | null = null;
    if (price.trim() !== '') {
      try {
        priceCents = parseDecimalToCents(price);
      } catch {
        notify(t('wish.updateError'));
        return;
      }
    }
    await run(
      mutations.update.mutateAsync({ id: item.id, input: { name, priceCents, priority } }),
      t('wish.updated'),
      'wish.updateError',
    );
    setEditing(false);
  };

  return (
    <StaggerItem
      layout
      exit={{ opacity: 0, scale: 0.96 }}
      className="row"
      style={{ alignItems: 'stretch' }}
    >
      {item.imageUrl === null ? (
        <span
          className="row"
          style={{ width: 72, justifyContent: 'center' }}
          title={t('wish.noImage')}
        >
          <ImageOff size={22} aria-label={t('wish.noImage')} />
        </span>
      ) : (
        // imagem externa de origem arbitrária: <img> puro, sem o otimizador do Next
        <img
          src={item.imageUrl}
          alt={item.name}
          width={72}
          height={72}
          style={{ objectFit: 'cover', borderRadius: 10, flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <form onSubmit={save} className="row" style={{ flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label htmlFor={`wish-name-${item.id}`}>{t('wish.name')}</label>
              <input
                id={`wish-name-${item.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="field" style={{ width: 110 }}>
              <label htmlFor={`wish-price-${item.id}`}>
                {t('wish.price', { currency: item.currency })}
              </label>
              <input
                id={`wish-price-${item.id}`}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="123,45"
              />
            </div>
            <div className="field">
              <label htmlFor={`wish-prio-${item.id}`}>{t('wish.priority')}</label>
              <select
                id={`wish-prio-${item.id}`}
                value={priority}
                onChange={(e) => setPriority(e.target.value as WishlistItem['priority'])}
              >
                {WISHLIST_PRIORITIES.map((level) => (
                  <option key={level} value={level}>
                    {t(`wish.prio.${level}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ justifyContent: 'end' }}>
              <span className="row">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={mutations.update.isPending}
                >
                  {t('wish.save')}
                </button>
                <button type="button" className="btn" onClick={() => setEditing(false)}>
                  {t('wish.cancel')}
                </button>
              </span>
            </div>
          </form>
        ) : (
          <>
            <p style={{ margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.name}
            </p>
            <p className="row" style={{ margin: '4px 0 0', gap: 8, flexWrap: 'wrap' }}>
              {/* Preço ausente é o único "incompleto" acionável — some ao ser preenchido. */}
              {item.priceCents === null ? (
                <span className="badge badge-warning">{t('wish.noPrice')}</span>
              ) : (
                <strong>{Money.fromCents(item.priceCents).format(lang, item.currency)}</strong>
              )}
              <span className="badge badge-neutral">{t(`wish.prio.${item.priority}`)}</span>
              {item.scrapedAt !== null && (
                <span className="muted" style={{ fontSize: 12.5 }}>
                  {t('wish.scrapedAt', { date: fmtDate(item.scrapedAt) })}
                </span>
              )}
            </p>
          </>
        )}
      </div>
      <span className="row" style={{ flexShrink: 0 }}>
        <a
          className="btn"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('wish.openLink')}
          title={t('wish.openLink')}
        >
          <ExternalLink size={14} aria-hidden />
        </a>
        <button
          type="button"
          className="btn"
          aria-label={t('wish.refresh')}
          title={t('wish.refresh')}
          disabled={mutations.refresh.isPending}
          onClick={() =>
            void run(
              mutations.refresh.mutateAsync(item.id),
              t('wish.refreshed'),
              'wish.refreshError',
            )
          }
        >
          <RefreshCw size={14} aria-hidden />
        </button>
        <button
          type="button"
          className="btn"
          aria-label={t('wish.edit')}
          title={t('wish.edit')}
          onClick={() => setEditing((value) => !value)}
        >
          <Pencil size={14} aria-hidden />
        </button>
        <button
          type="button"
          className="btn btn-danger"
          aria-label={t('wish.delete')}
          title={t('wish.delete')}
          onClick={() => {
            if (!window.confirm(t('wish.deleteConfirm', { name: item.name }))) return;
            void run(mutations.remove.mutateAsync(item.id), t('wish.deleted'), 'wish.deleteError');
          }}
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </span>
    </StaggerItem>
  );
}

export default function WishlistPage() {
  const { t } = useI18n();
  const { data, isLoading } = useWishlist();
  const mutations = useWishlistMutations();
  const [url, setUrl] = useState('');
  const [priority, setPriority] = useState<WishlistItem['priority']>('MEDIUM');
  const [feedback, setFeedback] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    try {
      const created = await mutations.create.mutateAsync({ url, priority });
      setUrl('');
      setFeedback(created.scrapeStatus === 'OK' ? t('wish.added') : t('wish.addedPartial'));
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.message : t('wish.addError'));
    }
  };

  return (
    <Shell>
      <PageHeader
        eyebrow={t('wish.eyebrow')}
        title={t('wish.pageTitle')}
        subtitle={t('wish.pageSubtitle')}
      />
      <Stagger className="grid">
        <MotionCard interactive={false} aria-label={t('wish.newAria')}>
          <p className="card-title">{t('wish.newTitle')}</p>
          <form onSubmit={submit} className="row" style={{ flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="wish-url">{t('wish.url')}</label>
              <input
                id="wish-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('wish.urlPlaceholder')}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="wish-priority">{t('wish.priority')}</label>
              <select
                id="wish-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as WishlistItem['priority'])}
              >
                {WISHLIST_PRIORITIES.map((level) => (
                  <option key={level} value={level}>
                    {t(`wish.prio.${level}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ justifyContent: 'end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={mutations.create.isPending}
              >
                <Plus size={15} aria-hidden /> {t('wish.add')}
              </button>
            </div>
          </form>
          {feedback && (
            <p className="muted" role="status" style={{ margin: '10px 0 0', fontSize: 13 }}>
              {feedback}
            </p>
          )}
        </MotionCard>

        <MotionCard interactive={false} aria-label={t('wish.listAria')}>
          <p className="card-title">{t('wish.listTitle')}</p>
          {isLoading ? (
            <div className="skeleton" style={{ height: 120 }} role="status" />
          ) : (data ?? []).length === 0 ? (
            <p className="empty">{t('wish.empty')}</p>
          ) : (
            <Stagger className="grid" style={{ gap: 10 }}>
              <AnimatePresence initial={false}>
                {(data ?? []).map((item) => (
                  <WishlistCard
                    key={item.id}
                    item={item}
                    mutations={mutations}
                    notify={setFeedback}
                  />
                ))}
              </AnimatePresence>
            </Stagger>
          )}
        </MotionCard>
      </Stagger>
    </Shell>
  );
}
