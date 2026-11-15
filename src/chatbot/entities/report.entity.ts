import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'reports' })
@Index('idx_reports_business_created', ['businessId', 'createdAt'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'int' })
  businessId: number;

  @Column({ name: 'report_name', length: 255 })
  reportName: string;

  @Column({ length: 255, default: 'reports' })
  bucket: string;

  @Column({ name: 'object_key', type: 'text' })
  objectKey: string;

  @Column({ name: 'content_type', length: 120, default: 'application/pdf' })
  contentType: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: string;

  @Column({ length: 128 })
  checksum: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
