import { MigrationInterface, QueryRunner } from "typeorm";

export class AddKycTable1718817600003 implements MigrationInterface {
    name = 'AddKycTable1718817600003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum for KYC status if it doesn't exist
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_status_enum') THEN
                    CREATE TYPE "public"."kyc_status_enum" AS ENUM('pending', 'verified', 'rejected');
                END IF;
            END
            $$
        `);
        
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "kyc" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "full_name" character varying NOT NULL,
                "dob" character varying NOT NULL,
                "address" character varying NOT NULL,
                "country" character varying NOT NULL,
                "document_type" character varying,
                "document_number" character varying,
                "document_image_url" character varying,
                "status" character varying NOT NULL DEFAULT 'pending',
                "submitted_at" TIMESTAMP NOT NULL DEFAULT now(),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "user_id" uuid,
                CONSTRAINT "REL_c201dde1b2b8f9a1e8690d5d74" UNIQUE ("user_id"),
                CONSTRAINT "PK_7e9dbe53a3b48c0e5a0a7b41fe3" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`
            ALTER TABLE "kyc" 
            ADD CONSTRAINT "FK_c201dde1b2b8f9a1e8690d5d74e" 
            FOREIGN KEY ("user_id") 
            REFERENCES "users"("id") 
            ON DELETE CASCADE 
            ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "kyc" 
            DROP CONSTRAINT "FK_c201dde1b2b8f9a1e8690d5d74e"
        `);
        
        await queryRunner.query(`
            DROP TABLE "kyc"
        `);
    }
}