import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CallService } from './call.service';
import { Call, CallStatus } from '../entities/call.entity';
import { Group, GroupType } from '../entities/group.entity';
import { GroupMember } from '../entities/group-member.entity';
import { LiveKitService } from '../../media/livekit.service';
import { DomainEventsService } from '../../realtime/domain-events.service';

describe('CallService', () => {
  let service: CallService;

  const mockCallRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockGroupRepository = {
    findOne: jest.fn(),
  };

  const mockGroupMemberRepository = {
    findOne: jest.fn(),
  };

  // Mocking QueryRunner for transactional operations
  const mockEntityManager = {
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: mockEntityManager,
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  beforeEach(async () => {
    // Setup env variables for LiveKit token generation tests
    process.env.LIVEKIT_API_KEY = 'test-key';
    process.env.LIVEKIT_API_SECRET =
      'test-secret-must-be-long-enough-otherwise-it-errors-on-sign';
    process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';
    process.env.CALL_RING_TIMEOUT_SECONDS = '30';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallService,
        {
          provide: getRepositoryToken(Call),
          useValue: mockCallRepository,
        },
        {
          provide: getRepositoryToken(Group),
          useValue: mockGroupRepository,
        },
        {
          provide: getRepositoryToken(GroupMember),
          useValue: mockGroupMemberRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        DomainEventsService,
        LiveKitService,
      ],
    }).compile();

    service = module.get<CallService>(CallService);
    service.onModuleInit();

    jest.clearAllMocks();
  });

  afterEach(() => {
    const timeouts = (service as any).ringTimeouts;
    if (timeouts) {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    }
  });

  const createMockGroup = (overrides = {}): Group => ({
    id: 'group-uuid',
    name: null,
    type: GroupType.DIRECT,
    description: null,
    avatarUrl: null,
    team: null,
    teamId: null,
    project: null,
    projectId: null,
    createdBy: null,
    createdById: null,
    createdAt: new Date(),
    members: [
      { userId: 1, groupId: 'group-uuid' } as any,
      { userId: 2, groupId: 'group-uuid' } as any,
    ],
    messages: [],
    ...overrides,
  });

  const createMockCall = (overrides = {}): Call => ({
    id: 'call-uuid-1',
    groupId: 'group-uuid',
    callerId: 1,
    recipientId: 2,
    status: CallStatus.RINGING,
    livekitRoomName: 'call-group-uuid-123456',
    createdAt: new Date(),
    answeredAt: null,
    endedAt: null,
    caller: {
      user_id: 1,
      name: 'Caller User',
      email: 'caller@test.com',
    } as any,
    recipient: {
      user_id: 2,
      name: 'Recipient User',
      email: 'recipient@test.com',
    } as any,
    group: null,
    ...overrides,
  });

  describe('initiateCall', () => {
    it('should successfully initiate a call in a direct group', async () => {
      const group = createMockGroup();
      mockGroupRepository.findOne.mockResolvedValue(group);
      mockCallRepository.findOne.mockResolvedValue(null); // No active calls (not busy)

      const callInstance = createMockCall();
      mockCallRepository.create.mockReturnValue(callInstance);
      mockEntityManager.save.mockResolvedValue(callInstance);
      mockCallRepository.findOne
        .mockResolvedValueOnce(null) // Busy check caller
        .mockResolvedValueOnce(null) // Busy check recipient
        .mockResolvedValueOnce(callInstance); // Final load

      const result = await service.initiateCall('group-uuid', 1);

      expect(result).toBeDefined();
      expect(result.status).toBe(CallStatus.RINGING);
      expect(mockCallRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          livekitRoomName: expect.any(String),
        }),
      );
      const createArg = mockCallRepository.create.mock.calls[0][0];
      expect(createArg.livekitRoomName).toBe(createArg.id);
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should reject call if caller tries to call themselves', async () => {
      const group = createMockGroup({
        members: [{ userId: 1, groupId: 'group-uuid' } as any],
      });
      mockGroupRepository.findOne.mockResolvedValue(group);

      await expect(service.initiateCall('group-uuid', 1)).rejects.toThrow(
        new HttpException(
          'No other participant found in this direct chat',
          HttpStatus.BAD_REQUEST,
        ),
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should prevent calls in non-direct groups', async () => {
      const group = createMockGroup({ type: GroupType.TEAM });
      mockGroupRepository.findOne.mockResolvedValue(group);

      await expect(service.initiateCall('group-uuid', 1)).rejects.toThrow(
        new HttpException(
          'Voice calls are only supported in direct chats',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should reject call if recipient is busy', async () => {
      const group = createMockGroup();
      mockGroupRepository.findOne.mockResolvedValue(group);

      // Caller not busy, but recipient busy
      mockCallRepository.findOne
        .mockResolvedValueOnce(null) // Caller busy check
        .mockResolvedValueOnce(createMockCall()); // Recipient busy check

      await expect(service.initiateCall('group-uuid', 1)).rejects.toThrow(
        new HttpException(
          'The recipient is currently busy',
          HttpStatus.CONFLICT,
        ),
      );
    });

    it('should rollback transaction on error', async () => {
      mockGroupRepository.findOne.mockRejectedValue(
        new Error('DB connection failed'),
      );

      await expect(service.initiateCall('group-uuid', 1)).rejects.toThrow(
        HttpException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('acceptCall', () => {
    it('should allow recipient to accept ringing call', async () => {
      const call = createMockCall({ status: CallStatus.RINGING });
      mockEntityManager.findOne.mockResolvedValue(call);
      mockEntityManager.save.mockResolvedValue({
        ...call,
        status: CallStatus.ACTIVE,
      });

      const result = await service.acceptCall('call-uuid-1', 2);

      expect(result.status).toBe(CallStatus.ACTIVE);
      expect(result.answeredAt).toBeDefined();
    });

    it('should reject accept call if not recipient', async () => {
      const call = createMockCall({ status: CallStatus.RINGING });
      mockEntityManager.findOne.mockResolvedValue(call);

      await expect(service.acceptCall('call-uuid-1', 1)).rejects.toThrow(
        new HttpException(
          'Only the recipient can accept the call',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('should reject accept call if call is not ringing', async () => {
      const call = createMockCall({ status: CallStatus.ACTIVE });
      mockEntityManager.findOne.mockResolvedValue(call);

      await expect(service.acceptCall('call-uuid-1', 2)).rejects.toThrow(
        new HttpException(
          'Cannot accept a call with status: active',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('rejectCall', () => {
    it('should allow recipient to reject ringing call', async () => {
      const call = createMockCall({ status: CallStatus.RINGING });
      mockEntityManager.findOne.mockResolvedValue(call);
      mockEntityManager.save.mockResolvedValue({
        ...call,
        status: CallStatus.REJECTED,
      });

      const result = await service.rejectCall('call-uuid-1', 2);

      expect(result.status).toBe(CallStatus.REJECTED);
      expect(result.endedAt).toBeDefined();
    });

    it('should reject call rejection if not recipient', async () => {
      const call = createMockCall({ status: CallStatus.RINGING });
      mockEntityManager.findOne.mockResolvedValue(call);

      await expect(service.rejectCall('call-uuid-1', 1)).rejects.toThrow(
        new HttpException(
          'Only the recipient can reject the call',
          HttpStatus.FORBIDDEN,
        ),
      );
    });
  });

  describe('cancelCall', () => {
    it('should allow caller to cancel ringing call', async () => {
      const call = createMockCall({ status: CallStatus.RINGING });
      mockEntityManager.findOne.mockResolvedValue(call);
      mockEntityManager.save.mockResolvedValue({
        ...call,
        status: CallStatus.CANCELLED,
      });

      const result = await service.cancelCall('call-uuid-1', 1);

      expect(result.status).toBe(CallStatus.CANCELLED);
      expect(result.endedAt).toBeDefined();
    });

    it('should reject call cancellation if not caller', async () => {
      const call = createMockCall({ status: CallStatus.RINGING });
      mockEntityManager.findOne.mockResolvedValue(call);

      await expect(service.cancelCall('call-uuid-1', 2)).rejects.toThrow(
        new HttpException(
          'Only the caller can cancel the call',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('should end active call if cancel is used for hangup by either participant', async () => {
      const call = createMockCall({ status: CallStatus.ACTIVE });
      mockEntityManager.findOne.mockResolvedValue(call);
      mockEntityManager.save.mockResolvedValue({
        ...call,
        status: CallStatus.ENDED,
      });

      const result = await service.cancelCall('call-uuid-1', 2);

      expect(result.status).toBe(CallStatus.ENDED);
      expect(result.endedAt).toBeDefined();
    });
  });

  describe('endCall', () => {
    it('should allow either participant to end active call', async () => {
      const call = createMockCall({ status: CallStatus.ACTIVE });
      mockEntityManager.findOne.mockResolvedValue(call);
      mockEntityManager.save.mockResolvedValue({
        ...call,
        status: CallStatus.ENDED,
      });

      const result1 = await service.endCall('call-uuid-1', 1);
      expect(result1.status).toBe(CallStatus.ENDED);

      const call2 = createMockCall({ status: CallStatus.ACTIVE });
      mockEntityManager.findOne.mockResolvedValue(call2);
      const result2 = await service.endCall('call-uuid-1', 2);
      expect(result2.status).toBe(CallStatus.ENDED);
    });

    it('should reject ending active call if user is not participant', async () => {
      const call = createMockCall({ status: CallStatus.ACTIVE });
      mockEntityManager.findOne.mockResolvedValue(call);

      await expect(service.endCall('call-uuid-1', 999)).rejects.toThrow(
        new HttpException(
          'Only call participants can end the call',
          HttpStatus.FORBIDDEN,
        ),
      );
    });
  });

  describe('markMissed', () => {
    it('should transition call status from ringing to missed', async () => {
      const call = createMockCall({ status: CallStatus.RINGING });
      mockCallRepository.findOne.mockResolvedValue(call);
      mockCallRepository.save.mockImplementation((c) => Promise.resolve(c));

      const result = await service.markMissed('call-uuid-1');

      expect(result.status).toBe(CallStatus.MISSED);
      expect(result.endedAt).toBeDefined();
    });

    it('should be idempotent and skip if call is already accepted', async () => {
      const call = createMockCall({ status: CallStatus.ACTIVE });
      mockCallRepository.findOne.mockResolvedValue(call);

      const result = await service.markMissed('call-uuid-1');

      expect(result.status).toBe(CallStatus.ACTIVE);
      expect(mockCallRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getCallToken', () => {
    it('should generate a valid LiveKit token for active call participant', async () => {
      const call = createMockCall({ status: CallStatus.ACTIVE });
      mockCallRepository.findOne.mockResolvedValue(call);

      const result = await service.getCallToken(
        'call-uuid-1',
        1,
        'Caller User',
      );

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.url).toBe(process.env.LIVEKIT_URL);
      expect(result).not.toHaveProperty('roomName');
      const payload = JSON.parse(
        Buffer.from(result.token.split('.')[1], 'base64url').toString(),
      );
      expect(payload.video.room).toBe(call.livekitRoomName);
    });

    it('should reject token generation for non-participant', async () => {
      const call = createMockCall({ status: CallStatus.ACTIVE });
      mockCallRepository.findOne.mockResolvedValue(call);

      await expect(service.getCallToken('call-uuid-1', 999)).rejects.toThrow(
        new HttpException(
          'You are not a participant of this call',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('should reject token generation if call is not active', async () => {
      const call = createMockCall({ status: CallStatus.RINGING });
      mockCallRepository.findOne.mockResolvedValue(call);

      await expect(service.getCallToken('call-uuid-1', 1)).rejects.toThrow(
        new HttpException(
          'Call must be active to get a token',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('getCurrentCall', () => {
    it('should return call details if active/ringing call exists', async () => {
      const call = createMockCall({ status: CallStatus.ACTIVE });
      mockCallRepository.findOne.mockResolvedValue(call);

      const result = await service.getCurrentCall(1);

      expect(result).toBeDefined();
      expect(result.callId).toBe(call.id);
      expect(result.status).toBe(CallStatus.ACTIVE);
    });

    it('should return null if no active/ringing call exists', async () => {
      mockCallRepository.findOne.mockResolvedValue(null);

      const result = await service.getCurrentCall(1);

      expect(result).toBeNull();
    });
  });
});
