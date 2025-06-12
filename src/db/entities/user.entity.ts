import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Wallet } from './wallet.entity';
import { Balance } from './balance.entity';
import { Order } from './order.entity';
import { Deposit } from './deposit.entity';
import { Withdrawal } from './withdrawal.entity';
import { FiatTransaction } from './fiat-transaction.entity';
import { Notification } from './notification.entity';
import { Verification } from './verification.entity';

export enum KycStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING,
    name: 'kyc_status'
  })
  kycStatus: KycStatus;

  @OneToMany(() => Wallet, wallet => wallet.user)
  wallets: Wallet[];

  @OneToMany(() => Balance, balance => balance.user)
  balances: Balance[];

  @OneToMany(() => Order, order => order.user)
  orders: Order[];

  @OneToMany(() => Deposit, deposit => deposit.user)
  deposits: Deposit[];

  @OneToMany(() => Withdrawal, withdrawal => withdrawal.user)
  withdrawals: Withdrawal[];

  @OneToMany(() => FiatTransaction, fiatTransaction => fiatTransaction.user)
  fiatTransactions: FiatTransaction[];

  @OneToMany(() => Notification, notification => notification.user)
  notifications: Notification[];
  
  @OneToMany(() => Verification, verification => verification.user)
  verifications: Verification[];
}