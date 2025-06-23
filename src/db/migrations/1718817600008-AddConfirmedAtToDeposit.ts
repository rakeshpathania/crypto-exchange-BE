import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddConfirmedAtToDeposit1718817600008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'deposits',
      new TableColumn({
        name: 'confirmed_at',
        type: 'timestamp',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('deposits', 'confirmed_at');
  }
}