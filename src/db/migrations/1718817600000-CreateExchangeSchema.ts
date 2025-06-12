import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExchangeSchema1718817600000 implements MigrationInterface {
  name = 'CreateExchangeSchema1718817600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TYPE "public"."users_kyc_status_enum" AS ENUM('pending', 'verified', 'rejected');
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "kyc_status" "public"."users_kyc_status_enum" NOT NULL DEFAULT 'pending',
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create wallets table
    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "network" character varying NOT NULL,
        "address" character varying NOT NULL,
        "private_key_encrypted" character varying NOT NULL,
        CONSTRAINT "PK_wallets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_wallets_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create assets table
    await queryRunner.query(`
      CREATE TABLE "assets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "symbol" character varying NOT NULL,
        "name" character varying NOT NULL,
        "network" character varying NOT NULL,
        "contract_address" character varying,
        "decimals" integer NOT NULL,
        CONSTRAINT "PK_assets" PRIMARY KEY ("id")
      )
    `);

    // Create balances table
    await queryRunner.query(`
      CREATE TABLE "balances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "asset_id" uuid NOT NULL,
        "balance" decimal(36,18) NOT NULL,
        CONSTRAINT "PK_balances" PRIMARY KEY ("id"),
        CONSTRAINT "FK_balances_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_balances_assets" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE
      )
    `);

    // Create orders table
    await queryRunner.query(`
      CREATE TYPE "public"."orders_side_enum" AS ENUM('buy', 'sell');
      CREATE TYPE "public"."orders_type_enum" AS ENUM('limit', 'market', 'stop');
      CREATE TYPE "public"."orders_status_enum" AS ENUM('open', 'partial', 'filled', 'cancelled');
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "asset_pair" character varying NOT NULL,
        "side" "public"."orders_side_enum" NOT NULL,
        "type" "public"."orders_type_enum" NOT NULL,
        "price" decimal(36,18),
        "amount" decimal(36,18) NOT NULL,
        "filled" decimal(36,18) NOT NULL DEFAULT 0,
        "status" "public"."orders_status_enum" NOT NULL DEFAULT 'open',
        CONSTRAINT "PK_orders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_orders_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create trades table
    await queryRunner.query(`
      CREATE TABLE "trades" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "order_id" uuid NOT NULL,
        "contra_order_id" uuid NOT NULL,
        "price" decimal(36,18) NOT NULL,
        "amount" decimal(36,18) NOT NULL,
        "fee" decimal(36,18) NOT NULL,
        "timestamp" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_trades" PRIMARY KEY ("id"),
        CONSTRAINT "FK_trades_orders" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_trades_contra_orders" FOREIGN KEY ("contra_order_id") REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);

    // Create deposits table
    await queryRunner.query(`
      CREATE TYPE "public"."deposits_status_enum" AS ENUM('pending', 'confirmed', 'failed');
      CREATE TABLE "deposits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "asset_id" uuid NOT NULL,
        "tx_hash" character varying NOT NULL,
        "amount" decimal(36,18) NOT NULL,
        "status" "public"."deposits_status_enum" NOT NULL DEFAULT 'pending',
        "network" character varying NOT NULL,
        CONSTRAINT "PK_deposits" PRIMARY KEY ("id"),
        CONSTRAINT "FK_deposits_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_deposits_assets" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE
      )
    `);

    // Create withdrawals table
    await queryRunner.query(`
      CREATE TYPE "public"."withdrawals_status_enum" AS ENUM('pending', 'broadcast', 'confirmed', 'failed');
      CREATE TABLE "withdrawals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "asset_id" uuid NOT NULL,
        "tx_hash" character varying,
        "to_address" character varying NOT NULL,
        "amount" decimal(36,18) NOT NULL,
        "fee" decimal(36,18) NOT NULL,
        "status" "public"."withdrawals_status_enum" NOT NULL DEFAULT 'pending',
        "network" character varying NOT NULL,
        CONSTRAINT "PK_withdrawals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_withdrawals_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_withdrawals_assets" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE
      )
    `);

    // Create fiat_transactions table
    await queryRunner.query(`
      CREATE TYPE "public"."fiat_transactions_type_enum" AS ENUM('fiat_deposit', 'fiat_withdrawal');
      CREATE TYPE "public"."fiat_transactions_status_enum" AS ENUM('pending', 'completed', 'failed');
      CREATE TABLE "fiat_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "type" "public"."fiat_transactions_type_enum" NOT NULL,
        "amount" decimal(36,18) NOT NULL,
        "currency" character varying NOT NULL,
        "status" "public"."fiat_transactions_status_enum" NOT NULL DEFAULT 'pending',
        "provider" character varying NOT NULL,
        CONSTRAINT "PK_fiat_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_fiat_transactions_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create notifications table
    await queryRunner.query(`
      CREATE TYPE "public"."notifications_type_enum" AS ENUM('email', 'sms', 'push');
      CREATE TYPE "public"."notifications_status_enum" AS ENUM('queued', 'sent', 'failed');
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "type" "public"."notifications_type_enum" NOT NULL,
        "message" text NOT NULL,
        "sent_at" TIMESTAMP NOT NULL,
        "status" "public"."notifications_status_enum" NOT NULL DEFAULT 'queued',
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);

    await queryRunner.query(`DROP TABLE "fiat_transactions"`);
    await queryRunner.query(`DROP TYPE "public"."fiat_transactions_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."fiat_transactions_type_enum"`);

    await queryRunner.query(`DROP TABLE "withdrawals"`);
    await queryRunner.query(`DROP TYPE "public"."withdrawals_status_enum"`);

    await queryRunner.query(`DROP TABLE "deposits"`);
    await queryRunner.query(`DROP TYPE "public"."deposits_status_enum"`);

    await queryRunner.query(`DROP TABLE "trades"`);

    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."orders_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."orders_side_enum"`);

    await queryRunner.query(`DROP TABLE "balances"`);
    await queryRunner.query(`DROP TABLE "assets"`);
    await queryRunner.query(`DROP TABLE "wallets"`);

    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_kyc_status_enum"`);
  }
}