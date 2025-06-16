import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameStripeCustomerIdToSnakeCase1718817600005 implements MigrationInterface {
    name = 'RenameStripeCustomerIdToSnakeCase1718817600005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First check if the column exists with camelCase naming
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'stripeCustomerId'
                ) THEN
                    -- Rename the column to follow snake_case convention
                    ALTER TABLE "users" RENAME COLUMN "stripeCustomerId" TO "stripe_customer_id";
                ELSIF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'stripe_customer_id'
                ) THEN
                    -- If neither column exists, add the new column with snake_case naming
                    ALTER TABLE "users" ADD COLUMN "stripe_customer_id" varchar NULL;
                END IF;
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert back to the original column name if it exists
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'stripe_customer_id'
                ) THEN
                    ALTER TABLE "users" RENAME COLUMN "stripe_customer_id" TO "stripeCustomerId";
                END IF;
            END
            $$;
        `);
    }
}