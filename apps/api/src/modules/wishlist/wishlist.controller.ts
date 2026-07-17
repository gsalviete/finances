import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  createWishlistItemInputSchema,
  updateWishlistItemInputSchema,
  wishlistItemSchema,
  type CreateWishlistItemInput,
  type UpdateWishlistItemInput,
  type WishlistItem,
} from '@finances/shared';
import { z } from 'zod';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/jwt-payload.schema';
import { zodToOpenApiSchema } from '../../common/openapi/zod-openapi';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { WishlistService } from './wishlist.service';

@ApiTags('wishlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra item por URL; extrai nome/preço/imagem (ADR-018)' })
  @ApiBody({ schema: zodToOpenApiSchema(createWishlistItemInputSchema) })
  @ApiCreatedResponse({ schema: zodToOpenApiSchema(wishlistItemSchema, 'output') })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createWishlistItemInputSchema)) input: CreateWishlistItemInput,
  ): Promise<WishlistItem> {
    return this.wishlistService.create(user.userId, input);
  }

  @Get()
  @ApiOperation({ summary: 'Lista itens por prioridade (HIGH→LOW), depois mais recentes' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(z.array(wishlistItemSchema), 'output') })
  list(@CurrentUser() user: AuthenticatedUser): Promise<WishlistItem[]> {
    return this.wishlistService.list(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um item da wishlist' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(wishlistItemSchema, 'output') })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<WishlistItem> {
    return this.wishlistService.get(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edição manual — corrige o que a extração não trouxe' })
  @ApiBody({ schema: zodToOpenApiSchema(updateWishlistItemInputSchema) })
  @ApiOkResponse({ schema: zodToOpenApiSchema(wishlistItemSchema, 'output') })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWishlistItemInputSchema)) input: UpdateWishlistItemInput,
  ): Promise<WishlistItem> {
    return this.wishlistService.update(user.userId, id, input);
  }

  @Post(':id/refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Re-executa a extração e atualiza o snapshot (ADR-018)' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(wishlistItemSchema, 'output') })
  refresh(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<WishlistItem> {
    return this.wishlistService.refresh(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft delete (ADR-010)' })
  @ApiNoContentResponse({ description: 'Item soft-deletado' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.wishlistService.softDelete(user.userId, id);
  }
}
