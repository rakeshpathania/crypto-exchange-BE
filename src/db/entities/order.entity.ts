import { Column, Entity, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Trade } from './trade.entity';

export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

export enum OrderType {
  LIMIT = 'limit',
  MARKET = 'market',
  STOP = 'stop',
}

export enum OrderStatus {
  OPEN = 'open',
  PARTIAL = 'partial',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
}

@Entity('orders')
export class Order extends BaseEntity {
  @ManyToOne(() => User, user => user.orders)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column()
  assetPair: string;

  @Column({
    type: 'enum',
    enum: OrderSide,
  })
  side: OrderSide;

  @Column({
    type: 'enum',
    enum: OrderType,
  })
  type: OrderType;

  @Column('decimal', { precision: 36, scale: 18, nullable: true })
  price: number;

  @Column('decimal', { precision: 36, scale: 18 })
  amount: number;

  @Column('decimal', { precision: 36, scale: 18, default: 0 })
  filled: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.OPEN,
  })
  status: OrderStatus;

  @OneToMany(() => Trade, trade => trade.order)
  trades: Trade[];

  @OneToMany(() => Trade, trade => trade.contraOrder)
  contraTrades: Trade[];
}