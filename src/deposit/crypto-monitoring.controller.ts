import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CryptoMonitoringService } from './crypto-monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Crypto Monitoring')
@Controller('crypto/monitoring')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CryptoMonitoringController {
  constructor(
    private cryptoMonitoringService: CryptoMonitoringService,
  ) {}

  @ApiOperation({ summary: 'Manually trigger address monitoring scan' })
  @ApiResponse({ status: 200, description: 'Scan completed successfully' })
  @Post('scan')
  async triggerManualScan(): Promise<{ message: string; addressesScanned: number }> {
    return await this.cryptoMonitoringService.triggerManualScan();
  }

  @ApiOperation({ summary: 'Get monitoring service status' })
  @ApiResponse({ status: 200, description: 'Service status retrieved' })
  @Get('status')
  async getMonitoringStatus(): Promise<{ status: string; message: string }> {
    return {
      status: 'active',
      message: 'Crypto monitoring service is running with scheduled tasks every 2 minutes'
    };
  }
}