import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';

export interface CreateNotificationInput {
  recipientId: number;
  actorId?: number | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
}

type RealtimeEmitter = (
  recipientId: number,
  notification: Notification,
) => void;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private realtimeEmitter: RealtimeEmitter | null = null;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  setRealtimeEmitter(emitter: RealtimeEmitter): void {
    this.realtimeEmitter = emitter;
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    const [notification] = await this.createMany([input]);
    return notification;
  }

  async createMany(inputs: CreateNotificationInput[]): Promise<Notification[]> {
    if (!inputs.length) {
      return [];
    }

    const entities = inputs.map((input) =>
      this.notificationRepository.create({
        recipientId: input.recipientId,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        data: input.data ?? null,
      }),
    );
    const notifications = await this.notificationRepository.save(entities);

    notifications.forEach((notification) => {
      try {
        this.realtimeEmitter?.(notification.recipientId, notification);
      } catch (error) {
        this.logger.error(
          `Failed to emit notification ${notification.id}`,
          error.stack ?? error.message,
        );
      }
    });

    return notifications;
  }

  async findForUser(recipientId: number, limit: number = 20, cursor?: string) {
    const where = cursor
      ? { recipientId, createdAt: LessThan(new Date(cursor)) }
      : { recipientId };

    const [rows, unreadCount] = await Promise.all([
      this.notificationRepository.find({
        where,
        order: { createdAt: 'DESC' },
        take: limit + 1,
      }),
      this.getUnreadCount(recipientId),
    ]);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items,
      unreadCount,
      nextCursor:
        hasMore && items.length
          ? items[items.length - 1].createdAt.toISOString()
          : null,
    };
  }

  async getUnreadCount(recipientId: number): Promise<number> {
    return this.notificationRepository.count({
      where: { recipientId, isRead: false },
    });
  }

  async markRead(id: string, recipientId: number): Promise<Notification> {
    const notification = await this.findOwnedNotification(id, recipientId);
    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      return this.notificationRepository.save(notification);
    }
    return notification;
  }

  async markAllRead(recipientId: number): Promise<{ updated: number }> {
    const result = await this.notificationRepository.update(
      { recipientId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { updated: result.affected ?? 0 };
  }

  async delete(id: string, recipientId: number): Promise<{ id: string }> {
    await this.findOwnedNotification(id, recipientId);
    await this.notificationRepository.delete({ id, recipientId });
    return { id };
  }

  private async findOwnedNotification(
    id: string,
    recipientId: number,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, recipientId },
    });
    if (!notification) {
      throw new HttpException('Notification not found', HttpStatus.NOT_FOUND);
    }
    return notification;
  }
}
