import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import axios from 'axios';

// Initialize clients
const dynamoDb = new DynamoDBClient({ region: process.env.AWS_REGION });
const sns = new SNSClient({ region: process.env.AWS_REGION });

// API endpoint
const API_ENDPOINT = process.env.API_ENDPOINT;
const API_KEY = process.env.API_KEY;

/**
 * Lambda function to handle API requests for deposit processing
 */
export const handler = async (event: any): Promise<any> => {
  console.log('Event received:', JSON.stringify(event));

  if (event.action === 'processDeposit') {
    await processDeposit(event.data);
  }

  return { statusCode: 200, body: 'Success' };
};

/**
 * Process a deposit transaction
 */
async function processDeposit(data: {
  txHash: string;
  address: string;
  amount: string;
  network: string;
}): Promise<void> {
  try {
    // Get user mapping from DynamoDB
    const addressData = await getAddressData(data.address);
    
    if (!addressData) {
      console.error('Address not found in mapping table:', data.address);
      return;
    }

    const userId = addressData.userId.S;
    const assetId = addressData.assetId.S;

    // Verify transaction on blockchain
    const isValid = await verifyTransaction(data.txHash, data.address, data.amount, data.network);
    
    if (!isValid) {
      console.error('Transaction verification failed:', data.txHash);
      await sendNotification('Transaction verification failed', {
        txHash: data.txHash,
        address: data.address,
        amount: data.amount,
        network: data.network,
      });
      return;
    }

    // Call backend API to create and confirm deposit
    await updateUserBalance(userId, assetId, data.amount, data.txHash, data.network, data.address);

    // Send notification
    await sendNotification('Deposit received', {
      userId,
      assetId,
      amount: data.amount,
      txHash: data.txHash,
      network: data.network,
    });

    console.log(`Deposit processed for user ${userId}, asset ${assetId}, amount ${data.amount}`);
  } catch (error) {
    console.error('Error processing deposit:', error);
    await sendNotification('Error processing deposit', {
      error: error.message,
      data,
    });
  }
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
 * Verify transaction on blockchain
 */
async function verifyTransaction(
  txHash: string,
  address: string,
  amount: string,
  network: string
): Promise<boolean> {
  try {
    if (network === 'ETHEREUM') {
      // For Ethereum, use Etherscan API
      const response = await axios.get(
        `https://api.etherscan.io/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=${process.env.ETHERSCAN_API_KEY}`
      );
      
      // Check if transaction was successful
      if (response.data.result.status !== '1') {
        return false;
      }
      
      // Check confirmations (could add more verification here)
      return true;
    } else if (network === 'BITCOIN') {
      // For Bitcoin, use Blockchair API
      const response = await axios.get(
        `https://api.blockchair.com/bitcoin/dashboards/transaction/${txHash}?key=${process.env.BLOCKCHAIR_API_KEY}`
      );
      
      const confirmations = response.data.data[txHash].transaction.confirmations;
      return confirmations >= 3; // Require at least 3 confirmations
    }
    
    return false;
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return false;
  }
}

/**
 * Update user balance via API call
 */
async function updateUserBalance(
  userId: string,
  assetId: string,
  amount: string,
  txHash: string,
  network: string,
  address: string
): Promise<void> {
  try {
    // Call the blockchain transaction webhook endpoint
    const response = await axios.post(
      `${API_ENDPOINT}/webhooks/blockchain/transaction`,
      {
        txHash,
        address,
        amount,
        network,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
      }
    );
    
    if (!response.data.success) {
      throw new Error(`API error: ${response.data.message}`);
    }
    
    console.log('Transaction processed via API:', response.data.message);
  } catch (error) {
    console.error('Error processing blockchain transaction:', error);
    throw error;
  }
}

/**
 * Send notification via SNS
 */
async function sendNotification(subject: string, message: any): Promise<void> {
  const params = {
    TopicArn: process.env.NOTIFICATION_TOPIC_ARN,
    Subject: subject,
    Message: JSON.stringify(message, null, 2),
  };

  await sns.send(new PublishCommand(params));
}