import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Asset } from '../entities/asset.entity';
import { AssetSeeder } from './asset.seeder';
import AppDataSource from '../data-source';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot(AppDataSource.options),
    TypeOrmModule.forFeature([Asset]),
  ],
  providers: [AssetSeeder],
  exports: [AssetSeeder],
})
export class SeederModule {}