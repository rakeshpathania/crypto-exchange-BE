# Crypto Deposit System Architecture

## Overview

This system monitors blockchain transactions for user-specific wallet addresses and processes deposits automatically.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  User Interface │────▶│  NestJS Backend │────▶│  AWS Services   │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Blockchain     │◀───▶│  Lambda         │◀───▶│  DynamoDB       │
│  (ETH, BTC)     │     │  Functions      │     │  Tables         │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Components

1. **DynamoDB Tables**
   - `deposit-addresses`: Maps blockchain addresses to users and assets

2. **Lambda Functions**
   - `monitor-transactions`: Polls blockchain for new transactions
   - `api-handler`: Processes deposits and updates user balances

3. **EventBridge**
   - Schedules regular monitoring of addresses
   - Routes events between components

4. **SNS**
   - Sends notifications for deposits and errors

## Flow

1. User requests a deposit address
2. System generates address and stores mapping in DynamoDB
3. EventBridge schedules monitoring for the address
4. Lambda function checks for transactions periodically
5. When transaction is detected, it's verified and processed
6. User balance is updated via API call to backend
7. Notification is sent via SNS

## Security Considerations

- API authentication using API keys
- DynamoDB encryption at rest
- IAM roles with least privilege
- Transaction verification with multiple confirmations
- Idempotent processing to prevent duplicate credits

## Scaling Considerations

- DynamoDB auto-scaling for high throughput
- Lambda concurrency for parallel processing
- EventBridge for decoupling components
- Monitoring and alerting for system health