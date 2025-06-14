import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRolesToUser1718817600004 implements MigrationInterface {
    name = 'AddRolesToUser1718817600004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'roles'
                ) THEN
                    ALTER TABLE "users" 
                    ADD COLUMN "roles" text NOT NULL DEFAULT 'user';
                END IF;
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN IF EXISTS "roles"
        `);
    }
}