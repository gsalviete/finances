import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { jwtPayloadSchema, type AuthenticatedUser } from './jwt-payload.schema';

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };

/**
 * Authentication (quem é): valida o Bearer token e anexa o usuário à requisição.
 * Authorization (o que pode) permanece nas queries por userId — separação
 * explícita mesmo com um único usuário (ARCHITECTURE §7).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) {
      throw new UnauthorizedException('Token de acesso ausente');
    }
    try {
      const payload = jwtPayloadSchema.parse(await this.jwtService.verifyAsync(token));
      request.user = { userId: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado');
    }
  }
}
