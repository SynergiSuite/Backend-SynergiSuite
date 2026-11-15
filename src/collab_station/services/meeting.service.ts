import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, LessThan, Repository } from 'typeorm';
import { Group } from '../entities/group.entity';
import { Meeting, MeetingStatus } from '../entities/meeting.entity';
import {
  MeetingParticipant,
  MeetingParticipantRole,
} from '../entities/meeting-participant.entity';
import {
  CreateMeetingDto,
  MeetingResponseDto,
  MeetingTokenResponseDto,
  toMeetingResponseDto,
} from '../dto/meeting.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { LiveKitService } from '../../media/livekit.service';

@Injectable()
export class MeetingService implements OnModuleInit {
  private readonly logger = new Logger(MeetingService.name);

  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepository: Repository<Meeting>,
    @InjectRepository(MeetingParticipant)
    private readonly participantRepository: Repository<MeetingParticipant>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    private readonly liveKitService: LiveKitService,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  onModuleInit() {
    this.liveKitService.validateConfiguration('meetings');
  }

  async createMeeting(
    dto: CreateMeetingDto,
    hostId: number,
    hostName: string = 'Someone',
  ): Promise<Meeting> {
    this.logger.log(
      `Creating meeting in group ${dto.groupId} by user ${hostId}`,
    );

    const group = await this.groupRepository.findOne({
      where: { id: dto.groupId },
      relations: ['members', 'members.user'],
    });
    if (!group) {
      throw new HttpException('Group not found', HttpStatus.NOT_FOUND);
    }

    const hostMembership = group.members?.find((m) => m.userId === hostId);
    if (!hostMembership) {
      throw new HttpException(
        'You are not a member of this group',
        HttpStatus.FORBIDDEN,
      );
    }

    const requestedParticipantIds = dto.participantIds?.length
      ? dto.participantIds
      : group.members.map((member) => member.userId);
    const participantIds = [...new Set([...requestedParticipantIds, hostId])];
    if (
      participantIds.length !==
      requestedParticipantIds.length +
        (requestedParticipantIds.includes(hostId) ? 0 : 1)
    ) {
      throw new HttpException(
        'Duplicate participant IDs are not allowed',
        HttpStatus.BAD_REQUEST,
      );
    }

    const memberIds = new Set(group.members.map((member) => member.userId));
    const nonMemberIds = participantIds.filter(
      (userId) => !memberIds.has(userId),
    );
    if (nonMemberIds.length) {
      throw new HttpException(
        `Participants must be members of the group: ${nonMemberIds.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const meeting = await this.meetingRepository.manager.transaction(
      async (manager) => {
        const meetingId = randomUUID();
        const createdMeeting = manager.create(Meeting, {
          id: meetingId,
          groupId: dto.groupId,
          title: dto.title,
          hostId,
          status: MeetingStatus.SCHEDULED,
          livekitRoomName: meetingId,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        });
        const savedMeeting = await manager.save(Meeting, createdMeeting);

        const participants = participantIds.map((userId) =>
          manager.create(MeetingParticipant, {
            meetingId: savedMeeting.id,
            userId,
            role:
              userId === hostId
                ? MeetingParticipantRole.HOST
                : MeetingParticipantRole.ATTENDEE,
          }),
        );
        await manager.save(MeetingParticipant, participants);

        return manager.findOne(Meeting, {
          where: { id: savedMeeting.id },
          relations: ['host', 'participants', 'participants.user'],
        });
      },
    );

    this.notifyParticipants(
      meeting,
      hostId,
      {
        title: `Meeting created: ${meeting.title}`,
        body: `${hostName} created a meeting`,
      },
      NotificationType.MEETING_INVITE,
    );

    return meeting;
  }

  async startMeeting(meetingId: string, userId: number): Promise<Meeting> {
    this.logger.log(`Starting meeting ${meetingId} by user ${userId}`);

    const meeting = await this.findMeetingOrFail(meetingId);
    this.assertHost(meeting, userId);

    if (meeting.status !== MeetingStatus.SCHEDULED) {
      throw new HttpException(
        `Cannot start a meeting with status: ${meeting.status}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    meeting.status = MeetingStatus.LIVE;
    meeting.startedAt = new Date();
    const saved = await this.meetingRepository.save(meeting);
    const startedMeeting = await this.findMeetingOrFail(saved.id);

    this.notifyParticipants(
      startedMeeting,
      userId,
      {
        title: `Meeting started: ${startedMeeting.title}`,
        body: 'A meeting has started',
      },
      NotificationType.MEETING_STARTED,
    );

    return startedMeeting;
  }

  async joinMeeting(meetingId: string, userId: number): Promise<Meeting> {
    this.logger.log(`Joining meeting ${meetingId} by user ${userId}`);

    const meeting = await this.findMeetingOrFail(meetingId);
    if (meeting.status !== MeetingStatus.LIVE) {
      throw new HttpException(
        'Meeting must be live before participants can join',
        HttpStatus.BAD_REQUEST,
      );
    }

    const participant = this.findParticipant(meeting, userId);
    if (!participant) {
      throw new HttpException(
        'You are not a participant of this meeting',
        HttpStatus.FORBIDDEN,
      );
    }

    participant.joinedAt = new Date();
    participant.leftAt = null;
    await this.participantRepository.save(participant);
    return this.findMeetingOrFail(meetingId);
  }

  async leaveMeeting(meetingId: string, userId: number): Promise<Meeting> {
    this.logger.log(`Leaving meeting ${meetingId} by user ${userId}`);

    const meeting = await this.findMeetingOrFail(meetingId);
    const participant = this.findParticipant(meeting, userId);
    if (!participant) {
      throw new HttpException(
        'You are not a participant of this meeting',
        HttpStatus.FORBIDDEN,
      );
    }

    participant.leftAt = new Date();
    await this.participantRepository.save(participant);
    return this.findMeetingOrFail(meetingId);
  }

  async endMeeting(meetingId: string, userId: number): Promise<Meeting> {
    this.logger.log(`Ending meeting ${meetingId} by user ${userId}`);

    const meeting = await this.findMeetingOrFail(meetingId);
    this.assertHost(meeting, userId);

    if (meeting.status !== MeetingStatus.LIVE) {
      throw new HttpException(
        `Cannot end a meeting with status: ${meeting.status}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    meeting.status = MeetingStatus.ENDED;
    meeting.endedAt = new Date();
    const saved = await this.meetingRepository.save(meeting);
    return this.findMeetingOrFail(saved.id);
  }

  async cancelMeeting(meetingId: string, userId: number): Promise<Meeting> {
    this.logger.log(`Cancelling meeting ${meetingId} by user ${userId}`);

    const meeting = await this.findMeetingOrFail(meetingId);
    this.assertHost(meeting, userId);

    if (meeting.status !== MeetingStatus.SCHEDULED) {
      throw new HttpException(
        `Cannot cancel a meeting with status: ${meeting.status}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    meeting.status = MeetingStatus.CANCELLED;
    meeting.endedAt = new Date();
    const saved = await this.meetingRepository.save(meeting);
    return this.findMeetingOrFail(saved.id);
  }

  async getMeetingToken(
    meetingId: string,
    userId: number,
    userName?: string,
  ): Promise<MeetingTokenResponseDto> {
    this.logger.log(
      `Generating LiveKit token for meeting ${meetingId}, user ${userId}`,
    );

    const meeting = await this.findMeetingOrFail(meetingId);
    const participant = this.findParticipant(meeting, userId);
    if (!participant) {
      throw new HttpException(
        'You are not a participant of this meeting',
        HttpStatus.FORBIDDEN,
      );
    }

    if (meeting.status !== MeetingStatus.LIVE) {
      throw new HttpException(
        'Meeting must be live to get a token',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(
      `LiveKit token generated for meeting ${meetingId}, user ${userId}`,
    );

    return this.liveKitService.createRoomToken({
      roomName: meeting.livekitRoomName || meetingId,
      userId,
      userName,
      ttl: '10m',
    });
  }

  async getMeeting(
    meetingId: string,
    userId: number,
  ): Promise<MeetingResponseDto> {
    const meeting = await this.findMeetingOrFail(meetingId);
    if (!this.findParticipant(meeting, userId)) {
      throw new HttpException(
        'You are not a participant of this meeting',
        HttpStatus.FORBIDDEN,
      );
    }
    return toMeetingResponseDto(meeting);
  }

  async findForUser(
    userId: number,
    limit: number = 20,
    cursor?: string,
  ): Promise<MeetingResponseDto[]> {
    const participantRows = await this.participantRepository.find({
      where: { userId },
      order: { invitedAt: 'DESC' },
      take: limit,
    });
    const meetingIds = participantRows.map(
      (participant) => participant.meetingId,
    );
    if (!meetingIds.length) {
      return [];
    }

    const where: any = { id: In(meetingIds) };
    if (cursor) {
      where.createdAt = LessThan(new Date(cursor));
    }

    const meetings = await this.meetingRepository.find({
      where,
      relations: ['host', 'participants', 'participants.user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return meetings.map((meeting) => toMeetingResponseDto(meeting));
  }

  async isParticipant(meetingId: string, userId: number): Promise<boolean> {
    const participant = await this.participantRepository.findOne({
      where: { meetingId, userId },
    });
    return !!participant;
  }

  async isHost(meetingId: string, userId: number): Promise<boolean> {
    const meeting = await this.meetingRepository.findOne({
      where: { id: meetingId },
    });
    return meeting?.hostId === userId;
  }

  async isParticipantByRoomName(
    roomName: string,
    userId: number,
  ): Promise<boolean> {
    const meeting = await this.meetingRepository
      .createQueryBuilder('meeting')
      .select('meeting.id', 'id')
      .where('meeting.livekitRoomName = :roomName', { roomName })
      .getRawOne<{ id: string }>();

    if (!meeting) {
      return false;
    }

    return this.isParticipant(meeting.id, userId);
  }

  async isHostByRoomName(roomName: string, userId: number): Promise<boolean> {
    const meeting = await this.meetingRepository
      .createQueryBuilder('meeting')
      .select('meeting.hostId', 'hostId')
      .where('meeting.livekitRoomName = :roomName', { roomName })
      .getRawOne<{ hostId: number }>();

    return meeting?.hostId === userId;
  }

  async findRoomNamesForUser(userId: number): Promise<string[]> {
    const rows = await this.meetingRepository
      .createQueryBuilder('meeting')
      .innerJoin(
        MeetingParticipant,
        'participant',
        'participant.meetingId = meeting.id',
      )
      .select('meeting.livekitRoomName', 'roomName')
      .where('participant.userId = :userId', { userId })
      .andWhere('meeting.livekitRoomName IS NOT NULL')
      .getRawMany<{ roomName: string }>();

    return rows.map((row) => row.roomName);
  }

  private async findMeetingOrFail(meetingId: string): Promise<Meeting> {
    const meeting = await this.meetingRepository.findOne({
      where: { id: meetingId },
      relations: ['host', 'participants', 'participants.user'],
    });
    if (!meeting) {
      throw new HttpException('Meeting not found', HttpStatus.NOT_FOUND);
    }
    return meeting;
  }

  private findParticipant(
    meeting: Meeting,
    userId: number,
  ): MeetingParticipant | undefined {
    return meeting.participants?.find(
      (participant) => participant.userId === userId,
    );
  }

  private assertHost(meeting: Meeting, userId: number): void {
    if (meeting.hostId !== userId) {
      throw new HttpException(
        'Only the meeting host can perform this action',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private notifyParticipants(
    meeting: Meeting,
    actorId: number,
    message: { title: string; body: string },
    type: NotificationType,
  ): void {
    const recipientIds =
      meeting.participants
        ?.filter((participant) => participant.userId !== actorId)
        .map((participant) => participant.userId) || [];
    if (!recipientIds.length) {
      return;
    }

    this.notificationsService
      ?.createMany(
        recipientIds.map((recipientId) => ({
          recipientId,
          actorId,
          type,
          title: message.title,
          body: message.body,
          data: {
            meetingId: meeting.id,
            groupId: meeting.groupId,
            href: '/collab-station',
          },
        })),
      )
      .catch((error) => {
        this.logger.error(
          `Failed to create meeting notifications for ${meeting.id}`,
          error.stack ?? error.message,
        );
      });
  }
}
