import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Deposit, DepositStatus, CryptoNetwork } from '../db/entities/deposit.entity';
import { CryptoDepositService } from './crypto-deposit.service';
import { Alchemy, Network, AssetTransfersCategory } from 'alchemy-sdk';
import axios from 'axios';

@Injectable()
export class CryptoMonitoringService {
  private readonly logger = new Logger(CryptoMonitoringService.name);
  private alchemy: Alchemy;

  constructor(
    @InjectRepository(Deposit)
    private depositRepository: Repository<Deposit>,
    private cryptoDepositService: CryptoDepositService,
  ) {
    // Initialize Alchemy for Ethereum monitoring
    const alchemySettings = {
      apiKey: process.env.ALCHEMY_API_KEY,
      network: Network.ETH_MAINNET,
    };
    this.alchemy = new Alchemy(alchemySettings);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async monitorAllAddresses() {
    this.logger.log('Starting scheduled address monitoring...');
    
    try {
      // Get all pending deposits with crypto addresses
      const pendingDeposits = await this.depositRepository.find({
        where: { 
          cryptoAddress: Not(IsNull()),
          status: DepositStatus.PENDING 
        },
        select: ['id', 'cryptoAddress', 'network', 'lastProcessedBlock', 'processedTransactions']
      });

      if (pendingDeposits.length === 0) {
        this.logger.log('No addresses to monitor');
        return;
      }

      this.logger.log(`Monitoring ${pendingDeposits.length} addresses`);

      // Process addresses in parallel with limited concurrency
      const batchSize = 5;
      for (let i = 0; i < pendingDeposits.length; i += batchSize) {
        const batch = pendingDeposits.slice(i, i + batchSize);
        await Promise.all(
          batch.map(deposit => this.monitorAddress(deposit))
        );
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < pendingDeposits.length) {
          await this.delay(1000);
        }
      }

      this.logger.log('Completed scheduled address monitoring');
    } catch (error) {
      this.logger.error('Error in scheduled monitoring:', error);
    }
  }

  private async monitorAddress(deposit: Deposit): Promise<void> {
    try {
      if (deposit.network === 'ETHEREUM' || deposit.network === 'ethereum') {
        await this.monitorEthereumAddress(deposit);
      } else if (deposit.network === 'BITCOIN' || deposit.network === 'bitcoin') {
        await this.monitorBitcoinAddress(deposit);
      }
    } catch (error) {
      this.logger.error(`Error monitoring address ${deposit.cryptoAddress}:`, error);
    }
  }

  private async monitorEthereumAddress(deposit: Deposit): Promise<void> {
    const address = deposit.cryptoAddress;
    const lastProcessedBlock = deposit.lastProcessedBlock || 0;

    // Get recent transactions for this address
    const transactions = await this.alchemy.core.getAssetTransfers({
      fromBlock: `0x${lastProcessedBlock.toString(16)}`,
      toAddress: address,
      category: [AssetTransfersCategory.EXTERNAL, AssetTransfersCategory.INTERNAL],
      withMetadata: true,
      maxCount: 50,
    });

    let newTransactions = 0;
    let latestBlock = lastProcessedBlock;

    for (const tx of transactions.transfers) {
      const blockNumber = parseInt(tx.blockNum, 16);
      
      // Skip if already processed
      if (blockNumber <= lastProcessedBlock) continue;
      
      // Skip if transaction hash already processed
      if (deposit.processedTransactions?.includes(tx.hash)) continue;

      // Verify transaction has enough confirmations
      const currentBlock = await this.alchemy.core.getBlockNumber();
      const confirmations = currentBlock - blockNumber;
      
      if (confirmations < 12) {
        this.logger.log(`Transaction ${tx.hash} has only ${confirmations} confirmations, waiting...`);
        continue;
      }

      // Process the transaction
      if (tx.to?.toLowerCase() === address.toLowerCase() && tx.value && parseFloat(tx.value.toString()) > 0) {
        this.logger.log(`New Ethereum transaction detected: ${tx.hash} for ${tx.value} ETH`);
        
        await this.cryptoDepositService.handleIncomingTransaction(
          tx.hash,
          address,
          tx.value.toString(),
          CryptoNetwork.ETHEREUM
        );

        // Update processed transactions
        await this.updateProcessedTransaction(deposit.id, tx.hash);
        newTransactions++;
      }

      latestBlock = Math.max(latestBlock, blockNumber);
    }

    // Update last processed block if we found new transactions
    if (latestBlock > lastProcessedBlock) {
      await this.updateLastProcessedBlock(deposit.id, latestBlock);
    }

    if (newTransactions > 0) {
      this.logger.log(`Processed ${newTransactions} new transactions for address ${address}`);
    }
  }

