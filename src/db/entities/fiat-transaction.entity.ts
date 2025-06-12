import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum FiatTransactionType {
  DEPOSIT = 'fiat_deposit',
  WITHDRAWAL = 'fiat_withdrawal',
}

export enum FiatTransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('fiat_transactions')
export class FiatTransaction extends BaseEntity {
  @ManyToOne(() => User, user => user.fiatTransactions)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: FiatTransactionType,
  })
  type: FiatTransactionType;

  @Column('decimal', { precision: 36, scale: 18 })
  amount: number;

  @Column()
  currency: string;

  @Column({
    type: 'enum',
    enum: FiatTransactionStatus,
    default: FiatTransactionStatus.PENDING,
  })
  status: FiatTransactionStatus;

  @Column()
  provider: string;
}