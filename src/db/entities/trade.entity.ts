import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Order } from './order.entity';

@Entity('trades')
export class Trade extends BaseEntity {
  @ManyToOne(() => Order, order => order.trades)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderId: string;

  @ManyToOne(() => Order, order => order.contraTrades)
  @JoinColumn({ name: 'contraOrderId' })
  contraOrder: Order;

  @Column()
  contraOrderId: string;

  @Column('decimal', { precision: 36, scale: 18 })
  price: number;

  @Column('decimal', { precision: 36, scale: 18 })
  amount: number;

  @Column('decimal', { precision: 36, scale: 18 })
  fee: number;

  @Column('timestamp')
  timestamp: Date;
}