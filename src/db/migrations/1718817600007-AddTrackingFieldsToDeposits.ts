import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrackingFieldsToDeposits1718817600007 implements MigrationInterface {
  name = 'AddTrackingFieldsToDeposits1718817600007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "deposits" 
      ADD COLUMN "last_processed_block" bigint DEFAULT '0'
    `);

    await queryRunner.query(`
      ALTER TABLE "deposits" 
      ADD COLUMN "processed_transactions" text array DEFAULT '{}'
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_deposits_crypto_address" ON "deposits" ("crypto_address")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_deposits_crypto_address"`);
    await queryRunner.query(`ALTER TABLE "deposits" DROP COLUMN "processed_transactions"`);
    await queryRunner.query(`ALTER TABLE "deposits" DROP COLUMN "last_processed_block"`);
  }
}