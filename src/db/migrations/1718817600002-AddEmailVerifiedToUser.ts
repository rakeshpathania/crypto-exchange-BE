import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailVerifiedToUser1718817600002 implements MigrationInterface {
    name = 'AddEmailVerifiedToUser1718817600002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN "email_verified" boolean NOT NULL DEFAULT false
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verified"`);
    }
}