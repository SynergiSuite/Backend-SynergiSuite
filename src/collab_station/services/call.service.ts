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
import { Repository, In, LessThan, DataSource } from 'typeorm';
import { Call, CallStatus } from '../entities/call.entity';
import { Group, GroupType } from '../entities/group.entity';
import { GroupMember } from '../entities/group-member.entity';
import {
  CallResponseDto,
  CallTokenResponseDto,
  toCallResponseDto,
} from '../dto/call.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { DomainEventsService } from '../../realtime/domain-events.service';
import { LiveKitService } from '../../media/livekit.service';

@Injectable()
export class CallService implements OnModuleInit {
  private readonly logger = new Logger(CallService.name);

  // In-memory ring timeout tracking
  private readonly ringTimeouts = new Map<string, NodeJS.Timeout>();

  // Rate limiting: userId → timestamps of recent invites
  private readonly inviteRateLimit = new Map<number, number[]>();
  private readonly RATE_LIMIT_MAX = 5;
  private readonly RATE_LIMIT_WINDOW_MS = 60_000;

  constructor(
    @InjectRepository(Call)
    private readonly callRepository: Repository<Call>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
    private readonly dataSource: DataSource,
    private readonly domainEvents: DomainEventsService,
    private readonly liveKitService: LiveKitService,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  onModuleInit() {
    this.liveKitService.validateConfiguration('calls');
  }

  // Check rate limit for call invitations
  private checkRateLimit(userId: number): void {
    const now = Date.now();
    const timestamps = this.inviteRateLimit.get(userId) || [];
    // Filter to only timestamps within the window
    const recent = timestamps.filter(
      (t) => now - t < this.RATE_LIMIT_WINDOW_MS,
    );

    if (recent.length >= this.RATE_LIMIT_MAX) {
      throw new HttpException(
        'Too many call invitations. Please wait before trying again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.inviteRateLimit.set(userId, recent);
  }

  // Schedule a missed-call timeout
  private scheduleRingTimeout(callId: string): void {
    const timeoutSeconds = parseInt(
      process.env.CALL_RING_TIMEOUT_SECONDS || '30',
      10,
    );
    this.logger.log(
      `Scheduling ring timeout for call ${callId}: ${timeoutSeconds}s`,
    );

    const timeout = setTimeout(async () => {
      try {
        await this.markMissed(callId);
      } catch (error) {
        this.logger.error(
          `Error marking call as missed: ${callId}`,
          error.message,
        );
      }
    }, timeoutSeconds * 1000);

    this.ringTimeouts.set(callId, timeout);
  }

  // Clear a ring timeout
  private clearRingTimeout(callId: string): void {
    const timeout = this.ringTimeouts.get(callId);
    if (timeout) {
      clearTimeout(timeout);
      this.ringTimeouts.delete(callId);
      this.logger.log(`Ring timeout cleared for call: ${callId}`);
    }
  }

  // Check if a user has a ringing or active call
  private async isUserBusy(userId: number): Promise<boolean> {
    const activeStatuses = [CallStatus.RINGING, CallStatus.ACTIVE];
    const existingCall = await this.callRepository.findOne({
      where: [
        { callerId: userId, status: In(activeStatuses) },
        { recipientId: userId, status: In(activeStatuses) },
      ],
    });
    return !!existingCall;
  }

  // Initiate a new call
  async initiateCall(groupId: string, callerId: number): Promise<Call> {
    this.logger.log(`Initiating call in group ${groupId} by user ${callerId}`);

    // Rate limit check
    this.checkRateLimit(callerId);

    // Use a transaction for atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verify the group is a direct chat
      const group = await this.groupRepository.findOne({
        where: { id: groupId },
        relations: ['members'],
      });

      if (!group) {
        throw new HttpException('Group not found', HttpStatus.NOT_FOUND);
      }

      if (group.type !== GroupType.DIRECT) {
        throw new HttpException(
          'Voice calls are only supported in direct chats',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 2. Verify caller is a member
      const callerMembership = group.members?.find(
        (m) => m.userId === callerId,
      );
      if (!callerMembership) {
        throw new HttpException(
          'You are not a member of this group',
          HttpStatus.FORBIDDEN,
        );
      }

      // 3. Derive recipient from group membership (never trust client-supplied ID)
      const recipientMembership = group.members?.find(
        (m) => m.userId !== callerId,
      );
      if (!recipientMembership) {
        throw new HttpException(
          'No other participant found in this direct chat',
          HttpStatus.BAD_REQUEST,
        );
      }

      const recipientId = recipientMembership.userId;

      // 4. Prevent self-call
      if (callerId === recipientId) {
        throw new HttpException(
          'You cannot call yourself',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 5. Check if either participant is busy
      const callerBusy = await this.isUserBusy(callerId);
      if (callerBusy) {
        throw new HttpException(
          'You already have an active or ringing call',
          HttpStatus.CONFLICT,
        );
      }

      const recipientBusy = await this.isUserBusy(recipientId);
      if (recipientBusy) {
        throw new HttpException(
          'The recipient is currently busy',
          HttpStatus.CONFLICT,
        );
      }

      // 6. Create the call record. The LiveKit room must match the call ID so both
      // participants always request credentials for the same room.
      const callId = randomUUID();
      const call = this.callRepository.create({
        id: callId,
        groupId,
        callerId,
        recipientId,
        status: CallStatus.RINGING,
        livekitRoomName: callId,
      });

      const saved = await queryRunner.manager.save(call);
      await queryRunner.commitTransaction();

      // 7. Load full relations
      const fullCall = await this.callRepository.findOne({
        where: { id: saved.id },
        relations: ['caller', 'recipient', 'group'],
      });

      // 8. Schedule ring timeout
      this.scheduleRingTimeout(fullCall.id);

      this.logger.log(
        `Call initiated: ${fullCall.id} (${callerId} → ${recipientId})`,
      );
      return fullCall;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error initiating call in group ${groupId}`,
        error.message,
      );
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    } finally {
      await queryRunner.release();
    }
  }

  // Accept a ringing call
  async acceptCall(callId: string, recipientId: number): Promise<Call> {
    this.logger.log(`Accepting call ${callId} by user ${recipientId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const call = await queryRunner.manager.findOne(Call, {
        where: { id: callId },
        relations: ['caller', 'recipient'],
      });

      if (!call) {
        throw new HttpException('Call not found', HttpStatus.NOT_FOUND);
      }

      if (call.recipientId !== recipientId) {
        throw new HttpException(
          'Only the recipient can accept the call',
          HttpStatus.FORBIDDEN,
        );
      }

      if (call.status !== CallStatus.RINGING) {
        throw new HttpException(
          `Cannot accept a call with status: ${call.status}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      call.status = CallStatus.ACTIVE;
      call.answeredAt = new Date();
      await queryRunner.manager.save(call);
      await queryRunner.commitTransaction();

      // Clear the ring timeout
      this.clearRingTimeout(callId);

      this.logger.log(`Call accepted: ${callId}`);
      return call;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error accepting call ${callId}`, error.message);
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    } finally {
      await queryRunner.release();
    }
  }

  // Reject a ringing call
  async rejectCall(callId: string, recipientId: number): Promise<Call> {
    this.logger.log(`Rejecting call ${callId} by user ${recipientId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const call = await queryRunner.manager.findOne(Call, {
        where: { id: callId },
        relations: ['caller', 'recipient'],
      });

      if (!call) {
        throw new HttpException('Call not found', HttpStatus.NOT_FOUND);
      }

      if (call.recipientId !== recipientId) {
        throw new HttpException(
          'Only the recipient can reject the call',
          HttpStatus.FORBIDDEN,
        );
      }

      if (call.status !== CallStatus.RINGING) {
        throw new HttpException(
          `Cannot reject a call with status: ${call.status}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      call.status = CallStatus.REJECTED;
      call.endedAt = new Date();
      await queryRunner.manager.save(call);
      await queryRunner.commitTransaction();

      this.clearRingTimeout(callId);

      this.logger.log(`Call rejected: ${callId}`);
      return call;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error rejecting call ${callId}`, error.message);
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    } finally {
      await queryRunner.release();
    }
  }

  // Cancel a ringing call, or end an active call if the client uses call:cancel for hangup.
  async cancelCall(callId: string, userId: number): Promise<Call> {
    this.logger.log(`Cancelling call ${callId} by user ${userId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const call = await queryRunner.manager.findOne(Call, {
        where: { id: callId },
        relations: ['caller', 'recipient'],
      });

      if (!call) {
        throw new HttpException('Call not found', HttpStatus.NOT_FOUND);
      }

      if (call.status === CallStatus.RINGING && call.callerId !== userId) {
        throw new HttpException(
          'Only the caller can cancel the call',
          HttpStatus.FORBIDDEN,
        );
      }

      if (
        call.status === CallStatus.ACTIVE &&
        call.callerId !== userId &&
        call.recipientId !== userId
      ) {
        throw new HttpException(
          'Only call participants can cancel the call',
          HttpStatus.FORBIDDEN,
        );
      }

      if (![CallStatus.RINGING, CallStatus.ACTIVE].includes(call.status)) {
        throw new HttpException(
          `Cannot cancel a call with status: ${call.status}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      call.status =
        call.status === CallStatus.ACTIVE
          ? CallStatus.ENDED
          : CallStatus.CANCELLED;
      call.endedAt = new Date();
      await queryRunner.manager.save(call);
      await queryRunner.commitTransaction();

      this.clearRingTimeout(callId);

      this.logger.log(`Call cancelled: ${callId}`);
      return call;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error cancelling call ${callId}`, error.message);
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    } finally {
      await queryRunner.release();
    }
  }

  // End an active call (either participant)
  async endCall(callId: string, userId: number): Promise<Call> {
    this.logger.log(`Ending call ${callId} by user ${userId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const call = await queryRunner.manager.findOne(Call, {
        where: { id: callId },
        relations: ['caller', 'recipient'],
      });

      if (!call) {
        throw new HttpException('Call not found', HttpStatus.NOT_FOUND);
      }

      if (call.callerId !== userId && call.recipientId !== userId) {
        throw new HttpException(
          'Only call participants can end the call',
          HttpStatus.FORBIDDEN,
        );
      }

      if (call.status !== CallStatus.ACTIVE) {
        throw new HttpException(
          `Cannot end a call with status: ${call.status}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      call.status = CallStatus.ENDED;
      call.endedAt = new Date();
      await queryRunner.manager.save(call);
      await queryRunner.commitTransaction();

      this.logger.log(`Call ended: ${callId}`);
      return call;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error ending call ${callId}`, error.message);
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    } finally {
      await queryRunner.release();
    }
  }

  // Mark a ringing call as missed (called by timeout)
  async markMissed(callId: string): Promise<Call | null> {
    this.logger.log(`Marking call as missed: ${callId}`);

    try {
      const call = await this.callRepository.findOne({
        where: { id: callId },
        relations: ['caller', 'recipient'],
      });

      if (!call) {
        this.logger.warn(`Call not found for missed marking: ${callId}`);
        return null;
      }

      // Idempotent: only transition from ringing
      if (call.status !== CallStatus.RINGING) {
        this.logger.log(
          `Call ${callId} is already in status: ${call.status}, skipping missed marking`,
        );
        return call;
      }

      call.status = CallStatus.MISSED;
      call.endedAt = new Date();
      const saved = await this.callRepository.save(call);

      this.clearRingTimeout(callId);

      this.domainEvents.emit('call.missed', saved);

      this.notificationsService
        ?.create({
          recipientId: saved.recipientId,
          actorId: saved.callerId,
          type: NotificationType.MISSED_CALL,
          title: `Missed call from ${saved.caller?.name || 'Someone'}`,
          body: 'You missed a voice call',
          data: {
            callId: saved.id,
            groupId: saved.groupId,
            href: '/collab-station',
          },
        })
        .catch((error) => {
          this.logger.error(
            `Failed to create missed-call notification for ${saved.id}`,
            error.stack ?? error.message,
          );
        });

      this.logger.log(`Call marked as missed: ${callId}`);
      return saved;
    } catch (error) {
      this.logger.error(
        `Error marking call as missed: ${callId}`,
        error.message,
      );
      return null;
    }
  }

  // Generate a LiveKit access token for a call participant
  async getCallToken(
    callId: string,
    userId: number,
    userName?: string,
  ): Promise<CallTokenResponseDto> {
    this.logger.log(
      `Generating LiveKit token for call ${callId}, user ${userId}`,
    );

    const call = await this.callRepository.findOne({
      where: { id: callId },
      relations: ['caller', 'recipient'],
    });

    if (!call) {
      throw new HttpException('Call not found', HttpStatus.NOT_FOUND);
    }

    if (call.callerId !== userId && call.recipientId !== userId) {
      throw new HttpException(
        'You are not a participant of this call',
        HttpStatus.FORBIDDEN,
      );
    }

    if (call.status !== CallStatus.ACTIVE) {
      throw new HttpException(
        'Call must be active to get a token',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(
      `LiveKit token generated for call ${callId}, user ${userId}`,
    );

    return this.liveKitService.createRoomToken({
      roomName: call.livekitRoomName || callId,
      userId,
      userName,
      ttl: '5m',
    });
  }

  // Get the user's current ringing or active call
  async getCurrentCall(userId: number): Promise<CallResponseDto | null> {
    this.logger.log(`Finding current call for user: ${userId}`);

    const activeStatuses = [CallStatus.RINGING, CallStatus.ACTIVE];
    const call = await this.callRepository.findOne({
      where: [
        { callerId: userId, status: In(activeStatuses) },
        { recipientId: userId, status: In(activeStatuses) },
      ],
      relations: ['caller', 'recipient'],
      order: { createdAt: 'DESC' },
    });

    if (!call) return null;

    return toCallResponseDto(call);
  }

  // Paginated missed calls for a user. A missed call belongs to the recipient who did not answer.
  async getMissedCalls(
    userId: number,
    limit: number = 20,
    cursor?: string,
  ): Promise<CallResponseDto[]> {
    this.logger.log(
      `Finding missed calls for user: ${userId}, limit: ${limit}, cursor: ${cursor}`,
    );

    try {
      const whereCondition: any = {
        recipientId: userId,
        status: CallStatus.MISSED,
      };

      if (cursor) {
        whereCondition.createdAt = LessThan(new Date(cursor));
      }

      const calls = await this.callRepository.find({
        where: whereCondition,
        relations: ['caller', 'recipient'],
        order: { createdAt: 'DESC' },
        take: limit,
      });

      return calls.map((call) => toCallResponseDto(call));
    } catch (error) {
      this.logger.error(
        `Error finding missed calls for user: ${userId}`,
        error.message,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Paginated call history for a user
  async getCallHistory(
    userId: number,
    limit: number = 20,
    cursor?: string,
  ): Promise<CallResponseDto[]> {
    this.logger.log(
      `Finding call history for user: ${userId}, limit: ${limit}, cursor: ${cursor}`,
    );

    try {
      const whereConditions: any[] = [
        { callerId: userId },
        { recipientId: userId },
      ];

      if (cursor) {
        const cursorDate = new Date(cursor);
        whereConditions[0] = {
          callerId: userId,
          createdAt: LessThan(cursorDate),
        };
        whereConditions[1] = {
          recipientId: userId,
          createdAt: LessThan(cursorDate),
        };
      }

      const calls = await this.callRepository.find({
        where: whereConditions,
        relations: ['caller', 'recipient'],
        order: { createdAt: 'DESC' },
        take: limit,
      });

      return calls.map((call) => {
        const dto = toCallResponseDto(call);
        // Add computed duration for ended/active calls
        if (call.answeredAt && call.endedAt) {
          (dto as any).durationSeconds = Math.floor(
            (call.endedAt.getTime() - call.answeredAt.getTime()) / 1000,
          );
        }
        return dto;
      });
    } catch (error) {
      this.logger.error(
        `Error finding call history for user: ${userId}`,
        error.message,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
