import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deposit, DepositStatus, CryptoNetwork } from '../db/entities/deposit.entity';
import { Asset } from '../db/entities/asset.entity';
import { Balance } from '../db/entities/balance.entity';
import { 
  DynamoDBClient, 
  PutItemCommand,
  GetItemCommand 
} from '@aws-sdk/client-dynamodb';
import { 
  EventBridgeClient, 
  PutEventsCommand 
} from '@aws-sdk/client-eventbridge';
import { Web3 } from 'web3';
import { Alchemy, Network } from 'alchemy-sdk';

@Injectable()
export class CryptoDepositService {
  private dynamoDb: DynamoDBClient;
  private eventBridge: EventBridgeClient;
  private alchemy: Alchemy;
  private web3: Web3;

  constructor(
    @InjectRepository(Deposit)
    private depositRepository: Repository<Deposit>,
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
  ) {
    // Initialize AWS clients
    this.dynamoDb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION });

    // Initialize Alchemy SDK for Ethereum
    const alchemySettings = {
      apiKey: process.env.ALCHEMY_API_KEY,
      network: Network.ETH_MAINNET,
    };
    this.alchemy = new Alchemy(alchemySettings);

    // Initialize Web3 for direct blockchain interaction
    this.web3 = new Web3(process.env.ETH_NODE_URL);
  }

  async generateDepositAddress(
    userId: string,
    assetId: string,
    network: CryptoNetwork,
  ): Promise<string> {
    try {
      let address: string;
      
      // Generate address based on network
      if (network === CryptoNetwork.ETHEREUM) {
        const account = this.web3.eth.accounts.create();
        address = account.address;
      } else if (network === CryptoNetwork.BITCOIN) {
        // For Bitcoin, you would integrate with a Bitcoin library or service
        // This is a placeholder - implement actual Bitcoin address generation
        throw new Error('Bitcoin address generation not implemented');
      } else {
        throw new Error(`Unsupported network: ${network}`);
      }

      console.log(`Generated ${network} address ${address} for user ${userId}`);

      // Store the address mapping in DynamoDB
      await this.dynamoDb.send(new PutItemCommand({
        TableName: process.env.DEPOSIT_ADDRESSES_TABLE,
        Item: {
          address: { S: address.toLowerCase() },
          userId: { S: userId },
          assetId: { S: assetId },
          network: { S: network },
          createdAt: { N: Date.now().toString() },
          lastProcessedBlock: { N: '0' },
          processedTransactions: { SS: [] },
        },
      }));

      // Set up blockchain monitoring for this address
      await this.setupAddressMonitoring(address, network);

      return address;
    } catch (error) {
      console.error(`Error generating deposit address: ${error.message}`);
      throw new Error(`Failed to generate deposit address: ${error.message}`);
    }
  }

  private async setupAddressMonitoring(address: string, network: CryptoNetwork): Promise<void> {
    // Create an EventBridge rule to trigger Lambda function periodically
    const ruleParams = {
      Entries: [{
        Source: 'custom.crypto.deposit',
        DetailType: 'AddressMonitoring',
        Detail: JSON.stringify({
          address,
          network,
          type: 'MONITOR_ADDRESS',
        }),
        EventBusName: process.env.EVENT_BUS_NAME,
      }],
    };

    await this.eventBridge.send(new PutEventsCommand(ruleParams));
  }

  async handleIncomingTransaction(
    txHash: string,
    address: string,
    amount: string,
    network: CryptoNetwork,
  ): Promise<void> {
    try {
      console.log(`Processing transaction ${txHash} for address ${address}`);
      
      // Check if transaction already processed
      const existingDeposit = await this.depositRepository.findOne({
        where: { txHash }
      });
      
      if (existingDeposit) {
        console.log(`Transaction ${txHash} already processed, skipping`);
        return;
      }
      
      // Verify transaction on blockchain
      const isValid = await this.verifyTransaction(txHash, address, amount, network);
      if (!isValid) {
        console.error(`Transaction verification failed for ${txHash}`);
        return;
      }
      
      // Get user mapping from DynamoDB
      const addressData = await this.dynamoDb.send(new GetItemCommand({
        TableName: process.env.DEPOSIT_ADDRESSES_TABLE,
        Key: {
          address: { S: address.toLowerCase() },
        },
      }));

      if (!addressData.Item) {
        console.error('Address not found in mapping table:', address);
        return;
      }

      const userId = addressData.Item.userId?.S;
      const assetId = addressData.Item.assetId?.S;

      if (!userId || !assetId) {
        console.error('userId or assetId is undefined for address:', address);
        return;
      }

      // Create deposit record
      const deposit = this.depositRepository.create({
        userId,
        assetId,
        amount: parseFloat(amount),
        status: DepositStatus.PENDING,
        network,
        txHash,
        cryptoAddress: address,
      });

      await this.depositRepository.save(deposit);
      console.log(`Deposit record created for transaction ${txHash}`);

      // Update user balance
      await this.updateUserBalance(userId, assetId, parseFloat(amount));
      
      // Update deposit status to CONFIRMED
      deposit.status = DepositStatus.CONFIRMED;
      await this.depositRepository.save(deposit);
      
      console.log(`Deposit ${deposit.id} confirmed and user balance updated for user ${userId}`);
    } catch (error) {
      console.error(`Error handling transaction ${txHash}: ${error.message}`);
      throw error;
    }
  }
  
  private async verifyTransaction(
    txHash: string,
    address: string,
    amount: string,
    network: CryptoNetwork,
  ): Promise<boolean> {
    try {
      if (network === CryptoNetwork.ETHEREUM) {
        // For Ethereum, verify using Alchemy
        const txInfo = await this.alchemy.core.getTransactionReceipt(txHash);
        
        // Check confirmations (wait for at least 12 confirmations)
        if (!txInfo || !txInfo.blockNumber) {
          console.log(`Transaction ${txHash} not confirmed yet`);
          return false;
        }
        
        const currentBlock = await this.alchemy.core.getBlockNumber();
        const confirmations = currentBlock - txInfo.blockNumber;
        
        if (confirmations < 12) {
          console.log(`Transaction ${txHash} has only ${confirmations} confirmations, waiting for more`);
          return false;
        }
        
        // Check transaction status
        if (txInfo.status === 0) {
          console.error(`Transaction ${txHash} failed on blockchain`);
          return false;
        }
        
        return true;
      } else if (network === CryptoNetwork.BITCOIN) {
        // For Bitcoin, you would implement verification using a Bitcoin API
        // This is a placeholder - implement actual Bitcoin transaction verification
        console.log(`Bitcoin transaction verification not implemented for ${txHash}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error verifying transaction ${txHash}: ${error.message}`);
      return false;
    }
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

    balance.balance += amount;
    await this.balanceRepository.save(balance);
  }

  getNetworkFee(network: CryptoNetwork): number {
    // Return estimated network fee based on current gas prices
    // This is a placeholder - implement actual gas estimation logic
    return 0.0001;
  }
}