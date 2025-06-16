import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingColumnsToDeposit1718817600006 implements MigrationInterface {
    name = 'AddMissingColumnsToDeposit1718817600006'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add method column
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'deposits' AND column_name = 'method'
                ) THEN
                    CREATE TYPE "public"."deposit_method_enum" AS ENUM('card', 'crypto');
                    ALTER TABLE "deposits" ADD COLUMN "method" "public"."deposit_method_enum" NOT NULL DEFAULT 'crypto';
                END IF;
            END
            $$;
        `);

        // Add paymentIntentId column
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'deposits' AND column_name = 'payment_intent_id'
                ) THEN
                    ALTER TABLE "deposits" ADD COLUMN "payment_intent_id" varchar NULL;
                END IF;
            END
            $$;
        `);

        // Add cryptoAddress column
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'deposits' AND column_name = 'crypto_address'
                ) THEN
                    ALTER TABLE "deposits" ADD COLUMN "crypto_address" varchar NULL;
                END IF;
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop columns in reverse order
        await queryRunner.query(`ALTER TABLE "deposits" DROP COLUMN IF EXISTS "crypto_address"`);
        await queryRunner.query(`ALTER TABLE "deposits" DROP COLUMN IF EXISTS "payment_intent_id"`);
        await queryRunner.query(`ALTER TABLE "deposits" DROP COLUMN IF EXISTS "method"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."deposit_method_enum"`);
    }
}