import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  CreateMeetingDto,
  MeetingAckDto,
  toMeetingResponseDto,
} from '../dto/meeting.dto';
import { MeetingService } from '../services/meeting.service';
import { RealtimeDeliveryService } from '../../realtime/realtime-delivery.service';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: true,
  },
})
export class MeetingGateway implements OnGatewayInit {
  private readonly logger = new Logger(MeetingGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly meetingService: MeetingService,
    private readonly realtimeDelivery: RealtimeDeliveryService,
  ) {}

  afterInit(server: Server) {
    this.realtimeDelivery.setServer(server);
  }

  private formatAckError(error: any) {
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || 'An unexpected error occurred';
    let code = 'INTERNAL_SERVER_ERROR';
    if (status === HttpStatus.BAD_REQUEST) code = 'BAD_REQUEST';
    if (status === HttpStatus.FORBIDDEN) code = 'FORBIDDEN';
    if (status === HttpStatus.NOT_FOUND) code = 'NOT_FOUND';
    if (status === HttpStatus.CONFLICT) code = 'CONFLICT';
    if (status === HttpStatus.TOO_MANY_REQUESTS) code = 'TOO_MANY_REQUESTS';
    return {
      success: false as const,
      error: { code, message },
    };
  }

  private emitToMeetingParticipants(
    meeting: any,
    event: string,
    payload: unknown,
  ) {
    const rooms = new Set<string>([meeting.groupId]);
    for (const participant of meeting.participants || []) {
      rooms.add(`user:${participant.userId}`);
    }
    this.realtimeDelivery.emitToRooms([...rooms], event, payload);
  }

  @SubscribeMessage('meeting:create')
  async handleMeetingCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateMeetingDto,
  ): Promise<MeetingAckDto> {
    const user = client.data.user;
    if (!user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      };
    }

    try {
      const meeting = await this.meetingService.createMeeting(
        payload,
        user.user_id,
        user.name,
      );
      const responseDto = toMeetingResponseDto(meeting);
      this.emitToMeetingParticipants(meeting, 'meeting:created', responseDto);
      return { success: true, meeting: responseDto };
    } catch (error) {
      this.logger.error(
        `Error creating meeting by ${user.email}`,
        error.message,
      );
      return this.formatAckError(error);
    }
  }

  @SubscribeMessage('meeting:start')
  async handleMeetingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { meetingId: string },
  ): Promise<MeetingAckDto> {
    const user = client.data.user;
    if (!user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      };
    }

    try {
      const meeting = await this.meetingService.startMeeting(
        payload.meetingId,
        user.user_id,
      );
      const responseDto = toMeetingResponseDto(meeting);
      this.emitToMeetingParticipants(meeting, 'meeting:started', responseDto);
      return { success: true, meeting: responseDto };
    } catch (error) {
      this.logger.error(
        `Error starting meeting ${payload.meetingId} by ${user.email}`,
        error.message,
      );
      return this.formatAckError(error);
    }
  }

  @SubscribeMessage('meeting:join')
  async handleMeetingJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { meetingId: string },
  ): Promise<MeetingAckDto> {
    const user = client.data.user;
    if (!user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      };
    }

    try {
      const meeting = await this.meetingService.joinMeeting(
        payload.meetingId,
        user.user_id,
      );
      const responseDto = toMeetingResponseDto(meeting);
      this.emitToMeetingParticipants(meeting, 'meeting:joined', {
        meeting: responseDto,
        userId: user.user_id,
      });
      return { success: true, meeting: responseDto };
    } catch (error) {
      this.logger.error(
        `Error joining meeting ${payload.meetingId} by ${user.email}`,
        error.message,
      );
      return this.formatAckError(error);
    }
  }

  @SubscribeMessage('meeting:leave')
  async handleMeetingLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { meetingId: string },
  ): Promise<MeetingAckDto> {
    const user = client.data.user;
    if (!user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      };
    }

    try {
      const meeting = await this.meetingService.leaveMeeting(
        payload.meetingId,
        user.user_id,
      );
      const responseDto = toMeetingResponseDto(meeting);
      this.emitToMeetingParticipants(meeting, 'meeting:left', {
        meeting: responseDto,
        userId: user.user_id,
      });
      return { success: true, meeting: responseDto };
    } catch (error) {
      this.logger.error(
        `Error leaving meeting ${payload.meetingId} by ${user.email}`,
        error.message,
      );
      return this.formatAckError(error);
    }
  }

  @SubscribeMessage('meeting:end')
  async handleMeetingEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { meetingId: string },
  ): Promise<MeetingAckDto> {
    const user = client.data.user;
    if (!user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      };
    }

    try {
      const meeting = await this.meetingService.endMeeting(
        payload.meetingId,
        user.user_id,
      );
      const responseDto = toMeetingResponseDto(meeting);
      this.emitToMeetingParticipants(meeting, 'meeting:ended', responseDto);
      return { success: true, meeting: responseDto };
    } catch (error) {
      this.logger.error(
        `Error ending meeting ${payload.meetingId} by ${user.email}`,
        error.message,
      );
      return this.formatAckError(error);
    }
  }

  @SubscribeMessage('meeting:cancel')
  async handleMeetingCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { meetingId: string },
  ): Promise<MeetingAckDto> {
    const user = client.data.user;
    if (!user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      };
    }

    try {
      const meeting = await this.meetingService.cancelMeeting(
        payload.meetingId,
        user.user_id,
      );
      const responseDto = toMeetingResponseDto(meeting);
      this.emitToMeetingParticipants(meeting, 'meeting:cancelled', responseDto);
      return { success: true, meeting: responseDto };
    } catch (error) {
      this.logger.error(
        `Error cancelling meeting ${payload.meetingId} by ${user.email}`,
        error.message,
      );
      return this.formatAckError(error);
    }
  }
}
