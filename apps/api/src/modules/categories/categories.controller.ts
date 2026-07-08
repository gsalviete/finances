import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
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
  categorySchema,
  createCategoryInputSchema,
  listCategoriesQuerySchema,
  updateCategoryInputSchema,
  type Category,
  type CreateCategoryInput,
  type ListCategoriesQuery,
  type UpdateCategoryInput,
} from '@finances/shared';
import { z } from 'zod';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/jwt-payload.schema';
import { zodToOpenApiSchema } from '../../common/openapi/zod-openapi';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Cria categoria (entra no fim da fila sem sortOrder explícito)' })
  @ApiBody({ schema: zodToOpenApiSchema(createCategoryInputSchema) })
  @ApiCreatedResponse({ schema: zodToOpenApiSchema(categorySchema, 'output') })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCategoryInputSchema)) input: CreateCategoryInput,
  ): Promise<Category> {
    return this.categoriesService.create(user.userId, input);
  }

  @Get()
  @ApiOperation({ summary: 'Lista categorias (padrão: sem arquivadas e sem expiradas)' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(z.array(categorySchema), 'output') })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listCategoriesQuerySchema)) query: ListCategoriesQuery,
  ): Promise<Category[]> {
    return this.categoriesService.list(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma categoria' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(categorySchema, 'output') })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Category> {
    return this.categoriesService.get(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza campos; arquivar/restaurar via `archived` (FR-023/024)' })
  @ApiBody({ schema: zodToOpenApiSchema(updateCategoryInputSchema) })
  @ApiOkResponse({ schema: zodToOpenApiSchema(categorySchema, 'output') })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCategoryInputSchema)) input: UpdateCategoryInput,
  ): Promise<Category> {
    return this.categoriesService.update(user.userId, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft delete (ADR-010); 409 CATEGORY_IN_USE se houver transações' })
  @ApiNoContentResponse({ description: 'Categoria soft-deletada' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.categoriesService.softDelete(user.userId, id);
  }
}
