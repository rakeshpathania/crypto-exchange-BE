import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationNameXXXXXXXXXXXXX implements MigrationInterface {
    name = 'MigrationNameXXXXXXXXXXXXX';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Helper function for safe enum creation
        const createEnumIfNotExists = (enumName: string, values: string[]) => {
            const valuesString = values.map(v => `'${v}'`).join(', ');
            return `
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${enumName}') THEN
                        CREATE TYPE "public"."${enumName}" AS ENUM(${valuesString});
                    END IF;
                END
                $$;
            `;
        };

        // Example usage:
        // 1. Create enum type safely
        // await queryRunner.query(createEnumIfNotExists('my_status_enum', ['active', 'inactive', 'pending']));
        
        // 2. Create table safely
        // await queryRunner.query(`
        //     CREATE TABLE IF NOT EXISTS "my_table" (
        //         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        //         "status" "public"."my_status_enum" NOT NULL DEFAULT 'pending',
        //         CONSTRAINT "PK_my_table" PRIMARY KEY ("id")
        //     )
        // `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop tables first, then enum types
        // await queryRunner.query(`DROP TABLE IF EXISTS "my_table"`);
        // await queryRunner.query(`DROP TYPE IF EXISTS "public"."my_status_enum"`);
    }
}