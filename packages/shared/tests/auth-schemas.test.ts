import { authSessionSchema, loginInputSchema, registerInputSchema } from '../src';

describe('contratos de autenticação', () => {
  it('registerInput aceita entrada válida', () => {
    const parsed = registerInputSchema.parse({
      name: 'Gabriel',
      email: 'gsalviete@gmail.com',
      password: 'senha-super-segura',
    });
    expect(parsed.email).toBe('gsalviete@gmail.com');
  });

  it('registerInput rejeita senha curta, email inválido e nome vazio', () => {
    const base = { name: 'G', email: 'g@x.com', password: 'senha-ok-123' };
    expect(registerInputSchema.safeParse({ ...base, password: 'curta' }).success).toBe(false);
    expect(registerInputSchema.safeParse({ ...base, email: 'nao-email' }).success).toBe(false);
    expect(registerInputSchema.safeParse({ ...base, name: '  ' }).success).toBe(false);
  });

  it('loginInput exige email válido e senha presente', () => {
    expect(loginInputSchema.safeParse({ email: 'g@x.com', password: 'x' }).success).toBe(true);
    expect(loginInputSchema.safeParse({ email: 'g@x.com', password: '' }).success).toBe(false);
    expect(loginInputSchema.safeParse({ email: 'x', password: 'x' }).success).toBe(false);
  });

  it('authSession nunca aceita passwordHash dentro de user (derivado de safeUserSchema)', () => {
    expect(Object.keys(authSessionSchema.shape.user.shape)).not.toContain('passwordHash');
  });
});
