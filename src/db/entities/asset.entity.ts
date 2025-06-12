import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Balance } from './balance.entity';
import { Deposit } from './deposit.entity';
import { Withdrawal } from './withdrawal.entity';

@Entity('assets')
export class Asset extends BaseEntity {
  @Column()
  symbol: string;

  @Column()
  name: string;

  @Column()
  network: string;

  @Column({ nullable: true })
  contractAddress: string;

  @Column()
  decimals: number;

  @OneToMany(() => Balance, balance => balance.asset)
  balances: Balance[];

  @OneToMany(() => Deposit, deposit => deposit.asset)
  deposits: Deposit[];

  @OneToMany(() => Withdrawal, withdrawal => withdrawal.asset)
  withdrawals: Withdrawal[];
}