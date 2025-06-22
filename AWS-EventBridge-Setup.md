# AWS EventBridge Setup for Crypto Exchange

This guide provides step-by-step instructions to set up AWS EventBridge resources for the crypto exchange backend.

## Prerequisites

- AWS CLI installed and configured
- AWS account with appropriate permissions
- Replace `YOUR_ACCOUNT_ID` with your actual AWS account ID

## 1. Create Custom Event Bus

```bash
aws events create-event-bus --name crypto-events-dev --region us-east-1
```

## 2. Create SNS Topic for Notifications

```bash
aws sns create-topic --name crypto-deposit-notifications-dev --region us-east-1
```

## 3. Create EventBridge Rules

### Rule 1: Schedule Rule for Address Monitoring (Default Bus)
```bash
aws events put-rule \
  --name crypto-address-monitor-schedule \
  --schedule-expression "rate(5 minutes)" \
  --state ENABLED \
  --region us-east-1
```

### Rule 2: Transaction Processing Rule (Custom Bus)
```bash
aws events put-rule \
  --name crypto-transaction-processor \
  --event-pattern '{"source":["custom.crypto.transaction"],"detail-type":["TransactionDetected"]}' \
  --state ENABLED \
  --event-bus-name crypto-events-dev \
  --region us-east-1
```

### Rule 3: Address Monitoring Rule (Custom Bus)
```bash
aws events put-rule \
  --name crypto-address-monitor \
  --event-pattern '{"source":["custom.crypto.deposit"],"detail-type":["AddressMonitoring"]}' \
  --state ENABLED \
  --event-bus-name crypto-events-dev \
  --region us-east-1
```

## 4. Create Lambda Functions

```bash
# Create monitor-transactions Lambda
aws lambda create-function \
  --function-name crypto-monitor-transactions \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://monitor-transactions.zip \
  --region us-east-1

# Create api-handler Lambda
aws lambda create-function \
  --function-name crypto-api-handler \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://api-handler.zip \
  --region us-east-1
```

## 5. Add Lambda Targets to EventBridge Rules

```bash
# Add monitor Lambda to schedule rule (default bus)
aws events put-targets \
  --rule crypto-address-monitor-schedule \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:crypto-monitor-transactions" \
  --region us-east-1

# Add monitor Lambda to address monitoring rule (custom bus)
aws events put-targets \
  --rule crypto-address-monitor \
  --event-bus-name crypto-events-dev \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:crypto-monitor-transactions" \
  --region us-east-1

# Add API handler Lambda to transaction processing rule (custom bus)
aws events put-targets \
  --rule crypto-transaction-processor \
  --event-bus-name crypto-events-dev \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:crypto-api-handler" \
  --region us-east-1
```

## 6. Grant EventBridge Permission to Invoke Lambda

```bash
# Permission for monitor Lambda (default bus)
aws lambda add-permission \
  --function-name crypto-monitor-transactions \
  --statement-id allow-eventbridge-default \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:YOUR_ACCOUNT_ID:rule/crypto-address-monitor-schedule \
  --region us-east-1

# Permission for monitor Lambda (custom bus)
aws lambda add-permission \
  --function-name crypto-monitor-transactions \
  --statement-id allow-eventbridge-custom \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:YOUR_ACCOUNT_ID:rule/crypto-events-dev/* \
  --region us-east-1

# Permission for API handler Lambda (custom bus)
aws lambda add-permission \
  --function-name crypto-api-handler \
  --statement-id allow-eventbridge \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:YOUR_ACCOUNT_ID:rule/crypto-events-dev/* \
  --region us-east-1
```

## 7. Update Environment Variables

Update your `.env` file with the following values:

```env
EVENT_BUS_NAME=crypto-events-dev
NOTIFICATION_TOPIC_ARN=arn:aws:sns:us-east-1:YOUR_ACCOUNT_ID:crypto-deposit-notifications-dev
API_LAMBDA_NAME=crypto-api-handler
```

## 8. Test the Setup

```bash
# Test event publishing to custom bus
aws events put-events \
  --entries '[{"Source":"custom.crypto.deposit","DetailType":"AddressMonitoring","Detail":"{\"address\":\"0x123\",\"network\":\"ETHEREUM\",\"type\":\"MONITOR_ADDRESS\"}","EventBusName":"crypto-events-dev"}]' \
  --region us-east-1

# Test transaction event
aws events put-events \
  --entries '[{"Source":"custom.crypto.transaction","DetailType":"TransactionDetected","Detail":"{\"txHash\":\"0xabc123\",\"address\":\"0x123\",\"amount\":\"0.1\",\"network\":\"ETHEREUM\"}","EventBusName":"crypto-events-dev"}]' \
  --region us-east-1
```

## Architecture Overview

- **Event Bus**: `crypto-events-dev` - Central hub for all crypto-related events
- **Schedule Rule**: Triggers address monitoring every 5 minutes
- **Transaction Rule**: Processes detected blockchain transactions
- **Address Rule**: Handles new address monitoring requests
- **SNS Topic**: Sends notifications for deposit events

## Event Flow

1. User generates deposit address → EventBridge event triggered
2. Scheduled Lambda monitors all addresses every 5 minutes
3. New transactions detected → Transaction processing event
4. API handler processes transaction → Updates user balance
5. SNS notification sent to user

This setup provides a scalable, event-driven architecture for monitoring crypto deposits automatically.