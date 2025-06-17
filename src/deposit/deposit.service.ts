import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deposit, DepositMethod, DepositStatus, CryptoNetwork } from '../db/entities/deposit.entity';
import { User } from '../db/entities/user.entity';
import { Asset } from '../db/entities/asset.entity';
import { Balance } from '../db/entities/balance.entity';
import { CardDepositDto } from './dto/card-deposit.dto';
import { CryptoDepositDto } from './dto/crypto-deposit.dto';
import { StripeService } from './stripe.service';
import { CryptoDepositService } from './crypto-deposit.service';

@Injectable()
export class DepositService {
  constructor(
    @InjectRepository(Deposit)
    private depositRepository: Repository<Deposit>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,
    private stripeService: StripeService,
    private cryptoDepositService: CryptoDepositService,
  ) {}

  async initiateCardDeposit(userId: string, depositData: CardDepositDto): Promise<{ clientSecret: string, depositId: string, estimatedCryptoAmount?: number }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const asset = await this.assetRepository.findOne({ where: { id: depositData.assetId } });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const { clientSecret, paymentIntentId, cryptoAmount } = await this.stripeService.createPaymentIntent(userId, depositData);

    const deposit = this.depositRepository.create({
      user,
      userId,
      asset,
      assetId: depositData.assetId,
      amount: depositData.amount,
      status: DepositStatus.PENDING,
      method: DepositMethod.CARD,
      paymentIntentId,
    });
    console.log(deposit, "deposit created");
    await this.depositRepository.save(deposit);

    return {
      clientSecret,
      depositId: deposit.id,
      estimatedCryptoAmount: cryptoAmount
    };
  }

  async initiateCryptoDeposit(userId: string, depositData: CryptoDepositDto): Promise<{ address: string, network: CryptoNetwork, fee: number, depositId: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const asset = await this.assetRepository.findOne({ where: { id: depositData.assetId } });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const cryptoAddress = await this.cryptoDepositService.generateDepositAddress(
      userId,
      depositData.assetId,
      depositData.network,
    );

    const deposit = this.depositRepository.create({
      user,
      userId,
      asset,
      assetId: depositData.assetId,
      amount: depositData.amount,
      status: DepositStatus.PENDING,
      method: DepositMethod.CRYPTO,
      network: depositData.network,
      cryptoAddress,
    });

    await this.depositRepository.save(deposit);

    const networkFee = this.cryptoDepositService.getNetworkFee(depositData.network);

    return {
      address: cryptoAddress,
      network: depositData.network,
      fee: networkFee,
      depositId: deposit.id,
    };
  }

  async confirmDeposit(depositId: string): Promise<Deposit> {
    const deposit = await this.depositRepository.findOne({ 
      where: { id: depositId },
      relations: ['user', 'asset'],
    });

    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    if (deposit.status !== DepositStatus.PENDING) {
      throw new BadRequestException('Deposit is not in pending status');
    }

    let cryptoAmount = deposit.amount;
    
    if (deposit.method === DepositMethod.CARD && deposit.paymentIntentId) {
      // Get payment intent details including metadata
      const paymentIntent = await this.stripeService.getPaymentIntent(deposit.paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        throw new BadRequestException('Payment failed');
      }
      
      // Get crypto amount from payment intent metadata if available
      if (paymentIntent.metadata?.cryptoAmount) {
        cryptoAmount = parseFloat(paymentIntent.metadata.cryptoAmount);
      }
    }

    // Update deposit status
    deposit.status = DepositStatus.CONFIRMED;
    await this.depositRepository.save(deposit);

    // Update user balance with crypto amount
    await this.updateUserBalance(deposit.userId, deposit.assetId, cryptoAmount);

    return deposit;
  }

  private async updateUserBalance(userId: string, assetId: string, amount: number): Promise<void> {
    let balance = await this.balanceRepository.findOne({
      where: { userId, assetId },
    });

    if (!balance) {
      balance = this.balanceRepository.create({
        userId,
        assetId,
        balance: 0,
      });
    }

    // Add the amount to the user's balance
    balance.balance += amount;
    await this.balanceRepository.save(balance);
  }

  async getUserDeposits(userId: string): Promise<Deposit[]> {
    return this.depositRepository.find({
      where: { userId },
      relations: ['asset'],
      order: { createdAt: 'DESC' },
    });
  }

  async createCryptoDeposit(data: {
    userId: string;
    assetId: string;
    amount: number;
    txHash: string;
    network: CryptoNetwork;
  }): Promise<Deposit> {
    const user = await this.userRepository.findOne({ where: { id: data.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const asset = await this.assetRepository.findOne({ where: { id: data.assetId } });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Check if this transaction has already been processed
    const existingDeposit = await this.depositRepository.findOne({
      where: { txHash: data.txHash }
    });

    if (existingDeposit) {
      return existingDeposit; // Prevent duplicate processing
    }

    // Create new deposit record
    const deposit = this.depositRepository.create({
      user,
      userId: data.userId,
      asset,
      assetId: data.assetId,
      amount: data.amount,
      status: DepositStatus.PENDING,
      method: DepositMethod.CRYPTO,
      network: data.network,
      txHash: data.txHash,
    });

    await this.depositRepository.save(deposit);
    return deposit;
  }
}