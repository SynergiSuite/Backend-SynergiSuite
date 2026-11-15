import { Injectable } from '@nestjs/common';

@Injectable()
export class PresenceService {
  private readonly activeSockets = new Map<number, Set<string>>();

  addSocket(userId: number, socketId: string): void {
    if (!this.activeSockets.has(userId)) {
      this.activeSockets.set(userId, new Set());
    }
    this.activeSockets.get(userId).add(socketId);
  }

  removeSocket(userId: number, socketId: string): void {
    const socketSet = this.activeSockets.get(userId);
    if (!socketSet) {
      return;
    }

    socketSet.delete(socketId);
    if (socketSet.size === 0) {
      this.activeSockets.delete(userId);
    }
  }

  getSocketCount(userId: number): number {
    return this.activeSockets.get(userId)?.size || 0;
  }

  isOnline(userId: number): boolean {
    return this.getSocketCount(userId) > 0;
  }
}
