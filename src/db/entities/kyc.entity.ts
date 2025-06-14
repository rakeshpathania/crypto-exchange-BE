import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { BaseEntity } from './base.entity';

@Entity('kyc')
export class Kyc extends BaseEntity {
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  fullName: string;

  @Column()
  dob: string;

  @Column()
  address: string;

  @Column()
  country: string;

  @Column({ nullable: true })
  documentType: string;

  @Column({ nullable: true })
  documentNumber: string;

  @Column({ nullable: true })
  documentImageUrl: string;

  @Column({ default: 'pending' }) // 'pending' | 'approved' | 'rejected'
  status: string;

}