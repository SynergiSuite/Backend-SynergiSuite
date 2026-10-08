import { HttpException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationType } from './entities/notification.entity';

describe('NotificationsService', () => {
  const now = new Date('2026-07-27T12:00:00.000Z');
  let repository: any;
  let service: NotificationsService;

  beforeEach(() => {
    repository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      find: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new NotificationsService(repository);
  });

  it('persists and emits newly created notifications', async () => {
    repository.save.mockImplementation(async (values) =>
      values.map((value, index) => ({
        ...value,
        id: `notification-${index}`,
        isRead: false,
        readAt: null,
        createdAt: now,
      })),
    );
    const emitter = jest.fn();
    service.setRealtimeEmitter(emitter);

    const [created] = await service.createMany([
      {
        recipientId: 12,
        actorId: 4,
        type: NotificationType.GROUP_MEMBER_ADDED,
        title: 'Added to Design',
      },
    ]);

    expect(created.recipientId).toBe(12);
    expect(emitter).toHaveBeenCalledWith(12, created);
  });

  it('returns a bounded page with unread count and cursor', async () => {
    const rows = [0, 1, 2].map(
      (index) =>
        ({
          id: `notification-${index}`,
          recipientId: 12,
          createdAt: new Date(now.getTime() - index * 1000),
        }) as Notification,
    );
    repository.find.mockResolvedValue(rows);
    repository.count.mockResolvedValue(7);

    const page = await service.findForUser(12, 2);

    expect(page.items).toHaveLength(2);
    expect(page.unreadCount).toBe(7);
    expect(page.nextCursor).toBe(rows[1].createdAt.toISOString());
  });

  it('marks only an owned notification as read', async () => {
    const notification = {
      id: 'notification-1',
      recipientId: 12,
      isRead: false,
      readAt: null,
    } as Notification;
    repository.findOne.mockResolvedValue(notification);
    repository.save.mockImplementation(async (value) => value);

    const result = await service.markRead(notification.id, 12);

    expect(result.isRead).toBe(true);
    expect(result.readAt).toBeInstanceOf(Date);
  });

  it('rejects access to a notification not owned by the user', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.markRead('notification-1', 99)).rejects.toBeInstanceOf(
      HttpException,
    );
  });
});
