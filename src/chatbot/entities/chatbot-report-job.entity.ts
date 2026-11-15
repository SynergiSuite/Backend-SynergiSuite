import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ChatbotReportJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity({ name: 'chatbot_report_jobs' })
@Index('idx_chatbot_report_jobs_business_job', ['businessId', 'jobName'], {
  unique: true,
})
@Index('idx_chatbot_report_jobs_due_status', ['nextDueAt', 'status'])
export class ChatbotReportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'int' })
  businessId: number;

  @Column({ name: 'job_name', length: 120 })
  jobName: string;

  @Column({
    type: 'enum',
    enum: ChatbotReportJobStatus,
    default: ChatbotReportJobStatus.PENDING,
  })
  status: ChatbotReportJobStatus;

  @Column({ name: 'last_successful_run', type: 'timestamptz', nullable: true })
  lastSuccessfulRun: Date | null;

  @Column({ name: 'next_due_at', type: 'timestamptz', nullable: true })
  nextDueAt: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'generated_pdf_bucket', length: 255, nullable: true })
  generatedPdfBucket: string | null;

  @Column({ name: 'generated_pdf_key', type: 'text', nullable: true })
  generatedPdfKey: string | null;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number;

  @Column({ name: 'max_attempts', type: 'int', default: 3 })
  maxAttempts: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
