import { ProjectsService } from './projects.service';

describe('ProjectsService project chat membership sync', () => {
  it('adds/removes members when project teams change and repairs the group', async () => {
    const project = {
      id: 'project-id',
      teams: [{ id: 'old-team' }],
    } as any;
    const projectsHelper = {
      findProject: jest.fn().mockResolvedValue(project),
      saveProject: jest.fn().mockImplementation(async (value) => value),
    } as any;
    const teamService = {
      findTeams: jest.fn().mockResolvedValue([{ id: 'new-team' }]),
      findOne: jest.fn().mockImplementation(async (id) => ({
        id,
        leader: { user_id: id === 'old-team' ? 1 : 3 },
      })),
      findTeamMember: jest
        .fn()
        .mockImplementation(async (id) =>
          id === 'old-team'
            ? [{ user: { user_id: 2 } }]
            : [{ user: { user_id: 4 } }],
        ),
    } as any;
    const groupService = {
      addMemberByProjectId: jest.fn(),
      removeMemberByProjectId: jest.fn(),
      syncProjectGroupMembers: jest.fn(),
    } as any;
    const service = new ProjectsService(
      projectsHelper,
      {} as any,
      teamService,
      {} as any,
      {} as any,
      groupService,
      {} as any,
      {} as any,
    );

    await service.updateTeamProject({
      project_id: 'project-id',
      team_id: ['new-team'],
    });

    expect(groupService.addMemberByProjectId).toHaveBeenCalledWith(
      'project-id',
      3,
    );
    expect(groupService.addMemberByProjectId).toHaveBeenCalledWith(
      'project-id',
      4,
    );
    expect(groupService.removeMemberByProjectId).toHaveBeenCalledWith(
      'project-id',
      1,
    );
    expect(groupService.removeMemberByProjectId).toHaveBeenCalledWith(
      'project-id',
      2,
    );
    expect(groupService.syncProjectGroupMembers).toHaveBeenCalledWith(
      'project-id',
    );
  });
});
