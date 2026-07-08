import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  authSessionSchema,
  loginInputSchema,
  registerInputSchema,
  safeUserSchema,
  type AuthSession,
  type LoginInput,
  type RegisterInput,
  type SafeUser,
} from '@finances/shared';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/jwt-payload.schema';
import { zodToOpenApiSchema } from '../../common/openapi/zod-openapi';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Cria o usuário único da V1 e devolve a sessão' })
  @ApiBody({ schema: zodToOpenApiSchema(registerInputSchema) })
  @ApiCreatedResponse({ schema: zodToOpenApiSchema(authSessionSchema, 'output') })
  register(
    @Body(new ZodValidationPipe(registerInputSchema)) input: RegisterInput,
  ): Promise<AuthSession> {
    return this.authService.register(input);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Autentica e devolve a sessão' })
  @ApiBody({ schema: zodToOpenApiSchema(loginInputSchema) })
  @ApiOkResponse({ schema: zodToOpenApiSchema(authSessionSchema, 'output') })
  login(@Body(new ZodValidationPipe(loginInputSchema)) input: LoginInput): Promise<AuthSession> {
    return this.authService.login(input);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuário autenticado da sessão' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(safeUserSchema, 'output') })
  me(@CurrentUser() user: AuthenticatedUser): Promise<SafeUser> {
    return this.authService.me(user.userId);
  }
}
