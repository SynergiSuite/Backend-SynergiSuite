import { TeamsService } from './teams.service';

describe('TeamsService project chat membership sync', () => {
  it('syncs team and existing project groups when members join and leave', async () => {
    const team = {
      id: 'team-id',
      name: 'Delivery',
      description: 'Delivery team',
      business: { business_id: 10 },
      leader: { user_id: 99 },
      members: [{ user: { user_id: 1 } }, { user: { user_id: 2 } }],
    } as any;
    const savedTeam = { ...team, members: undefined };
    const teamsHelper = {
      getUserWithBusiness: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue(team),
      updateTeam: jest.fn().mockResolvedValue({
        savedTeam,
        memberIds: [2, 3],
      }),
    } as any;
    const groupService = {
      addMemberByTeamId: jest.fn(),
      removeMemberByTeamId: jest.fn(),
      addMemberToProjectGroupsForTeam: jest.fn(),
      removeMemberFromProjectGroupsForTeam: jest.fn(),
    } as any;
    const activityService = { logFieldChanges: jest.fn() } as any;
    const service = new TeamsService(
      teamsHelper,
      groupService,
      activityService,
    );

    await service.updateTeam(
      {
        id: 'team-id',
        name: 'Delivery',
        description: 'Delivery team',
        members: [2, 3],
        leader_id: 99,
      },
      undefined,
    );

    expect(groupService.addMemberByTeamId).toHaveBeenCalledWith('team-id', 3);
    expect(groupService.addMemberToProjectGroupsForTeam).toHaveBeenCalledWith(
      'team-id',
      3,
    );
    expect(groupService.removeMemberByTeamId).toHaveBeenCalledWith(
      'team-id',
      1,
    );
    expect(
      groupService.removeMemberFromProjectGroupsForTeam,
    ).toHaveBeenCalledWith('team-id', 1);
  });
});
