import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../user/entities/user.entity';
import { ClientFeedbackReply } from './client-feedback-reply.entity';
export {
  ClientFeedbackStatus,
  ClientFeedbackTargetType,
  ClientFeedbackType,
} from '../enums/client_feedback.enums';
import {
  ClientFeedbackStatus,
  ClientFeedbackTargetType,
  ClientFeedbackType,
} from '../enums/client_feedback.enums';

@Entity({ name: 'client_feedback' })
export class ClientFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'title_of_feedback', length: 150 })
  titleOfFeedback: string;

  @Column({ name: 'star_rating', type: 'int', nullable: true })
  starRating?: number;

  @Column({ type: 'text' })
  feedback: string;

  @Column({
    name: 'feedback_type',
    type: 'enum',
    enum: ClientFeedbackType,
    default: ClientFeedbackType.ISSUE,
  })
  feedbackType: ClientFeedbackType;

  @Column({
    name: 'target_type',
    type: 'enum',
    enum: ClientFeedbackTargetType,
    default: ClientFeedbackTargetType.PROJECT,
  })
  targetType: ClientFeedbackTargetType;

  @Column({ name: 'type_id', type: 'uuid' })
  typeId: string;

  @Column({
    type: 'enum',
    enum: ClientFeedbackStatus,
    default: ClientFeedbackStatus.IN_PROGRESS,
  })
  status: ClientFeedbackStatus;

  @Column({ name: 'business_id', type: 'int' })
  businessId: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy?: User;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdById?: number;

  @OneToMany(() => ClientFeedbackReply, (reply) => reply.feedback)
  replies: ClientFeedbackReply[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
