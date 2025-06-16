import { Controller, Post, Headers, Body, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { DepositService } from './deposit.service';
import { StripeService } from './stripe.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deposit, DepositStatus } from '../db/entities/deposit.entity';

@ApiTags('Stripe Webhooks')
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private stripeService: StripeService,
    private depositService: DepositService,
    @InjectRepository(Deposit)
    private depositRepository: Repository<Deposit>,
  ) {}

  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @Post()
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!signature) {
      return { received: false, error: 'Missing stripe-signature header' };
    }

    try {
      if (!req.rawBody) {
        return { received: false, error: 'Missing raw body in request' };
      }
      const event = this.stripeService.constructWebhookEvent(
        req.rawBody,
        signature,
      );
      console.log(event, "stripe event received");
      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object);
          break;
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      return { received: true };
    } catch (err) {
      console.error('Webhook error:', err.message);
      return { received: false, error: err.message };
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: any) {
    console.log(paymentIntent, "payment intent succeeded");
    const deposit = await this.depositRepository.findOne({
      where: { paymentIntentId: paymentIntent.id },
    });

    if (!deposit) {
      console.error(`Deposit not found for payment intent: ${paymentIntent.id}`);
      return;
    }

    if (deposit.status !== DepositStatus.PENDING) {
      console.log(`Deposit ${deposit.id} already processed`);
      return;
    }

    await this.depositService.confirmDeposit(deposit.id);
    console.log(`Deposit ${deposit.id} confirmed via webhook`);
  }

  private async handlePaymentIntentFailed(paymentIntent: any) {
    const deposit = await this.depositRepository.findOne({
      where: { paymentIntentId: paymentIntent.id },
    });

    if (!deposit) {
      console.error(`Deposit not found for payment intent: ${paymentIntent.id}`);
      return;
    }

    deposit.status = DepositStatus.FAILED;
    await this.depositRepository.save(deposit);
    console.log(`Deposit ${deposit.id} marked as failed via webhook`);
  }
}