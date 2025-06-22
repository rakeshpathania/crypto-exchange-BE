import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { Alchemy, Network, AssetTransfersCategory } from 'alchemy-sdk';
import axios from 'axios';
import { Not, IsNull } from 'typeorm';
import dataSource from '../../db/data-source';
import { Deposit } from '../../db/entities/deposit.entity';

// Initialize clients
const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION });
const lambda = new LambdaClient({ region: process.env.AWS_REGION });

// Initialize blockchain providers
const alchemySettings = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
};
const alchemy = new Alchemy(alchemySettings);

// Bitcoin API (using Blockchair)
const BLOCKCHAIR_API_KEY = process.env.BLOCKCHAIR_API_KEY;


/**
 * Type definition for Bitcoin transaction output
 */
type BitcoinTxOutput = {
  value: number;
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
};

/**
 * Lambda function to monitor addresses for incoming transactions
 */
export const handler = async (event: any): Promise<any> => {
  console.log('Event received:', JSON.stringify(event));

  // Handle scheduled events from default bus
  if (event.source === 'aws.events' || event['detail-type'] === 'Scheduled Event') {
    // Scheduled event to scan all addresses
    await scanAllAddresses();
  } else if (event.source === 'custom.crypto.deposit') {
    // Process specific address monitoring request
    const { address, network } = event.detail;
    await monitorAddress(address, network);
  } else if (event.source === 'custom.crypto.transaction') {
    // Process detected transaction
    const { txHash, address, amount, network } = event.detail;
    await processTransaction(txHash, address, amount, network);
  }

  return { statusCode: 200, body: 'Success' };
};

/**
 * Scan all addresses in PostgreSQL and check for new transactions
 */
async function scanAllAddresses(): Promise<void> {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const depositRepo = dataSource.getRepository(Deposit);
  const deposits = await depositRepo.find({
    where: { cryptoAddress: Not(IsNull()) },
    select: ['cryptoAddress', 'network']
  });

  if (deposits.length === 0) {
    console.log('No addresses to monitor');
    return;
  }

  // Process each address in parallel
  await Promise.all(
    deposits.map(async (deposit) => {
      if (deposit.cryptoAddress && deposit.network) {
        await monitorAddress(deposit.cryptoAddress, deposit.network);
      }
    })
  );
}

/**
 * Monitor a specific address for new transactions
 */
async function monitorAddress(address: string, network: string): Promise<void> {
  try {
    if (network === 'ETHEREUM') {
      await monitorEthereumAddress(address);
    } else if (network === 'BITCOIN') {
      await monitorBitcoinAddress(address);
    }
  } catch (error) {
    console.error(`Error monitoring address ${address} on ${network}:`, error);
  }
}

/**
 * Monitor Ethereum address using Alchemy
 */
async function monitorEthereumAddress(address: string): Promise<void> {
  // Get the latest transactions for this address
  const transactions = await alchemy.core.getAssetTransfers({
    fromBlock: "0x0",
    toAddress: address,
    category: [AssetTransfersCategory.EXTERNAL, AssetTransfersCategory.INTERNAL],
    withMetadata: true,
    maxCount: 10,
  });

  // Get the last processed block from PostgreSQL
  const addressData = await getAddressData(address);
  const lastProcessedBlock = addressData?.lastProcessedBlock || 0;

  // Process new transactions
  for (const tx of transactions.transfers) {
    if (parseInt(tx.blockNum) > lastProcessedBlock && tx.to === address.toLowerCase()) {
      // Emit event for transaction processing
      await emitTransactionEvent(
        tx.hash,
        address,
        (tx.value ?? 0).toString(),
        'ETHEREUM'
      );
    }
  }

  // Update the last processed block
  if (transactions.transfers.length > 0) {
    const latestBlock = Math.max(...transactions.transfers.map(tx => parseInt(tx.blockNum)));
    await updateLastProcessedBlock(address, latestBlock);
  }
}


/**
 * Monitor Bitcoin address using Blockchair API
 */
async function monitorBitcoinAddress(address: string): Promise<void> {
  const response = await axios.get(
    `https://api.blockchair.com/bitcoin/dashboards/address/${address}?key=${BLOCKCHAIR_API_KEY}`
  );

  const transactions = response.data.data[address].transactions;

  // Get the last processed transaction from PostgreSQL
  const addressData = await getAddressData(address);
  const processedTxs = addressData?.processedTransactions || [];

  // Process new transactions
  for (const txHash of transactions) {
    if (!processedTxs.includes(txHash)) {
      // Get transaction details
      const txResponse = await axios.get(
        `https://api.blockchair.com/bitcoin/raw/transaction/${txHash}?key=${BLOCKCHAIR_API_KEY}`
      );

      const tx = txResponse.data.data[txHash];

      // Find the output that matches our address
      const output: BitcoinTxOutput | undefined = tx.vout.find((out: BitcoinTxOutput) => out.scriptpubkey_address === address);

      if (output) {
        // Emit event for transaction processing
        await emitTransactionEvent(
          txHash,
          address,
          (output.value / 100000000).toString(), // Convert satoshis to BTC
          'BITCOIN'
        );

        // Add to processed transactions
        await addProcessedTransaction(address, txHash);
      }
    }
  }
}

/**
 * Process a detected transaction
 */
async function processTransaction(
  txHash: string,
  address: string,
  amount: string,
  network: string
): Promise<void> {
  // Invoke the API Lambda to update user balance
  const payload = {
    action: 'processDeposit',
    data: {
      txHash,
      address,
      amount,
      network,
    },
  };

  await lambda.send(new InvokeCommand({
    FunctionName: process.env.API_LAMBDA_NAME,
    InvocationType: 'Event',
    Payload: Buffer.from(JSON.stringify(payload)),
  }));
}

/**
 * Get address data from PostgreSQL
 */
async function getAddressData(address: string): Promise<Deposit | null> {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const depositRepo = dataSource.getRepository(Deposit);
  return await depositRepo.findOne({
    where: { cryptoAddress: address.toLowerCase() }
  });
}

/**
 * Update the last processed block for an address
 */
async function updateLastProcessedBlock(address: string, blockNumber: number): Promise<void> {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const depositRepo = dataSource.getRepository(Deposit);
  await depositRepo.update(
    { cryptoAddress: address.toLowerCase() },
    { lastProcessedBlock: blockNumber }
  );
}

/**
 * Add a transaction to the processed transactions list
 */
async function addProcessedTransaction(address: string, txHash: string): Promise<void> {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const depositRepo = dataSource.getRepository(Deposit);
  const deposit = await depositRepo.findOne({
    where: { cryptoAddress: address.toLowerCase() }
  });
  
  if (deposit) {
    deposit.processedTransactions = [...(deposit.processedTransactions || []), txHash];
    await depositRepo.save(deposit);
  }
}

/**
 * Emit an event for transaction processing
 */
async function emitTransactionEvent(
  txHash: string,
  address: string,
  amount: string,
  network: string
): Promise<void> {
  const params = {
    Entries: [{
      Source: 'custom.crypto.transaction',
      DetailType: 'TransactionDetected',
      Detail: JSON.stringify({
        txHash,
        address,
        amount,
        network,
        timestamp: new Date().toISOString(),
      }),
      EventBusName: process.env.EVENT_BUS_NAME,
    }],
  };

  await eventBridge.send(new PutEventsCommand(params));
}