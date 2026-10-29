import { GroupService } from './group.service';

describe('GroupService - per-user chat deletion', () => {
  const groupRepository = {};
  const groupMemberRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const service = new GroupService(
    groupRepository as any,
    groupMemberRepository as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('marks only the requesting user membership as deleted', async () => {
    const membership = {
      groupId: 'group-1',
      userId: 1,
      chatDeletedAt: null,
    };
    groupMemberRepository.findOne.mockResolvedValue(membership);
    groupMemberRepository.save.mockImplementation(async (value) => value);

    const result = await service.deleteChatForUser('group-1', 1);

    expect(groupMemberRepository.findOne).toHaveBeenCalledWith({
      where: { groupId: 'group-1', userId: 1 },
    });
    expect(groupMemberRepository.save).toHaveBeenCalledWith(membership);
    expect(membership.chatDeletedAt).toBeInstanceOf(Date);
    expect(result).toMatchObject({
      message: 'Chat deleted successfully',
      groupId: 'group-1',
    });
  });

  it('does not delete a chat for a non-member', async () => {
    groupMemberRepository.findOne.mockResolvedValue(null);

    await expect(
      service.deleteChatForUser('group-1', 999),
    ).rejects.toMatchObject({ status: 404 });
    expect(groupMemberRepository.save).not.toHaveBeenCalled();
  });
});
