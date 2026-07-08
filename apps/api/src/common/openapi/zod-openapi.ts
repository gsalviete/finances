import type { ApiResponseSchemaHost } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';

/** Tipo de schema aceito pelos decorators do Swagger, derivado do export público. */
type SwaggerSchemaObject = ApiResponseSchemaHost['schema'];

/**
 * OpenAPI derivado da mesma fonte de verdade (ADR-014): converte o schema Zod
 * do contrato em SchemaObject do Swagger. Nunca redeclarar contratos à mão.
 */
export function zodToOpenApiSchema(
  schema: ZodType,
  io: 'input' | 'output' = 'input',
): SwaggerSchemaObject {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, {
    unrepresentable: 'any',
    io,
  });
  return jsonSchema as SwaggerSchemaObject;
}
