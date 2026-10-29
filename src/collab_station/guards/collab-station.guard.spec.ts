import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CollabStationHelper } from '../collab_station.helper';
import { MessageOwnerGuard } from './collab-station.guard';

describe('MessageOwnerGuard', () => {
  const helper = {
    getUserWithBusiness: jest.fn(),
    findMessageById: jest.fn(),
  };
  const guard = new MessageOwnerGuard(helper as unknown as CollabStationHelper);

  const createContext = (messageId = 'message-1') =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: { email: 'sender@example.com' },
          params: { messageId },
        }),
      }),
    }) as ExecutionContext;

  beforeEach(() => jest.clearAllMocks());

  it('allows the sender to delete their message', async () => {
    helper.getUserWithBusiness.mockResolvedValue({ user_id: 1 });
    helper.findMessageById.mockResolvedValue({ senderId: 1 });

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('rejects a user who does not own the message', async () => {
    helper.getUserWithBusiness.mockResolvedValue({ user_id: 1 });
    helper.findMessageById.mockResolvedValue({ senderId: 2 });

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
