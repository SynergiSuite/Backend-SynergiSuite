import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { MeetingService } from './meeting.service';
import { Group, GroupType } from '../entities/group.entity';
import { Meeting, MeetingStatus } from '../entities/meeting.entity';
import {
  MeetingParticipant,
  MeetingParticipantRole,
} from '../entities/meeting-participant.entity';
import { LiveKitService } from '../../media/livekit.service';

describe('MeetingService', () => {
  let service: MeetingService;

  const mockMeetingRepository = {
    manager: {
      transaction: jest.fn(),
    },
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockParticipantRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockGroupRepository = {
    findOne: jest.fn(),
  };

  const mockNotificationsService = {
    createMany: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    process.env.LIVEKIT_API_KEY = 'test-key';
    process.env.LIVEKIT_API_SECRET =
      'test-secret-must-be-long-enough-otherwise-it-errors-on-sign';
    process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingService,
        {
          provide: getRepositoryToken(Meeting),
          useValue: mockMeetingRepository,
        },
        {
          provide: getRepositoryToken(MeetingParticipant),
          useValue: mockParticipantRepository,
        },
        {
          provide: getRepositoryToken(Group),
          useValue: mockGroupRepository,
        },
        {
          provide: 'NotificationsService',
          useValue: mockNotificationsService,
        },
        LiveKitService,
      ],
    }).compile();

    service = module.get<MeetingService>(MeetingService);
    service.onModuleInit();
    jest.clearAllMocks();
  });

  const createMockGroup = (overrides = {}): Group => ({
    id: 'group-uuid',
    name: 'Design',
    type: GroupType.CUSTOM,
    description: null,
    avatarUrl: null,
    team: null,
    teamId: null,
    project: null,
    projectId: null,
    createdBy: null,
    createdById: 1,
    createdAt: new Date(),
    members: [
      { userId: 1, groupId: 'group-uuid' } as any,
      { userId: 2, groupId: 'group-uuid' } as any,
      { userId: 3, groupId: 'group-uuid' } as any,
    ],
    messages: [],
    ...overrides,
  });

  const createMockMeeting = (overrides = {}): Meeting => ({
    id: 'meeting-uuid-1',
    groupId: 'group-uuid',
    title: 'Weekly Review',
    hostId: 1,
    status: MeetingStatus.SCHEDULED,
    livekitRoomName: 'meeting-uuid-1',
    startsAt: null,
    startedAt: null,
    endedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    group: null,
    host: {
      user_id: 1,
      name: 'Host User',
      email: 'host@test.com',
    } as any,
    participants: [
      {
        id: 'participant-1',
        meetingId: 'meeting-uuid-1',
        userId: 1,
        role: MeetingParticipantRole.HOST,
        joinedAt: null,
        leftAt: null,
        user: { user_id: 1, name: 'Host User' },
      } as any,
      {
        id: 'participant-2',
        meetingId: 'meeting-uuid-1',
        userId: 2,
        role: MeetingParticipantRole.ATTENDEE,
        joinedAt: null,
        leftAt: null,
        user: { user_id: 2, name: 'Member User' },
      } as any,
    ],
    ...overrides,
  });

  describe('createMeeting', () => {
    it('should create a group meeting and snapshot participants', async () => {
      const group = createMockGroup();
      const meeting = createMockMeeting();
      mockGroupRepository.findOne.mockResolvedValue(group);
      mockMeetingRepository.manager.transaction.mockImplementation(
        async (callback) =>
          callback({
            create: jest.fn((_, value) => value),
            save: jest.fn((_, value) => value),
            findOne: jest.fn().mockResolvedValue(meeting),
          }),
      );

      const result = await service.createMeeting(
        {
          groupId: 'group-uuid',
          title: 'Weekly Review',
        },
        1,
        'Host User',
      );

      expect(result.id).toBe('meeting-uuid-1');
      expect(result.status).toBe(MeetingStatus.SCHEDULED);
      expect(mockMeetingRepository.manager.transaction).toHaveBeenCalled();
    });

    it('should reject non-group members creating meetings', async () => {
      mockGroupRepository.findOne.mockResolvedValue(createMockGroup());

      await expect(
        service.createMeeting(
          {
            groupId: 'group-uuid',
            title: 'Weekly Review',
          },
          999,
        ),
      ).rejects.toThrow(
        new HttpException(
          'You are not a member of this group',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('should reject requested participants who are not group members', async () => {
      mockGroupRepository.findOne.mockResolvedValue(createMockGroup());

      await expect(
        service.createMeeting(
          {
            groupId: 'group-uuid',
            title: 'Weekly Review',
            participantIds: [2, 999],
          },
          1,
        ),
      ).rejects.toThrow('Participants must be members of the group: 999');
    });
  });

  describe('startMeeting', () => {
    it('should allow the host to start a scheduled meeting', async () => {
      const meeting = createMockMeeting();
      mockMeetingRepository.findOne
        .mockResolvedValueOnce(meeting)
        .mockResolvedValueOnce({
          ...meeting,
          status: MeetingStatus.LIVE,
          startedAt: new Date(),
        });
      mockMeetingRepository.save.mockResolvedValue({
        ...meeting,
        status: MeetingStatus.LIVE,
      });

      const result = await service.startMeeting('meeting-uuid-1', 1);

      expect(result.status).toBe(MeetingStatus.LIVE);
      expect(mockMeetingRepository.save).toHaveBeenCalled();
    });

    it('should reject non-hosts starting a meeting', async () => {
      mockMeetingRepository.findOne.mockResolvedValue(createMockMeeting());

      await expect(service.startMeeting('meeting-uuid-1', 2)).rejects.toThrow(
        new HttpException(
          'Only the meeting host can perform this action',
          HttpStatus.FORBIDDEN,
        ),
      );
    });
  });

  describe('getMeetingToken', () => {
    it('should generate a LiveKit token for a live meeting participant', async () => {
      mockMeetingRepository.findOne.mockResolvedValue(
        createMockMeeting({ status: MeetingStatus.LIVE }),
      );

      const result = await service.getMeetingToken(
        'meeting-uuid-1',
        2,
        'Member User',
      );

      expect(result.url).toBe(process.env.LIVEKIT_URL);
      expect(result.token).toBeDefined();
    });

    it('should reject token generation before the meeting is live', async () => {
      mockMeetingRepository.findOne.mockResolvedValue(createMockMeeting());

      await expect(
        service.getMeetingToken('meeting-uuid-1', 2),
      ).rejects.toThrow('Meeting must be live to get a token');
    });
  });
});
