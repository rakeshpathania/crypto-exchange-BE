#!/bin/bash

# Deploy AWS infrastructure for crypto deposit system

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if environment is provided
if [ -z "$1" ]; then
    ENVIRONMENT="dev"
else
    ENVIRONMENT="$1"
fi

echo "Deploying crypto deposit infrastructure to $ENVIRONMENT environment..."

# Load environment variables
if [ -f .env.$ENVIRONMENT ]; then
    source .env.$ENVIRONMENT
else
    echo ".env.$ENVIRONMENT file not found. Please create it first."
    exit 1
fi

# Package Lambda functions
echo "Packaging Lambda functions..."
mkdir -p dist/aws/lambda

# Build TypeScript files
npx tsc src/aws/lambda/monitor-transactions.ts --outDir dist/aws/lambda --esModuleInterop true
npx tsc src/aws/lambda/api-handler.ts --outDir dist/aws/lambda --esModuleInterop true

# Install dependencies for Lambda functions
cd dist/aws/lambda
npm init -y
npm install @aws-sdk/client-dynamodb @aws-sdk/client-eventbridge @aws-sdk/client-lambda @aws-sdk/client-sns alchemy-sdk axios web3
cd ../../..

# Zip Lambda functions
cd dist/aws/lambda
zip -r monitor-transactions.zip monitor-transactions.js
zip -r api-handler.zip api-handler.js node_modules
cd ../../..

# Deploy CloudFormation stack
echo "Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file src/aws/cloudformation/crypto-deposit-infrastructure.yml \
    --stack-name crypto-deposit-$ENVIRONMENT \
    --parameter-overrides \
        Environment=$ENVIRONMENT \
        ApiEndpoint=$API_ENDPOINT \
        ApiKey=$CRYPTO_WEBHOOK_API_KEY \
        AlchemyApiKey=$ALCHEMY_API_KEY \
        BlockchairApiKey=$BLOCKCHAIR_API_KEY \
        EtherscanApiKey=$ETHERSCAN_API_KEY \
        EthNodeUrl=$ETH_NODE_URL \
        AdminEmail=$ADMIN_EMAIL \
    --capabilities CAPABILITY_NAMED_IAM

# Upload Lambda code
echo "Uploading Lambda functions..."
aws lambda update-function-code \
    --function-name crypto-monitor-transactions-$ENVIRONMENT \
    --zip-file fileb://dist/aws/lambda/monitor-transactions.zip

aws lambda update-function-code \
    --function-name crypto-api-handler-$ENVIRONMENT \
    --zip-file fileb://dist/aws/lambda/api-handler.zip

echo "Deployment completed successfully!"