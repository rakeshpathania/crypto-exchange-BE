# Database Migrations Guide

## Preventing "Type Already Exists" Errors

When creating enum types in PostgreSQL migrations, always use the conditional pattern to prevent errors when migrations are run multiple times:

```typescript
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

// Usage example
await queryRunner.query(createEnumIfNotExists('status_enum', ['active', 'inactive']));
```

## Creating Tables Safely

Always use `IF NOT EXISTS` when creating tables:

```sql
CREATE TABLE IF NOT EXISTS "table_name" (
    -- table definition
)
```

## Migration Template

A template file is available at `src/db/migration-template.ts` that includes these patterns.

## Running Migrations

```bash
# Generate a new migration
npm run migration:generate -- src/db/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```