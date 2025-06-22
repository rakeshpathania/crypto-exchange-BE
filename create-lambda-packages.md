# Create Lambda Deployment Packages

## 1. Create Monitor Transactions Package

```bash
# Create directory for monitor Lambda
mkdir lambda-monitor
cd lambda-monitor

# Copy your TypeScript file
cp ../src/aws/lambda/monitor-transactions.ts index.ts

# Create directory structure for imports
mkdir -p db/entities
mkdir -p db

# Copy database files
cp ../../src/db/data-source.ts db/data-source.ts
cp ../../src/db/entities db/entities

# Create package.json
cat > package.json << EOF
{
  "name": "crypto-monitor-transactions",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "@aws-sdk/client-eventbridge": "^3.832.0",
    "@aws-sdk/client-lambda": "^3.832.0",
    "alchemy-sdk": "^3.0.0",
    "axios": "^1.6.0",
    "typeorm": "^0.3.0",
    "pg": "^8.11.0"
  } 
}
EOF

# Install dependencies
cd

# Compile TypeScript to JavaScript
npx tsc index.ts --target es2020 --module commonjs --esModuleInterop

# Create zip file
zip -r ../monitor-transactions.zip . -x "*.ts" "node_modules/.cache/*"

cd ..
```

## 2. Create API Handler Package

```bash
# Create directory for API handler Lambda
mkdir lambda-api
cd lambda-api

# Copy your TypeScript file
cp ../src/aws/lambda/api-handler.ts index.ts

# Create package.json
cat > package.json << EOF
{
  "name": "crypto-api-handler",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "@aws-sdk/client-sns": "^3.832.0",
    "axios": "^1.6.0",
    "typeorm": "^0.3.0",
    "pg": "^8.11.0"
  }
}
EOF

# Install dependencies
npm install

# Compile TypeScript to JavaScript
npx tsc index.ts --target es2020 --module commonjs --esModuleInterop

# Create zip file
zip -r ../api-handler.zip . -x "*.ts" "node_modules/.cache/*"

cd ..
```

## 3. Alternative: Use Existing Build

If you have a build process, you can zip your compiled files:

```bash
# Build your project first
npm run build

# Create monitor package
mkdir temp-monitor
cp dist/src/aws/lambda/monitor-transactions.js temp-monitor/index.js
cp -r node_modules temp-monitor/
cd temp-monitor
zip -r ../monitor-transactions.zip .
cd ..
rm -rf temp-monitor

# Create API handler package
mkdir temp-api
cp dist/src/aws/lambda/api-handler.js temp-api/index.js
cp -r node_modules temp-api/
cd temp-api
zip -r ../api-handler.zip .
cd ..
rm -rf temp-api
```

## 4. Simplified Approach (Recommended)

Create a simple build script:

```bash
# Create build-lambda.sh
cat > build-lambda.sh << 'EOF'
#!/bin/bash

# Build monitor Lambda
mkdir -p lambda-build/monitor
cp src/aws/lambda/monitor-transactions.ts lambda-build/monitor/index.ts
cd lambda-build/monitor
npm init -y
npm install @aws-sdk/client-eventbridge @aws-sdk/client-lambda alchemy-sdk axios typeorm pg
npx tsc index.ts --target es2020 --module commonjs --esModuleInterop
zip -r ../../monitor-transactions.zip . -x "*.ts"
cd ../..

# Build API handler Lambda
mkdir -p lambda-build/api
cp src/aws/lambda/api-handler.ts lambda-build/api/index.ts
cd lambda-build/api
npm init -y
npm install @aws-sdk/client-sns axios typeorm pg
npx tsc index.ts --target es2020 --module commonjs --esModuleInterop
zip -r ../../api-handler.zip . -x "*.ts"
cd ../..

# Cleanup
rm -rf lambda-build

echo "Lambda packages created:"
echo "- monitor-transactions.zip"
echo "- api-handler.zip"
EOF

# Make executable and run
chmod +x build-lambda.sh
./build-lambda.sh
```

## What the ZIP files contain:

- **index.js** - Your compiled Lambda function
- **node_modules/** - All required dependencies
- **package.json** - Package configuration

## After creating the ZIP files:

You can then use them in the AWS CLI commands:

```bash
aws lambda create-function \
  --function-name crypto-monitor-transactions \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://monitor-transactions.zip \
  --region us-east-1
```