import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { User } from '@finances/shared';
import * as argon2 from 'argon2';
import { AuthService } from '../src/modules/auth/auth.service';
import type { UsersRepository } from '../src/modules/users/repository/users.repository';

const OID = 'a'.repeat(24);

const buildUser = async (): Promise<User> => ({
  id: OID,
  name: 'Gabriel',
  email: 'g@x.com',
  passwordHash: await argon2.hash('senha-correta-123'),
  createdAt: new Date('2026-07-01T12:00:00.000Z'),
  updatedAt: new Date('2026-07-01T12:00:00.000Z'),
});

interface RepoStub {
  count: jest.Mock;
  create: jest.Mock;
  findByEmail: jest.Mock;
  findById: jest.Mock;
}

const makeService = (repo: Partial<RepoStub>) => {
  const jwt = { signAsync: jest.fn().mockResolvedValue('token-jwt') } as unknown as JwtService;
  return new AuthService(repo as unknown as UsersRepository, jwt);
};

describe('AuthService', () => {
  it('register cria o usuário com hash Argon2 (nunca senha em claro)', async () => {
    const user = await buildUser();
    const create = jest.fn().mockResolvedValue(user);
    const service = makeService({ count: jest.fn().mockResolvedValue(0), create });

    const session = await service.register({
      name: 'Gabriel',
      email: 'g@x.com',
      password: 'senha-correta-123',
    });

    const persisted = create.mock.calls[0]?.[0] as Record<string, string>;
    expect(persisted.passwordHash).toMatch(/^\$argon2/);
    expect(persisted.passwordHash).not.toContain('senha-correta-123');
    expect(persisted).not.toHaveProperty('password');
    expect(session.accessToken).toBe('token-jwt');
    expect(session.user).not.toHaveProperty('passwordHash');
  });

  it('register rejeita segundo usuário (single user V1)', async () => {
    const service = makeService({ count: jest.fn().mockResolvedValue(1) });
    await expect(
      service.register({ name: 'Outro', email: 'o@x.com', password: 'senha-qualquer-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('login com credenciais corretas devolve sessão sem passwordHash', async () => {
    const user = await buildUser();
    const service = makeService({ findByEmail: jest.fn().mockResolvedValue(user) });
    const session = await service.login({ email: 'g@x.com', password: 'senha-correta-123' });
    expect(session.accessToken).toBe('token-jwt');
    expect(session.user).not.toHaveProperty('passwordHash');
  });

  it('login usa a MESMA mensagem para email inexistente e senha errada', async () => {
    const user = await buildUser();
    const missing = makeService({ findByEmail: jest.fn().mockResolvedValue(null) });
    const wrongPass = makeService({ findByEmail: jest.fn().mockResolvedValue(user) });

    const errorMissing = await missing
      .login({ email: 'x@x.com', password: 'qualquer-senha-1' })
      .catch((e: Error) => e);
    const errorWrong = await wrongPass
      .login({ email: 'g@x.com', password: 'senha-errada-123' })
      .catch((e: Error) => e);

    expect(errorMissing).toBeInstanceOf(UnauthorizedException);
    expect(errorWrong).toBeInstanceOf(UnauthorizedException);
    expect((errorMissing as Error).message).toBe((errorWrong as Error).message);
  });

  it('me devolve SafeUser; sessão de usuário inexistente é 401', async () => {
    const user = await buildUser();
    const service = makeService({ findById: jest.fn().mockResolvedValue(user) });
    const safe = await service.me(OID);
    expect(safe).not.toHaveProperty('passwordHash');
    expect(safe.email).toBe('g@x.com');

    const gone = makeService({ findById: jest.fn().mockResolvedValue(null) });
    await expect(gone.me(OID)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
