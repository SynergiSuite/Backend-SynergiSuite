import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Group } from './group.entity';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system',
  SHARED_ITEM = 'shared_item',
}

export enum SharedEntityType {
  TASK = 'task',
  MILESTONE = 'milestone',
  CLIENT_FEEDBACK = 'client_feedback',
}

export interface SharedEntitySnapshot extends Record<string, unknown> {
  title: string;
  projectId: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  targetType?: string;
}

@Entity({ name: 'messages' })
@Index('IDX_messages_shared_entity', ['sharedEntityType', 'sharedEntityId'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Group, (group) => group.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Index()
  @Column()
  groupId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ nullable: true })
  senderId: number;

  @Column({ type: 'text', nullable: true })
  text: string;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Column({ type: 'enum', enum: SharedEntityType, nullable: true })
  sharedEntityType?: SharedEntityType;

  @Column({ type: 'uuid', nullable: true })
  sharedEntityId?: string;

  @Column({ type: 'jsonb', nullable: true })
  sharedEntitySnapshot?: SharedEntitySnapshot;

  @Column({ nullable: true })
  fileUrl: string;

  @Column({ nullable: true })
  fileName: string;

  @Column({ nullable: true })
  mimeType: string;

  @Column({ nullable: true })
  fileSize: number;

  @ManyToOne(() => Message, (message) => message.replies, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'replyToId' })
  replyTo: Message;

  @Column({ nullable: true })
  replyToId: string;

  @OneToMany(() => Message, (message) => message.replyTo)
  replies: Message[];

  @Column({ default: false })
  isEdited: boolean;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date;
}
