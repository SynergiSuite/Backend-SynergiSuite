import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ChatbotReportJobType {
  BUSINESS = 'business',
  TEAM = 'team',
  EMPLOYEE = 'employee',
}

@Entity({ name: 'chatbot_report_files' })
@Index('idx_chatbot_report_files_business_generated', [
  'businessId',
  'generatedAt',
])
@Index('idx_chatbot_report_files_entity', ['entityType', 'entityId'])
export class ChatbotReportFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'int' })
  businessId: number;

  @Column({ length: 255 })
  bucket: string;

  @Column({ name: 'object_key', type: 'text' })
  objectKey: string;

  @Column({ name: 'generated_at', type: 'timestamptz' })
  generatedAt: Date;

  @Column({ name: 'job_type', type: 'enum', enum: ChatbotReportJobType })
  jobType: ChatbotReportJobType;

  @Column({ name: 'report_period_start', type: 'timestamptz' })
  reportPeriodStart: Date;

  @Column({ name: 'report_period_end', type: 'timestamptz' })
  reportPeriodEnd: Date;

  @Column({ name: 'entity_type', length: 50, nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', length: 120, nullable: true })
  entityId: string | null;

  @Column({ name: 'entity_name', length: 255, nullable: true })
  entityName: string | null;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize: string | null;

  @Column({ length: 128, nullable: true })
  checksum: string | null;

  @Column({ name: 'content_type', length: 120, default: 'application/pdf' })
  contentType: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
