import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MeetingStatus } from '../entities/meeting.entity';
import { MeetingParticipantRole } from '../entities/meeting-participant.entity';

export class CreateMeetingDto {
  @IsUUID()
  groupId: string;

  @IsString({ message: 'Meeting title must be a string' })
  @MinLength(3, { message: 'Meeting title must be at least 3 characters long' })
  @MaxLength(120, { message: 'Meeting title cannot exceed 120 characters' })
  title: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsArray({ message: 'Participants must be an array' })
  @ArrayNotEmpty({ message: 'Participants cannot be empty' })
  @IsNumber({}, { each: true, message: 'Each participant must be a number' })
  participantIds?: number[];
}

export interface MeetingParticipantDto {
  user_id: number;
  name: string;
  role: MeetingParticipantRole;
  joinedAt?: string;
  leftAt?: string;
}

export interface MeetingResponseDto {
  meetingId: string;
  groupId: string;
  title: string;
  roomName: string;
  status: MeetingStatus;
  host: {
    user_id: number;
    name: string;
  };
  startsAt?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  participants: MeetingParticipantDto[];
}

export interface MeetingTokenResponseDto {
  token: string;
  url: string;
}

export interface MeetingAckSuccess {
  success: true;
  meeting: MeetingResponseDto;
}

export interface MeetingAckError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type MeetingAckDto = MeetingAckSuccess | MeetingAckError;

function toIso(value?: Date | string | null): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

export function toMeetingResponseDto(meeting: any): MeetingResponseDto {
  return {
    meetingId: meeting.id,
    groupId: meeting.groupId,
    title: meeting.title,
    roomName: meeting.livekitRoomName,
    status: meeting.status,
    host: {
      user_id: meeting.host?.user_id ?? meeting.hostId,
      name: meeting.host?.name ?? 'Unknown',
    },
    startsAt: toIso(meeting.startsAt),
    startedAt: toIso(meeting.startedAt),
    endedAt: toIso(meeting.endedAt),
    createdAt: toIso(meeting.createdAt),
    participants: (meeting.participants || []).map((participant) => ({
      user_id: participant.user?.user_id ?? participant.userId,
      name: participant.user?.name ?? 'Unknown',
      role: participant.role,
      joinedAt: toIso(participant.joinedAt),
      leftAt: toIso(participant.leftAt),
    })),
  };
}
