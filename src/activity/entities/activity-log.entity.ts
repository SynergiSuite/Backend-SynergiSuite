import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ActivityAction {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
}

@Entity({ name: 'activity_logs' })
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ActivityAction,
  })
  action: ActivityAction;

  @Column({ length: 50 })
  module: string;

  @Column({ name: 'entity_type', length: 50 })
  entityType: string;

  @Column({ name: 'entity_id', length: 100 })
  entityId: string;

  @Column({ name: 'entity_name', length: 255, nullable: true })
  entityName?: string;

  @Column({ name: 'field_changed', length: 100, nullable: true })
  fieldChanged?: string;

  @Column({ name: 'old_value', type: 'text', nullable: true })
  oldValue?: string;

  @Column({ name: 'new_value', type: 'text', nullable: true })
  newValue?: string;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId?: number;

  @Column({ name: 'user_name', length: 100, nullable: true })
  userName?: string;

  @Column({ name: 'user_email', length: 255, nullable: true })
  userEmail?: string;

  @Column({ name: 'business_id', type: 'int', nullable: true })
  businessId?: number;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  before?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  after?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
