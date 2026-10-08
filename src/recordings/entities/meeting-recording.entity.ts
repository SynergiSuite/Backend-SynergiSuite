import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MeetingRecordingStatus {
  STARTING = 'starting',
  ACTIVE = 'active',
  ENDING = 'ending',
  COMPLETE = 'complete',
  FAILED = 'failed',
  ABORTED = 'aborted',
  LIMIT_REACHED = 'limit_reached',
  UNKNOWN = 'unknown',
}

@Entity({ name: 'meeting_recordings' })
export class MeetingRecording {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  roomName: string;

  @Index({ unique: true })
  @Column({ nullable: true })
  egressId: string;

  @Column({
    type: 'enum',
    enum: MeetingRecordingStatus,
    default: MeetingRecordingStatus.STARTING,
  })
  status: MeetingRecordingStatus;

  @Column()
  bucket: string;

  @Column({ nullable: true })
  filePath: string;

  @Column({ nullable: true })
  fileLocation: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize: string;

  @Column({ type: 'bigint', nullable: true })
  duration: string;

  @Column({ nullable: true })
  error: string;

  @Column({ type: 'text', nullable: true })
  transcript: string;

  @Column({ type: 'jsonb', nullable: true })
  transcriptSegments: Record<string, any>[];

  @Column({ nullable: true })
  transcriptLanguage: string;

  @Column({ nullable: true })
  transcriptProvider: string;

  @Column({ type: 'timestamptz', nullable: true })
  transcriptGeneratedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
