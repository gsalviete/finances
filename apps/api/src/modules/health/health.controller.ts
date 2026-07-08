import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { systemClock } from '@finances/shared';
import { Connection } from 'mongoose';

/** Health/liveness/readiness (ARCHITECTURE §3). Readiness verifica o MongoDB de fato. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOperation({ summary: 'Estado geral da API' })
  @ApiOkResponse({ description: 'API operacional' })
  health(): { status: 'ok'; uptimeSeconds: number; timestamp: string } {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: systemClock.now().toISOString(),
    };
  }

  @Get('liveness')
  @ApiOperation({ summary: 'Processo vivo' })
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Pronto para receber tráfego (inclui ping real no MongoDB)' })
  async readiness(): Promise<{ status: 'ok'; mongo: 'up' }> {
    const ready = this.connection.readyState === 1;
    if (!ready || this.connection.db === undefined) {
      throw new ServiceUnavailableException('MongoDB indisponível');
    }
    try {
      await this.connection.db.admin().ping();
    } catch {
      throw new ServiceUnavailableException('MongoDB não respondeu ao ping');
    }
    return { status: 'ok', mongo: 'up' };
  }
}
