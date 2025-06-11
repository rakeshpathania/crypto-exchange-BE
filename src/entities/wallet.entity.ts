import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('wallets')
export class Wallet extends BaseEntity {
  @ManyToOne(() => User, user => user.wallets)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column()
  network: string;

  @Column()
  address: string;

  @Column()
  privateKeyEncrypted: string;
}