import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailVerifiedToUser1718817600002 implements MigrationInterface {
    name = 'AddEmailVerifiedToUser1718817600002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'email_verified'
                ) THEN
                    ALTER TABLE "users" 
                    ADD COLUMN "email_verified" boolean NOT NULL DEFAULT false;
                END IF;
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verified"`);
    }
}