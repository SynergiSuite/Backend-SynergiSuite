import { BadRequestException } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClientsHelper } from './clients.helper';
import { clientDetailGuard } from './client.guard';
import { TaskStatus } from '../projects/entities/task.entity';
import { ClientFeedbackStatus } from '../client_feedback/enums/client_feedback.enums';

describe('ClientsModule - Client Details & Guards', () => {
  describe('ClientsHelper', () => {
    let helper: ClientsHelper;
    let mockClientRepo: any;
    let mockFeedbackRepo: any;
    let mockUserHelper: any;

    beforeEach(() => {
      mockClientRepo = {
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
      };
      mockFeedbackRepo = {
        find: jest.fn(),
      };
      mockUserHelper = {
        getUserWithBusinessDetail: jest.fn(),
      };
      helper = new ClientsHelper(
        mockClientRepo,
        mockFeedbackRepo,
        mockUserHelper,
      );
    });

    it('should safely parse dates and calculate remaining days', () => {
      expect(helper.parseSafeDate(null)).toBeNull();
      expect(helper.parseSafeDate(undefined)).toBeNull();
      expect(helper.parseSafeDate('invalid-date')).toBeNull();

      const validDate = helper.parseSafeDate('2026-12-25T00:00:00.000Z');
      expect(validDate).toBeInstanceOf(Date);
      expect(validDate?.getFullYear()).toBe(2026);

      const now = new Date('2026-10-19T00:00:00.000Z');
      const target = new Date('2026-10-24T00:00:00.000Z');
      const remaining = helper.calculateDaysRemaining(target, now);
      expect(remaining).toBe(5);
    });

    it('should recursively sanitize sensitive fields from arbitrary nested objects', () => {
      const input = {
        name: 'Client A',
        user: {
          name: 'John',
          password_hash: 'secret_hash',
          token_digest: 'digest_123',
          salary: '10000',
          nested: {
            password: 'pass',
            safeValue: 'ok',
          },
        },
        items: [
          { title: 'Task 1', password_hash: 'omit' },
          { title: 'Task 2', normal: true },
        ],
      };

      const result = helper.recursiveSanitize(input);
      expect(result.name).toBe('Client A');
      expect(result.user.name).toBe('John');
      expect((result.user as any).password_hash).toBeUndefined();
      expect((result.user as any).token_digest).toBeUndefined();
      expect((result.user as any).salary).toBeUndefined();
      expect((result.user.nested as any).password).toBeUndefined();
      expect(result.user.nested.safeValue).toBe('ok');
      expect((result.items[0] as any).password_hash).toBeUndefined();
      expect(result.items[0].title).toBe('Task 1');
    });

    it('should correctly format client details, feedbacks, milestones, tasks, and upcoming due dates', () => {
      const mockClient: any = {
        id: 'client-uuid-1',
        name: 'Acme Corp',
        email: 'acme@example.com',
        phone: '123-456-7890',
        address: '123 Main St',
        company: 'Acme Inc',
        priority: 1,
        paymentType: 'per_hour',
        amount: 150,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-02'),
        business: { business_id: 10, name: 'Biz Inc' },
        projects: [
          {
            id: 'proj-1',
            name: 'Project Apollo',
            description: 'Apollo desc',
            status: 1,
            duration: '3 months',
            created_at: new Date('2026-01-01'),
            updated_at: new Date('2026-01-02'),
            teams: [
              {
                id: 'team-1',
                name: 'Alpha Team',
                leader: { user_id: 1, name: 'Leader Bob', email: 'bob@example.com' },
              },
            ],
            milestones: [
              {
                id: 'ms-1',
                name: 'Phase 1 MVP',
                end_date: '2026-12-01',
                created_at: new Date('2026-01-01'),
                updated_at: new Date('2026-01-02'),
              },
            ],
            tasks: [
              {
                id: 'task-1',
                title: 'Design UI',
                description: 'Figma mockups',
                status: TaskStatus.IN_PROGRESS,
                priority: 'high',
                due_date: '2026-11-15',
                milestone: { id: 'ms-1', name: 'Phase 1 MVP' },
                created_at: new Date('2026-01-01'),
                updated_at: new Date('2026-01-02'),
                assignee: { user_id: 2, name: 'Alice', email: 'alice@example.com' },
                teams: [{ id: 'team-1', name: 'Alpha Team' }],
              },
              {
                id: 'task-2',
                title: 'Backend Setup',
                status: TaskStatus.COMPLETED,
                priority: 'medium',
                due_date: '2026-10-01',
                created_at: new Date('2026-01-01'),
                updated_at: new Date('2026-01-02'),
              },
            ],
          },
        ],
      };

      const mockFeedbacks: any[] = [
        {
          id: 'fb-1',
          titleOfFeedback: 'Great communication',
          feedback: 'Very pleased with progress',
          feedbackType: 'review',
          status: ClientFeedbackStatus.RESOLVED,
          starRating: 5,
          targetType: 'project',
          typeId: 'proj-1',
          createdAt: new Date('2026-09-01'),
          updatedAt: new Date('2026-09-02'),
          createdBy: { user_id: 5, name: 'Client Rep', email: 'rep@acme.com' },
          replies: [
            {
              id: 'reply-1',
              message: 'Thank you!',
              createdAt: new Date('2026-09-03'),
              createdBy: { user_id: 1, name: 'Bob', email: 'bob@example.com' },
            },
          ],
        },
      ];

      const response = helper.formatClientDetailResponse(mockClient, mockFeedbacks);

      expect(response.client.id).toBe('client-uuid-1');
      expect(response.client.name).toBe('Acme Corp');
      expect(response.summary.totalProjects).toBe(1);
      expect(response.summary.totalMilestones).toBe(1);
      expect(response.summary.totalTasks).toBe(2);
      expect(response.summary.completedTasks).toBe(1);
      expect(response.summary.pendingTasks).toBe(1);
      expect(response.summary.totalFeedbacks).toBe(1);
      expect(response.summary.feedbacksByStatus.resolved).toBe(1);
      expect(response.summary.averageFeedbackRating).toBe(5);

      // Verify Feedbacks
      expect(response.feedbacks.length).toBe(1);
      expect(response.feedbacks[0].replies.length).toBe(1);
      expect(response.feedbacks[0].replies[0].message).toBe('Thank you!');

      // Verify Projects & Milestones
      expect(response.projects.length).toBe(1);
      expect(response.projects[0].milestones.length).toBe(1);
      expect(response.projects[0].milestones[0].tasks.length).toBe(1);
      expect(response.projects[0].milestones[0].tasks[0].id).toBe('task-1');

      // Verify Upcoming Deadlines (task-1 is upcoming, ms-1 is upcoming, task-2 is completed so excluded)
      expect(response.upcomingDueDates.length).toBe(2);
      const taskDeadline = response.upcomingDueDates.find((d) => d.type === 'task');
      expect(taskDeadline).toBeDefined();
      expect(taskDeadline?.title).toBe('Design UI');
    });
  });

  describe('clientDetailGuard', () => {
    let guard: clientDetailGuard;
    let mockClientsHelper: any;

    beforeEach(() => {
      mockClientsHelper = {
        getUserWithBusiness: jest.fn(),
        findOneByBusiness: jest.fn(),
      };
      guard = new clientDetailGuard(mockClientsHelper);
    });

    it('should throw BadRequestException if client ID is missing', async () => {
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { email: 'user@example.com' },
            params: {},
          }),
        }),
      };

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if client does not exist for business', async () => {
      mockClientsHelper.getUserWithBusiness.mockResolvedValue({
        business: { business_id: 10 },
      });
      mockClientsHelper.findOneByBusiness.mockResolvedValue(null);

      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { email: 'user@example.com' },
            params: { id: 'client-1' },
          }),
        }),
      };

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should attach client and businessId to request and return true on success', async () => {
      const req: any = {
        user: { email: 'user@example.com' },
        params: { id: 'client-1' },
      };
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };

      const mockClient = { id: 'client-1', name: 'Acme' };
      mockClientsHelper.getUserWithBusiness.mockResolvedValue({
        business: { business_id: 10 },
      });
      mockClientsHelper.findOneByBusiness.mockResolvedValue(mockClient);

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
      expect(req.client).toEqual(mockClient);
      expect(req.businessId).toBe(10);
    });
  });

  describe('ClientsController', () => {
    let controller: ClientsController;
    let mockClientsService: any;

    beforeEach(() => {
      mockClientsService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        getClientDetails: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
      };
      controller = new ClientsController(mockClientsService);
    });

    it('getClientDetails delegates to clientsService.getClientDetails', async () => {
      const mockResult = { client: { id: 'uuid-1' } };
      mockClientsService.getClientDetails.mockResolvedValue(mockResult);

      const req: any = { user: { email: 'user@example.com' } };
      const res = await controller.getClientDetails(req, 'uuid-1');

      expect(mockClientsService.getClientDetails).toHaveBeenCalledWith(
        'uuid-1',
        req.user,
      );
      expect(res).toBe(mockResult);
    });
  });

  describe('RedisService - Client Invitation Token', () => {
    let redisService: any;
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn(),
        del: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
      };
      redisService = {
        redisClient: mockClient,
        logger: { log: jest.fn() },
        setWithExpiration: jest.fn(async (key, value, ttl) => {
          await mockClient.set(key, value, { EX: ttl });
        }),
      };
      // Bind generateTokenForClientInvitation
      const originalProto = require('../redis/redis.service').RedisService.prototype;
      redisService.generateTokenForClientInvitation =
        originalProto.generateTokenForClientInvitation.bind(redisService);
    });

    it('should store role id as number and role object with role id instead of plain string', async () => {
      const token = await redisService.generateTokenForClientInvitation(
        'ali.kashan@mailinator.com',
        'founder.v2@mailinator.com',
        '2514029c-ba3f-4bf2-a183-c4ed094d5cc3',
        4,
        { id: 5, name: 'Client' },
      );

      expect(typeof token).toBe('string');
      expect(redisService.setWithExpiration).toHaveBeenCalled();
      const savedPayload = JSON.parse(
        redisService.setWithExpiration.mock.calls[0][1],
      );

      expect(savedPayload.invited).toBe('ali.kashan@mailinator.com');
      expect(savedPayload.invited_by).toBe('founder.v2@mailinator.com');
      expect(savedPayload.invited_as).toBe(5);
      expect(savedPayload.invited_as_role).toEqual({ id: 5, name: 'Client' });
      expect(savedPayload.client_id).toBe('2514029c-ba3f-4bf2-a183-c4ed094d5cc3');
      expect(savedPayload.business_id).toBe(4);
    });
  });
});

