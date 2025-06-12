import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('verifications')
export class Verification extends BaseEntity {
  @Column()
  otp: string;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ default: false })
  verified: boolean;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, user => user.verifications)
  user: User;
}