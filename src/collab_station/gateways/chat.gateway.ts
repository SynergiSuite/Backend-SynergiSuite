import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MessageService } from '../services/message.service';
import { GroupService } from '../services/group.service';
import { MessageType } from '../entities/message.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { PresenceService } from '../../realtime/presence.service';
import { RealtimeDeliveryService } from '../../realtime/realtime-delivery.service';
import { SocketAuthService } from '../../realtime/socket-auth.service';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly messageService: MessageService,
    private readonly groupService: GroupService,
    private readonly notificationsService: NotificationsService,
    private readonly presenceService: PresenceService,
    private readonly realtimeDelivery: RealtimeDeliveryService,
    private readonly socketAuthService: SocketAuthService,
  ) {}

  afterInit(server: Server) {
    this.realtimeDelivery.setServer(server);
    this.notificationsService.setRealtimeEmitter(
      (recipientId, notification) => {
        this.realtimeDelivery.emitToUser(
          recipientId,
          'notification:new',
          notification,
        );
      },
    );
  }

  // Authenticate user on connection and auto-join all group rooms
  async handleConnection(client: Socket) {
    try {
      const user = await this.socketAuthService.authenticate(client);
      client.data.user = user;

      this.logger.log(`Client connected: ${client.id} | User: ${user.email}`);

      // Join private user:{userId} room
      client.join(`user:${user.user_id}`);
      this.presenceService.addSocket(user.user_id, client.id);

      this.autoJoinGroupRooms(client, user).catch((error) => {
        this.logger.error(
          `Error auto-joining group rooms for user ${user.email}`,
          error.stack ?? error.message,
        );
      });
    } catch (error) {
      this.logger.error(
        `Socket authentication failed: ${client.id}`,
        error.message,
      );
      client.disconnect();
    }
  }

  private async autoJoinGroupRooms(
    client: Socket,
    user: { user_id: number; email: string; businessId?: number },
  ) {
    const groupIds = await this.groupService.findGroupIdsForUser(
      user.user_id,
      user.businessId,
    );
    for (const groupId of groupIds) {
      if (!client.connected) {
        return;
      }
      client.join(groupId);
      this.logger.log(
        `Auto-joined user ${user.email} to group room: ${groupId}`,
      );
    }
    client.emit('group:rooms_joined', {
      groupIds,
    });
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
    this.server.to([...rooms]).emit(event, payload);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const user = client.data.user;
    if (user && user.user_id) {
      this.presenceService.removeSocket(user.user_id, client.id);
    }
  }

  @SubscribeMessage('group:join')
  async handleJoinGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { groupId: string },
  ) {
    const user = client.data.user;
    if (!user) return;

    this.logger.log(`User ${user.email} joining group: ${payload.groupId}`);

    try {
      // Verify membership before joining
      const isMember = await this.messageService.isGroupMember(
        payload.groupId,
        user.user_id,
      );
      if (!isMember) {
        this.logger.error(
          `User ${user.email} is not a member of group ${payload.groupId}`,
        );
        client.emit('error', { message: 'You are not a member of this group' });
        return;
      }

      client.join(payload.groupId);

      // Fetch last 50 messages with signed URLs and emit to joining socket only
      const messages = await this.messageService.findByGroup(
        payload.groupId,
        50,
      );
      client.emit('message:history', messages);
    } catch (error) {
      this.logger.error(
        `Error joining group ${payload.groupId} for ${user.email}`,
        error.stack ?? error.message,
      );
      client.emit('error', {
        message: error.message || 'Failed to join group',
      });
    }
  }

  @SubscribeMessage('group:leave')
  handleLeaveGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { groupId: string },
  ) {
    const user = client.data.user;
    if (!user) return;

    this.logger.log(`User ${user.email} leaving group: ${payload.groupId}`);
    client.leave(payload.groupId);
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      groupId: string;
      text?: string;
      type?: string;
      fileUrl?: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
      replyToId?: string;
    },
  ) {
    const user = client.data.user;
    if (!user) return;

    this.logger.log(
      `User ${user.email} sending message to group: ${payload.groupId}`,
    );

    try {
      // Verify membership
      const isMember = await this.messageService.isGroupMember(
        payload.groupId,
        user.user_id,
      );
      if (!isMember) {
        this.logger.error(
          `User ${user.email} is not a member of group ${payload.groupId}`,
        );
        client.emit('error', { message: 'You are not a member of this group' });
        return;
      }

      // Validate that at least text or fileUrl is provided
      if (!payload.text && !payload.fileUrl) {
        this.logger.error(`Empty message rejected from user ${user.email}`);
        client.emit('error', {
          message: 'Message must contain either text or a file attachment',
        });
        return;
      }

      const message = await this.messageService.save(
        payload.groupId,
        user.user_id,
        {
          text: payload.text,
          type: payload.type as MessageType,
          fileUrl: payload.fileUrl,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          fileSize: payload.fileSize,
          replyToId: payload.replyToId,
        },
      );

      // Convert to response DTO with signed URL before broadcasting
      const responseDto = await this.messageService.toResponseDto(message);
      this.server.to(payload.groupId).emit('message:received', responseDto);
      this.messageService.notifyRecipients(message).catch((error) => {
        this.logger.error(
          `Message notification creation failed for ${message.id}`,
          error.stack ?? error.message,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error sending message from ${user.email}`,
        error.message,
      );
      client.emit('error', {
        message: error.message || 'Failed to send message',
      });
    }
  }

  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string },
  ) {
    const user = client.data.user;
    if (!user) return;

    this.logger.log(
      `User ${user.email} deleting message: ${payload.messageId}`,
    );
    const result = await this.messageService.softDelete(
      payload.messageId,
      user.user_id,
    );

    this.server.to(result.groupId).emit('message:deleted', {
      messageId: result.messageId,
      groupId: result.groupId,
    });
  }

  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; text: string },
  ) {
    const user = client.data.user;
    if (!user) return;

    this.logger.log(`User ${user.email} editing message: ${payload.messageId}`);
    const updatedMessage = await this.messageService.update(
      payload.messageId,
      user.user_id,
      payload.text,
    );

    this.server
      .to(updatedMessage.groupId)
      .emit('message:updated', updatedMessage);
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { groupId: string },
  ) {
    const user = client.data.user;
    if (!user) return;

    client.to(payload.groupId).emit('user:typing', {
      groupId: payload.groupId,
      userId: user.user_id,
      username: user.name,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { groupId: string },
  ) {
    const user = client.data.user;
    if (!user) return;

    client.to(payload.groupId).emit('user:stopped_typing', {
      groupId: payload.groupId,
      userId: user.user_id,
    });
  }
}
