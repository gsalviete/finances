import { Types } from 'mongoose';

/**
 * Conversão documento Mongo → forma do contrato (ADR-014):
 * - ObjectId → string (recursivo, inclui subdocumentos embutidos);
 * - `_id` → `id`; `__v` descartado;
 * - Dates preservados (o schema Zod do contrato os valida na saída).
 * Nenhuma camada acima da persistência conhece ObjectId.
 */
export function fromMongoDocument(value: unknown): unknown {
  if (value instanceof Types.ObjectId) return value.toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(fromMongoDocument);
  if (isPlainObject(value)) {
    const converted: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === '__v') continue;
      converted[key === '_id' ? 'id' : key] = fromMongoDocument(entry);
    }
    return converted;
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}
