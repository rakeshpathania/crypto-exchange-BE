import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { CryptoDepositService } from './crypto-deposit.service';
import { CryptoNetwork } from '../db/entities/deposit.entity';

@ApiTags('Blockchain Webhooks')
@Controller('webhooks/blockchain')
export class BlockchainWebhookController {
  constructor(
    private cryptoDepositService: CryptoDepositService,
  ) {}

  @ApiOperation({ summary: 'Handle blockchain transaction webhook' })
  @ApiResponse({ status: 200, description: 'Transaction processed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiHeader({ name: 'x-api-key', description: 'API key for webhook authentication' })
  @Post('transaction')
  async handleBlockchainTransaction(
    @Headers('x-api-key') apiKey: string,
    @Body() transactionData: {
      txHash: string;
      address: string;
      amount: string;
      network: CryptoNetwork;
    },
  ): Promise<{ success: boolean; message: string }> {
    if (!apiKey || !this.verifyApiKey(apiKey, process.env.BLOCKCHAIN_WEBHOOK_API_KEY || '')) {
      throw new UnauthorizedException('Invalid API key');
    }

    try {
      await this.cryptoDepositService.handleIncomingTransaction(
        transactionData.txHash,
        transactionData.address,
        transactionData.amount,
        transactionData.network
      );
      
      return { 
        success: true, 
        message: `Transaction ${transactionData.txHash} processed successfully` 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Error processing transaction: ${error.message}` 
      };
    }
  }

  /**
   * Verify API key using constant-time comparison to prevent timing attacks
   */
  private verifyApiKey(providedKey: string, actualKey: string): boolean {
    if (!providedKey || !actualKey || providedKey.length !== actualKey.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < providedKey.length; i++) {
      result |= providedKey.charCodeAt(i) ^ actualKey.charCodeAt(i);
    }
    
    return result === 0;
  }
}