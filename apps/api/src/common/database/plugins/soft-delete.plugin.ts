import type { Query, Schema } from 'mongoose';

/**
 * Soft delete (ADR-010, DATABASE §1): toda leitura filtra `deletedAt: null`
 * por padrão. Para incluir deletados, o chamador pede explicitamente:
 *   query.setOptions({ withDeleted: true })  ou filtro contendo `deletedAt`.
 * Aplicado apenas às coleções que possuem soft delete no contrato.
 */
export function softDeletePlugin(schema: Schema): void {
  function applyDefaultFilter(this: Query<unknown, unknown>): void {
    if (this.getOptions().withDeleted === true) return;
    const filter = this.getFilter();
    if (!('deletedAt' in filter)) {
      this.where({ deletedAt: null });
    }
  }

  schema.pre('find', applyDefaultFilter);
  schema.pre('findOne', applyDefaultFilter);
  schema.pre('findOneAndUpdate', applyDefaultFilter);
  schema.pre('countDocuments', applyDefaultFilter);
  schema.pre('aggregate', function () {
    const withDeleted = (this.options as Record<string, unknown>).withDeleted === true;
    const touchesDeletedAt = this.pipeline().some(
      (stage) => '$match' in stage && stage.$match !== null && 'deletedAt' in stage.$match,
    );
    if (!withDeleted && !touchesDeletedAt) {
      this.pipeline().unshift({ $match: { deletedAt: null } });
    }
  });
}
