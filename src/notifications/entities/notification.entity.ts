import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum NotificationType {
  GROUP_MEMBER_ADDED = 'group_member_added',
  MESSAGE_RECEIVED = 'message_received',
  MISSED_CALL = 'missed_call',
  MEETING_INVITE = 'meeting_invite',
  MEETING_STARTED = 'meeting_started',
  TASK_ASSIGNED = 'task_assigned',
  TASK_UPDATED = 'task_updated',
}

@Entity({ name: 'notifications' })
@Index('IDX_notifications_recipient_unread_created', [
  'recipientId',
  'isRead',
  'createdAt',
])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recipientId: number;

  @Column({ nullable: true })
  actorId: number | null;

  @Column({ type: 'varchar', length: 64 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