  private async monitorBitcoinAddress(deposit: Deposit): Promise<void> {
    const address = deposit.cryptoAddress;
    const processedTxs = deposit.processedTransactions || [];

    try {
      // Get address transactions from Blockchair
      const response = await axios.get(
        `https://api.blockchair.com/bitcoin/dashboards/address/${address}`,
        {
          params: {
            key: process.env.BLOCKCHAIR_API_KEY,
            limit: 50
          }
        }
      );

      const addressData = response.data.data[address];
      if (!addressData || !addressData.transactions) {
        return;
      }

      let newTransactions = 0;

      for (const txHash of addressData.transactions) {
        // Skip if already processed
        if (processedTxs.includes(txHash)) continue;

        // Get transaction details
        const txResponse = await axios.get(
          `https://api.blockchair.com/bitcoin/raw/transaction/${txHash}`,
          {
            params: { key: process.env.BLOCKCHAIR_API_KEY }
          }
        );

        const tx = txResponse.data.data[txHash];
        if (!tx) continue;

        // Check confirmations
        if (tx.confirmations < 3) {
          this.logger.log(`Bitcoin transaction ${txHash} has only ${tx.confirmations} confirmations, waiting...`);
          continue;
        }

        // Find outputs to our address
        for (const output of tx.vout) {
          if (output.scriptpubkey_address === address && output.value > 0) {
            const btcAmount = (output.value / 100000000).toString(); // Convert satoshis to BTC
            
            this.logger.log(`New Bitcoin transaction detected: ${txHash} for ${btcAmount} BTC`);
            
            await this.cryptoDepositService.handleIncomingTransaction(
              txHash,
              address,
              btcAmount,
              CryptoNetwork.BITCOIN
            );

            await this.updateProcessedTransaction(deposit.id, txHash);
            newTransactions++;
            break;
          }
        }

        // Rate limiting for Bitcoin API
        await this.delay(200);
      }

      if (newTransactions > 0) {
        this.logger.log(`Processed ${newTransactions} new Bitcoin transactions for address ${address}`);
      }
    } catch (error) {
      this.logger.error(`Error monitoring Bitcoin address ${address}:`, error);
    }
  }

  private async updateLastProcessedBlock(depositId: string, blockNumber: number): Promise<void> {
    await this.depositRepository.update(depositId, {
      lastProcessedBlock: blockNumber
    });
  }

  private async updateProcessedTransaction(depositId: string, txHash: string): Promise<void> {
    const deposit = await this.depositRepository.findOne({
      where: { id: depositId },
      select: ['processedTransactions']
    });

    if (deposit) {
      const processedTxs = deposit.processedTransactions || [];
      if (!processedTxs.includes(txHash)) {
        processedTxs.push(txHash);
        await this.depositRepository.update(depositId, {
          processedTransactions: processedTxs
        });
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Manual trigger for testing
  async triggerManualScan(): Promise<{ message: string; addressesScanned: number }> {
    this.logger.log('Manual scan triggered');
    
    const pendingDeposits = await this.depositRepository.find({
      where: { 
        cryptoAddress: Not(IsNull()),
        status: DepositStatus.PENDING 
      }
    });

    await Promise.all(
      pendingDeposits.map(deposit => this.monitorAddress(deposit))
    );

    return {
      message: 'Manual scan completed',
      addressesScanned: pendingDeposits.length
    };
  }
}