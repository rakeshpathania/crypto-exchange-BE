import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepositController } from './deposit.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { DepositService } from './deposit.service';
import { Deposit } from '../db/entities/deposit.entity';
import { User } from '../db/entities/user.entity';
import { Asset } from '../db/entities/asset.entity';
import { Balance } from '../db/entities/balance.entity';
import { StripeService } from './stripe.service';
import { CryptoDepositService } from './crypto-deposit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deposit, User, Asset, Balance]),
  ],
  controllers: [DepositController, StripeWebhookController],
  providers: [DepositService, StripeService, CryptoDepositService],
  exports: [DepositService],
})
export class DepositModule {}