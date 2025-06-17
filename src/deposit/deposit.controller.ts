import { Controller, Post, Body, Get, Param, UseGuards, Request, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DepositService } from './deposit.service';
import { StripeService } from './stripe.service';
import { CardDepositDto } from './dto/card-deposit.dto';
import { CryptoDepositDto } from './dto/crypto-deposit.dto';
import { Deposit, CryptoNetwork } from '../db/entities/deposit.entity';

@ApiTags('Deposits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('deposits')
export class DepositController {
  constructor(
    private depositService: DepositService,
    private stripeService: StripeService,
  ) {}

  @ApiOperation({ summary: 'Initiate a card deposit' })
  @ApiResponse({ status: 201, description: 'Card deposit initiated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('card')
  async initiateCardDeposit(
    @Request() req,
    @Body() depositData: CardDepositDto,
  ) {
    return this.depositService.initiateCardDeposit(req.user.userId, depositData);
  }

  @ApiOperation({ summary: 'Create a setup intent for saving payment methods' })
  @ApiResponse({ status: 201, description: 'Setup intent created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('setup-intent')
  async createSetupIntent(@Request() req) {
    return this.stripeService.createSetupIntent(req.user.userId);
  }

  @ApiOperation({ summary: 'Get saved payment methods' })
  @ApiResponse({ status: 200, description: 'Payment methods retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('payment-methods')
  async getPaymentMethods(@Request() req) {
    return this.stripeService.listPaymentMethods(req.user.userId);
  }

  @ApiOperation({ summary: 'Initiate a crypto deposit' })
  @ApiResponse({ status: 201, description: 'Crypto deposit initiated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('crypto')
  async initiateCryptoDeposit(
    @Request() req,
    @Body() depositData: CryptoDepositDto,
  ) {
    return this.depositService.initiateCryptoDeposit(req.user.userId, depositData);
  }

  @ApiOperation({ summary: 'Confirm a deposit' })
  @ApiResponse({ status: 200, description: 'Deposit confirmed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Deposit not found' })
  @Post(':id/confirm')
  async confirmDeposit(@Param('id') id: string): Promise<Deposit> {
    return this.depositService.confirmDeposit(id);
  }

  @ApiOperation({ summary: 'Get user deposits' })
  @ApiResponse({ status: 200, description: 'User deposits retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  async getUserDeposits(@Request() req): Promise<Deposit[]> {
    return this.depositService.getUserDeposits(req.user.userId);
  }


}