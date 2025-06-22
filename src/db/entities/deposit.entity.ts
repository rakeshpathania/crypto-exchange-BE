import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Asset } from './asset.entity';

export enum DepositStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export enum DepositMethod {
  CARD = 'card',
  CRYPTO = 'crypto',
}

export enum CryptoNetwork {
  ETHEREUM = 'ethereum',
  BINANCE_SMART_CHAIN = 'bsc',
  POLYGON = 'polygon',
  SOLANA = 'solana',
  TRON = 'tron',
  BITCOIN = 'BITCOIN',
}

@Entity('deposits')
export class Deposit extends BaseEntity {
  @ManyToOne(() => User, user => user.deposits)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Asset, asset => asset.deposits)
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column()
  assetId: string;

  @Column({ nullable: true })
  txHash: string;

  @Column('decimal', { precision: 36, scale: 18 })
  amount: number;

  @Column({
    type: 'enum',
    enum: DepositStatus,
    default: DepositStatus.PENDING,
  })
  status: DepositStatus;

  @Column({ nullable: true })
  network: string;

  @Column({
    type: 'enum',
    enum: DepositMethod,
    default: DepositMethod.CRYPTO,
  })
  method: DepositMethod;

  @Column({ nullable: true })
  paymentIntentId: string;

  @Column({ nullable: true })
  cryptoAddress: string;

  @Column({ type: 'bigint', nullable: true, default: 0 })
  lastProcessedBlock: number;

  @Column({ type: 'text', array: true, nullable: true, default: [] })
  processedTransactions: string[];

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

}