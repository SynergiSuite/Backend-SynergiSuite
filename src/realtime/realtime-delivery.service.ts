import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeDeliveryService {
  private readonly logger = new Logger(RealtimeDeliveryService.name);
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  emitToUser(userId: number, event: string, payload: unknown): void {
    this.emitToRoom(`user:${userId}`, event, payload);
  }

  emitToUsers(userIds: number[], event: string, payload: unknown): void {
    const rooms = userIds.map((userId) => `user:${userId}`);
    this.emitToRooms(rooms, event, payload);
  }

  emitToGroup(groupId: string, event: string, payload: unknown): void {
    this.emitToRoom(groupId, event, payload);
  }

  emitToRooms(rooms: string[], event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.warn(`Realtime server unavailable for event: ${event}`);
      return;
    }
    this.server.to([...new Set(rooms)]).emit(event, payload);
  }

  private emitToRoom(room: string, event: string, payload: unknown): void {
    this.emitToRooms([room], event, payload);
  }
}
