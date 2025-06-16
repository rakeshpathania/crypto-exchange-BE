import { NestFactory } from '@nestjs/core';
import { SeederModule } from './seeder.module';
import { AssetSeeder } from './asset.seeder';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(SeederModule);
  const logger = new Logger('Seeder');

  try {
    logger.log('Starting seeding...');
    
    const assetSeeder = appContext.get(AssetSeeder);
    await assetSeeder.seed();
    
    logger.log('Seeding completed successfully');
  } catch (error) {
    logger.error(`Seeding failed: ${error.message}`, error.stack);
  } finally {
    await appContext.close();
  }
}

bootstrap();