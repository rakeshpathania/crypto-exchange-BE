import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from './config/snake-naming.strategy';
import * as dotenv from 'dotenv';

dotenv.config();
console.log(process.env.DB_PASSWORD, "env variables loaded");
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'exchange_db',
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
  namingStrategy: new SnakeNamingStrategy(),
});