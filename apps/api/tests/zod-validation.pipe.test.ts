import { BadRequestException } from '@nestjs/common';
import { registerInputSchema } from '@finances/shared';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(registerInputSchema);

  it('devolve o valor parseado quando válido', () => {
    const input = { name: 'G', email: 'g@x.com', password: 'senha-valida-123' };
    expect(pipe.transform(input)).toEqual(input);
  });

  it('erro de validação vira BadRequest com issues (path + mensagem do contrato)', () => {
    try {
      pipe.transform({ name: '', email: 'inválido', password: 'curta' });
      fail('deveria ter lançado');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const body = (error as BadRequestException).getResponse() as {
        message: string;
        issues: Array<{ path: string; message: string }>;
      };
      expect(body.message).toBe('Dados de entrada inválidos');
      expect(body.issues.map((issue) => issue.path).sort()).toEqual(['email', 'name', 'password']);
      expect(body.issues.find((i) => i.path === 'password')?.message).toBe(
        'senha deve ter no mínimo 8 caracteres',
      );
    }
  });
});
