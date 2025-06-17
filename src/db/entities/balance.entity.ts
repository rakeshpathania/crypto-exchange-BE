import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Asset } from './asset.entity';

@Entity('balances')
export class Balance extends BaseEntity {
  @ManyToOne(() => User, user => user.balances)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Asset, asset => asset.balances)
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column()
  assetId: string;

  @Column('decimal', { precision: 36, scale: 18 })
  balance: number;

}