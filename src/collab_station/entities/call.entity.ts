import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Group } from './group.entity';

export enum CallStatus {
  RINGING = 'ringing',
  ACTIVE = 'active',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  MISSED = 'missed',
  ENDED = 'ended',
  FAILED = 'failed',
}

@Entity({ name: 'calls' })
export class Call {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Index()
  @Column()
  groupId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'callerId' })
  caller: User;

  @Index()
  @Column()
  callerId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'recipientId' })
  recipient: User;

  @Index()
  @Column()
  recipientId: number;

  @Column({ type: 'enum', enum: CallStatus, default: CallStatus.RINGING })
  status: CallStatus;

  @Column({ unique: true })
  livekitRoomName: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  answeredAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date;
}
