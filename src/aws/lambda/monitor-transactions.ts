import { DynamoDBClient, ScanCommand, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { Alchemy, Network, AssetTransfersCategory } from 'alchemy-sdk';
import axios from 'axios';

// Initialize clients
const dynamoDb = new DynamoDBClient({ region: process.env.AWS_REGION });
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

  if (event.source === 'aws.events' && event.detail.type === 'Scheduled Event') {
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
 * Scan all addresses in DynamoDB and check for new transactions
 */
async function scanAllAddresses(): Promise<void> {
  const scanParams = {
    TableName: process.env.DEPOSIT_ADDRESSES_TABLE,
  };

  const result = await dynamoDb.send(new ScanCommand(scanParams));

  if (!result.Items || result.Items.length === 0) {
    console.log('No addresses to monitor');
    return;
  }

  // Process each address in parallel
  await Promise.all(
    result.Items.map(async (item) => {
      const address = item.address.S;
      const network = item.network.S;
      if (address && network) {
        await monitorAddress(address, network);
      } else {
        console.warn(`Skipping item with missing address or network:`, item);
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

  // Get the last processed block from DynamoDB
  const addressData = await getAddressData(address);
  const lastProcessedBlock = addressData?.lastProcessedBlock?.N
    ? parseInt(addressData.lastProcessedBlock.N)
    : 0;

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

  // Get the last processed transaction from DynamoDB
  const addressData = await getAddressData(address);
  const processedTxs = addressData?.processedTransactions?.SS || [];

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
 * Get address data from DynamoDB
 */
async function getAddressData(address: string): Promise<any> {
  const params = {
    TableName: process.env.DEPOSIT_ADDRESSES_TABLE,
    Key: {
      address: { S: address.toLowerCase() },
    },
  };

  const result = await dynamoDb.send(new GetItemCommand(params));
  return result.Item;
}

/**
 * Update the last processed block for an address
 */
async function updateLastProcessedBlock(address: string, blockNumber: number): Promise<void> {
  const params = {
    TableName: process.env.DEPOSIT_ADDRESSES_TABLE,
    Key: {
      address: { S: address.toLowerCase() },
    },
    UpdateExpression: 'SET lastProcessedBlock = :block',
    ExpressionAttributeValues: {
      ':block': { N: blockNumber.toString() },
    },
  };

  await dynamoDb.send(new UpdateItemCommand(params));
}

/**
 * Add a transaction to the processed transactions list
 */
async function addProcessedTransaction(address: string, txHash: string): Promise<void> {
  const params = {
    TableName: process.env.DEPOSIT_ADDRESSES_TABLE,
    Key: {
      address: { S: address.toLowerCase() },
    },
    UpdateExpression: 'ADD processedTransactions :tx',
    ExpressionAttributeValues: {
      ':tx': { SS: [txHash] },
    },
  };

  await dynamoDb.send(new UpdateItemCommand(params));
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