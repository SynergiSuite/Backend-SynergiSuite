import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  HttpException,
  HttpStatus,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Call } from '../entities/call.entity';
import { CallAckDto, toCallResponseDto } from '../dto/call.dto';
import { CallService } from '../services/call.service';
import { DomainEventsService } from '../../realtime/domain-events.service';
import { PresenceService } from '../../realtime/presence.service';
import { RealtimeDeliveryService } from '../../realtime/realtime-delivery.service';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: true,
  },
})
export class CallGateway implements OnGatewayInit, OnModuleInit {
  private readonly logger = new Logger(CallGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly callService: CallService,
    private readonly domainEvents: DomainEventsService,
    private readonly presenceService: PresenceService,
    private readonly realtimeDelivery: RealtimeDeliveryService,
  ) {}

  afterInit(server: Server) {
    this.realtimeDelivery.setServer(server);
  }

  onModuleInit() {
    this.domainEvents.on<Call>('call.missed', (call) => {
      const responseDto = toCallResponseDto(call);
      this.realtimeDelivery.emitToUsers(
        [call.callerId, call.recipientId],
        'call:missed',
        responseDto,
      );
    });
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

  @SubscribeMessage('call:invite')
  async handleCallInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { groupId: string },
  ): Promise<CallAckDto> {
    const user = client.data.user;
    if (!user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      };
    }

    this.logger.log(
      `Call invite request received from ${user.email} for group ${payload.groupId}`,
    );

    try {
      const call = await this.callService.initiateCall(
        payload.groupId,
        user.user_id,
      );
      const responseDto = toCallResponseDto(call);
      const recipientSocketCount = this.presenceService.getSocketCount(
        call.recipientId,
      );

      this.realtimeDelivery.emitToUser(
        call.callerId,
        'call:ringing',
        responseDto,
      );
      this.realtimeDelivery.emitToUser(
        call.recipientId,
        'call:incoming',
        responseDto,
      );

      this.logger.log(
        `Call invite delivered: call=${call.id}, caller=${call.callerId}, recipient=${call.recipientId}, recipientSocketCount=${recipientSocketCount}`,
      );

      return {
        success: true,
        call: responseDto,
        delivery: {
          recipientOnline: recipientSocketCount > 0,
          recipientSocketCount,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error processing call invite from ${user.email}`,
        error.message,
      );
      return this.formatAckError(error);
    }
  }

  @SubscribeMessage('call:accept')
  async handleCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string },
  ): Promise<CallAckDto> {
    const user = client.data.user;
    if (!user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      };
    }

    try {
      const call = await this.callService.acceptCall(
        payload.callId,
        user.user_id,
      );
      const responseDto = toCallResponseDto(call);
      this.realtimeDelivery.emitToUsers(
        [call.callerId, call.recipientId],
        'call:accepted',
        responseDto,
      );
      return { success: true, call: responseDto };
    } catch (error) {
      this.logger.error(
        `Error accepting call ${payload.callId} by ${user.email}`,
        error.message,
      );
      return this.formatAckError(error);
    }
  }

  @SubscribeMessage('call:reject')
  async handleCallReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string },
  ): Promise<CallAckDto> {
    const user = client.data.user;
    if (!user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      };
    }

    try {
      const call = await this.callService.rejectCall(
        payload.callId,
        user.user_id,
      );
      const responseDto = toCallResponseDto(call);
      this.realtimeDelivery.emitToUsers(
        [call.callerId, call.recipientId],
        'call:rejected',
        responseDto,
      );
      return { success: true, call: responseDto };
    } catch (error) {
      this.logger.error(
        `Error rejecting call ${payload.callId} by ${user.email}`,
        error.message,
      );
      return this.formatAckError(error);
    }
  }

  @SubscribeMessage('call:cancel')
  async handleCallCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string },
  ): Promise<CallAckDto> {
    const user = client.data.user;
    if (!user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      };
    }

    try {
      const call = await this.callService.cancelCall(
        payload.callId,
        user.user_id,
      );
      const responseDto = toCallResponseDto(call);
      this.realtimeDelivery.emitToUsers(
        [call.callerId, call.recipientId],
        'call:cancelled',
        responseDto,
      );
      if (call.status === 'ended') {
        this.realtimeDelivery.emitToUsers(
          [call.callerId, call.recipientId],
          'call:ended',
          responseDto,
        );
      }
      return { success: true, call: responseDto };
    } catch (error) {
      this.logger.error(
        `Error cancelling call ${payload.callId} by ${user.email}`,
        error.message,
      );
      return this.formatAckError(error);
    }
  }

  @SubscribeMessage('call:end')
  async handleCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string },
  ): Promise<CallAckDto> {
    const user = client.data.user;
    if (!user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      };
    }

    try {
      const call = await this.callService.endCall(payload.callId, user.user_id);
      const responseDto = toCallResponseDto(call);
      this.realtimeDelivery.emitToUsers(
        [call.callerId, call.recipientId],
        'call:ended',
        responseDto,
      );
      return { success: true, call: responseDto };
    } catch (error) {
      this.logger.error(
        `Error ending call ${payload.callId} by ${user.email}`,
        error.message,
      );
      return this.formatAckError(error);
    }
  }
}
