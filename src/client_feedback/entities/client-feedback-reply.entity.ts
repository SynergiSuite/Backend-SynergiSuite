import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { ClientFeedback } from './client-feedback.entity';

@Entity({ name: 'client_feedback_replies' })
export class ClientFeedbackReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClientFeedback, (feedback) => feedback.replies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'feedback_id' })
  feedback: ClientFeedback;

  @Column({ name: 'feedback_id', type: 'uuid' })
  feedbackId: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'business_id', type: 'int' })
  businessId: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy?: User;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdById?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
