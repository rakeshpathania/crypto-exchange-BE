import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVerificationTable1718817600001 implements MigrationInterface {
    name = 'AddVerificationTable1718817600001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "verifications" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "otp" character varying NOT NULL,
                "expires_at" TIMESTAMP NOT NULL,
                "verified" boolean NOT NULL DEFAULT false,
                "user_id" uuid NOT NULL,
                CONSTRAINT "PK_verifications" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`
            ALTER TABLE "verifications" 
            ADD CONSTRAINT "FK_verifications_users" 
            FOREIGN KEY ("user_id") 
            REFERENCES "users"("id") 
            ON DELETE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verifications" DROP CONSTRAINT "FK_verifications_users"`);
        await queryRunner.query(`DROP TABLE "verifications"`);
    }
}