import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  safeUserSchema,
  type AuthSession,
  type LoginInput,
  type RegisterInput,
  type SafeUser,
  type User,
} from '@finances/shared';
import * as argon2 from 'argon2';
import { UsersRepository } from '../users/repository/users.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  /** V1 opera com um único usuário: o segundo registro é rejeitado. */
  async register(input: RegisterInput): Promise<AuthSession> {
    if ((await this.usersRepository.count()) > 0) {
      throw new ConflictException('A V1 opera com um único usuário; registro já realizado');
    }
    const passwordHash = await argon2.hash(input.password);
    const user = await this.usersRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
    });
    return this.toSession(user);
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const user = await this.usersRepository.findByEmail(input.email);
    // mesma mensagem para usuário inexistente e senha errada (sem enumeração)
    if (user === null || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.toSession(user);
  }

  async me(userId: string): Promise<SafeUser> {
    const user = await this.usersRepository.findById(userId);
    if (user === null) {
      throw new UnauthorizedException('Usuário da sessão não existe mais');
    }
    return safeUserSchema.parse(user);
  }

  private async toSession(user: User): Promise<AuthSession> {
    const accessToken = await this.jwtService.signAsync({ sub: user.id, email: user.email });
    return { accessToken, user: safeUserSchema.parse(user) };
  }
}
