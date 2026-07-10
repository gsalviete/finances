'use client';

/** Categorias (FR-021–024): customizáveis, arquiváveis, nunca perdem histórico. */
import { useState } from 'react';
import { Archive, ArchiveRestore, Plus, Trash2 } from 'lucide-react';
import { Shell } from '../../components/layout/Shell';
import { AnimatePresence, MotionCard, Stagger, StaggerItem } from '../../components/motion';
import { useCategories, useCategoryMutations } from '../../features/queries';
import { ApiError } from '../../lib/api-client';

const COLOR_TOKENS = [
  'category-green',
  'category-blue',
  'category-purple',
  'category-orange',
  'category-pink',
  'category-yellow',
  'category-red',
];

export default function CategoriesPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading } = useCategories(showArchived);
  const { create, update, remove } = useCategoryMutations();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_TOKENS[0] as string);
  const [feedback, setFeedback] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    try {
      await create.mutateAsync({ name, icon: 'tag', color });
      setName('');
      setFeedback('Categoria criada.');
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.message : 'Erro ao criar');
    }
  };

  const removeCategory = async (id: string, categoryName: string) => {
    if (!window.confirm(`Excluir a categoria "${categoryName}"?`)) return;
    try {
      await remove.mutateAsync(id);
      setFeedback('Categoria excluída (soft delete).');
    } catch (error) {
      // ADR-016: em uso → oriente a arquivar
      setFeedback(error instanceof ApiError ? error.message : 'Erro ao excluir');
    }
  };

  return (
    <Shell>
      <Stagger className="grid">
        <MotionCard interactive={false} aria-label="Nova categoria">
          <p style={{ margin: '0 0 12px', fontWeight: 600 }}>Nova categoria</p>
          <form onSubmit={submit} className="row" style={{ flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="cat-name">Nome</label>
              <input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={60}
              />
            </div>
            <div className="field">
              <label htmlFor="cat-color">Cor</label>
              <select id="cat-color" value={color} onChange={(e) => setColor(e.target.value)}>
                {COLOR_TOKENS.map((token) => (
                  <option key={token} value={token}>
                    {token.replace('category-', '')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ justifyContent: 'end' }}>
              <button type="submit" className="btn btn-primary" disabled={create.isPending}>
                <Plus size={15} aria-hidden /> Criar
              </button>
            </div>
          </form>
          {feedback && (
            <p className="muted" role="status" style={{ margin: '10px 0 0', fontSize: 13 }}>
              {feedback}
            </p>
          )}
        </MotionCard>

        <MotionCard interactive={false} aria-label="Lista de categorias">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Categorias</p>
            <label className="row" style={{ gap: 6, fontSize: 13.5 }}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Mostrar arquivadas
            </label>
          </div>
          {isLoading ? (
            <div className="skeleton" style={{ height: 100 }} role="status" />
          ) : (data ?? []).length === 0 ? (
            <p className="empty">Nenhuma categoria — crie a primeira acima.</p>
          ) : (
            <Stagger className="grid" style={{ gap: 8 }}>
              <AnimatePresence initial={false}>
                {(data ?? []).map((category) => (
                  <StaggerItem
                    key={category.id}
                    layout
                    exit={{ opacity: 0, x: -12 }}
                    className="row"
                    style={{ justifyContent: 'space-between' }}
                  >
                    <span className="row">
                      <span
                        aria-hidden
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          background: `var(--${category.color.replace('category.', 'category-')})`,
                        }}
                      />
                      {category.name}
                      {category.archived && <span className="badge badge-neutral">arquivada</span>}
                      {category.expiresAt !== null && (
                        <span className="badge badge-warning">temporária</span>
                      )}
                    </span>
                    <span className="row">
                      <button
                        type="button"
                        className="btn"
                        aria-label={category.archived ? 'Restaurar' : 'Arquivar'}
                        title={category.archived ? 'Restaurar' : 'Arquivar'}
                        onClick={() =>
                          update.mutate({
                            id: category.id,
                            input: { archived: !category.archived },
                          })
                        }
                      >
                        {category.archived ? (
                          <ArchiveRestore size={14} aria-hidden />
                        ) : (
                          <Archive size={14} aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        aria-label="Excluir"
                        title="Excluir"
                        onClick={() => removeCategory(category.id, category.name)}
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </span>
                  </StaggerItem>
                ))}
              </AnimatePresence>
            </Stagger>
          )}
        </MotionCard>
      </Stagger>
    </Shell>
  );
}
