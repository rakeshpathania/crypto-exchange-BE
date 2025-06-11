import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Asset } from './asset.entity';

export enum WithdrawalStatus {
  PENDING = 'pending',
  BROADCAST = 'broadcast',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Entity('withdrawals')
export class Withdrawal extends BaseEntity {
  @ManyToOne(() => User, user => user.withdrawals)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Asset, asset => asset.withdrawals)
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ name: 'asset_id' })
  assetId: string;

  @Column({ nullable: true, name: 'tx_hash' })
  txHash: string;

  @Column({ name: 'to_address' })
  toAddress: string;

  @Column('decimal', { precision: 36, scale: 18 })
  amount: number;

  @Column('decimal', { precision: 36, scale: 18 })
  fee: number;

  @Column({
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PENDING,
  })
  status: WithdrawalStatus;

  @Column()
  network: string;
}