import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Meeting } from './meeting.entity';

export enum MeetingParticipantRole {
  HOST = 'host',
  ATTENDEE = 'attendee',
}

@Entity({ name: 'meeting_participants' })
@Unique(['meetingId', 'userId'])
export class MeetingParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Meeting, (meeting) => meeting.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meetingId' })
  meeting: Meeting;

  @Index()
  @Column()
  meetingId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column()
  userId: number;

  @Column({
    type: 'enum',
    enum: MeetingParticipantRole,
    default: MeetingParticipantRole.ATTENDEE,
  })
  role: MeetingParticipantRole;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  invitedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  joinedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  leftAt: Date;
}
