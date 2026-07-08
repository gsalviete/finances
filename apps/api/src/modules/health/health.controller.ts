import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { systemClock } from '@finances/shared';

/**
 * Health mínimo da Fase 7 (health/readiness/liveness — ARCHITECTURE §3).
 * O readiness passa a verificar o MongoDB na Fase 8 (camada de persistência).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
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
  @ApiOperation({ summary: 'Pronto para receber tráfego (Mongo entra na Fase 8)' })
  readiness(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
