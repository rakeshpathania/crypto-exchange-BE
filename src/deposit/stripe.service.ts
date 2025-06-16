import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { CardDepositDto } from './dto/card-deposit.dto';
import { User } from '../db/entities/user.entity';
import { Asset } from '../db/entities/asset.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_your_key', {
      apiVersion: '2025-05-28.basil',
    });
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_your_webhook_secret';
  }

  async getOrCreateCustomer(user: User): Promise<string> {
    // If user already has a Stripe customer ID, return it
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Create a new customer in Stripe
    const customer = await this.stripe.customers.create({
      email: user.email,
      metadata: {
        userId: user.id,
      },
    });

    // Save the customer ID to the user record
    user.stripeCustomerId = customer.id;
    await this.userRepository.save(user);

    return customer.id;
  }

  async createPaymentIntent(userId: string, depositData: CardDepositDto): Promise<{ clientSecret: string, paymentIntentId: string, cryptoAmount?: number }> {
    // Get user and ensure they have a Stripe customer ID
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    const customerId = await this.getOrCreateCustomer(user);

    // Create a payment method from the token
    const paymentMethod = await this.stripe.paymentMethods.create({
      type: 'card',
      card: {
        token: depositData.cardToken,
      },
    });

    // Attach the payment method to the customer
    await this.stripe.paymentMethods.attach(paymentMethod.id, {
      customer: customerId,
    });

    // Calculate equivalent crypto amount if assetId is provided
    let cryptoAmount;
    if (depositData.assetId) {
      try {
        cryptoAmount = await this.convertInrToCrypto(depositData.amount, depositData.assetId);
      } catch (error) {
        console.error('Failed to calculate crypto amount:', error);
        // Continue with payment even if conversion fails
      }
    }

    // Create a payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(depositData.amount * 100), // Convert to cents
      currency: 'inr',
      customer: customerId,
      payment_method: paymentMethod.id,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never', // 🚫 Disable redirect-based methods
      },
      metadata: {
        userId,
        assetId: depositData.assetId,
        cryptoAmount: cryptoAmount ? cryptoAmount.toString() : undefined,
      },
    });

    if (!paymentIntent.client_secret) {
      throw new Error('Failed to create payment intent: No client secret returned');
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      cryptoAmount,
    };
  }

  async confirmPayment(paymentIntentId: string): Promise<boolean> {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent.status === 'succeeded';
  }

  async createSetupIntent(userId: string): Promise<{ clientSecret: string }> {
    // Get user and ensure they have a Stripe customer ID
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    const customerId = await this.getOrCreateCustomer(user);

    const setupIntent = await this.stripe.setupIntents.create({
      customer: customerId,
      usage: 'off_session',
    });

    if (!setupIntent.client_secret) {
      throw new Error('Failed to create setup intent: No client secret returned');
    }

    return {
      clientSecret: setupIntent.client_secret,
    };
  }

  async listPaymentMethods(userId: string): Promise<Stripe.PaymentMethod[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.stripeCustomerId) {
      return [];
    }

    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
    });

    return paymentMethods.data;
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody.toString(),
      signature,
      this.webhookSecret
    );
  }

  async convertInrToCrypto(amountInr: number, assetId: string): Promise<number> {
    try {
      // Fetch the asset from the database
      const asset = await this.assetRepository.findOne({ where: { id: assetId } });
      if (!asset) {
        throw new Error(`Asset with ID ${assetId} not found`);
      }

      const cryptoSymbol = asset.symbol;

      // Fetch the current exchange rate from a reliable API
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoSymbol.toLowerCase()}&vs_currencies=inr`
      );
      console.log(`Exchange rate for ${cryptoSymbol}:`, response.data);
      // Extract the exchange rate (1 CRYPTO = X INR)
      const exchangeRate = response.data[cryptoSymbol.toLowerCase()]?.inr;

      if (!exchangeRate) {
        throw new Error(`Exchange rate not available for ${cryptoSymbol}`);
      }

      // Calculate the crypto amount (INR amount / exchange rate)
      const cryptoAmount = amountInr / exchangeRate;

      return cryptoAmount;
    } catch (error) {
      console.error('Error converting INR to crypto:', error);
      throw new Error(`Failed to convert INR to crypto: ${error.message}`);
    }
  }
}