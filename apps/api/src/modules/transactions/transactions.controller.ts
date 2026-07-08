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
  createInstallmentPurchaseInputSchema,
  createTransactionInputSchema,
  listTransactionsQuerySchema,
  transactionListPageSchema,
  transactionSchema,
  updateTransactionInputSchema,
  type CreateInstallmentPurchaseInput,
  type CreateTransactionInput,
  type ListTransactionsQuery,
  type Transaction,
  type UpdateTransactionInput,
} from '@finances/shared';
import { z } from 'zod';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/jwt-payload.schema';
import { zodToOpenApiSchema } from '../../common/openapi/zod-openapi';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { InstallmentService } from './services/installment.service';
import { TransactionsService, type TransactionPageResponse } from './transactions.service';

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly installmentService: InstallmentService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria transação manual (FR-014); nasce FORECAST ou CONFIRMED' })
  @ApiBody({ schema: zodToOpenApiSchema(createTransactionInputSchema) })
  @ApiCreatedResponse({ schema: zodToOpenApiSchema(transactionSchema, 'output') })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTransactionInputSchema)) input: CreateTransactionInput,
  ): Promise<Transaction> {
    return this.transactionsService.create(user.userId, input);
  }

  @Post('installments')
  @ApiOperation({ summary: 'Compra parcelada: materializa N parcelas com soma exata (FR-016)' })
  @ApiBody({ schema: zodToOpenApiSchema(createInstallmentPurchaseInputSchema) })
  @ApiCreatedResponse({ schema: zodToOpenApiSchema(z.array(transactionSchema), 'output') })
  createInstallments(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createInstallmentPurchaseInputSchema))
    input: CreateInstallmentPurchaseInput,
  ): Promise<Transaction[]> {
    return this.installmentService.createPurchase(user.userId, input);
  }

  @Get()
  @ApiOperation({ summary: 'Lista paginada por cursor (date desc, id desc) com filtros' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(transactionListPageSchema, 'output') })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listTransactionsQuerySchema)) query: ListTransactionsQuery,
  ): Promise<TransactionPageResponse> {
    return this.transactionsService.list(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma transação' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(transactionSchema, 'output') })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Transaction> {
    return this.transactionsService.get(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza; confirma (FORECAST→CONFIRMED) ou cancela (→CANCELLED)' })
  @ApiBody({ schema: zodToOpenApiSchema(updateTransactionInputSchema) })
  @ApiOkResponse({ schema: zodToOpenApiSchema(transactionSchema, 'output') })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTransactionInputSchema)) input: UpdateTransactionInput,
  ): Promise<Transaction> {
    return this.transactionsService.update(user.userId, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft delete (FR-019/ADR-010)' })
  @ApiNoContentResponse({ description: 'Transação soft-deletada' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.transactionsService.softDelete(user.userId, id);
  }
}
