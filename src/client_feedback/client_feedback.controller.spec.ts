import { Reflector } from '@nestjs/core';
import { ClientFeedbackController } from './client_feedback.controller';
import { ClientFeedbackService } from './client_feedback.service';
import { FrontendSecretGuard } from '../shared/frontend-secret.guard';
import { JwtGuard } from '../shared/auth.guard';
import { IsVerifiedGuard } from '../shared/isVerified.guard';
import {
  ValidClientFeedbackSubmissionGuard,
  ClientHasOngoingProjectGuard,
} from './client_feedback.guard';

describe('ClientFeedbackController', () => {
  let controller: ClientFeedbackController;
  let service: jest.Mocked<ClientFeedbackService>;
  const reflector = new Reflector();

  beforeEach(() => {
    service = {
      create: jest.fn(),
      submitFeedback: jest.fn(),
      findAll: jest.fn(),
      findClientFeedback: jest.fn(),
      findOne: jest.fn(),
      createReply: jest.fn(),
      findReplies: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;

    controller = new ClientFeedbackController(service);
  });

  const getGuardsForMethod = (method: Function) => {
    return Reflect.getMetadata('__guards__', method) || [];
  };

  describe('Guards Configuration', () => {
    it('should have FrontendSecretGuard on POST /client-feedback (create)', () => {
      const guards = getGuardsForMethod(controller.create);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
    });

    it('should have FrontendSecretGuard on POST /client-feedback/submit (submitFeedback)', () => {
      const guards = getGuardsForMethod(controller.submitFeedback);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
      expect(guards).toContain(ValidClientFeedbackSubmissionGuard);
    });

    it('should have FrontendSecretGuard on GET /client-feedback (findAll)', () => {
      const guards = getGuardsForMethod(controller.findAll);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
    });

    it('should have FrontendSecretGuard on GET /client-feedback/my-feedback (findClientFeedback)', () => {
      const guards = getGuardsForMethod(controller.findClientFeedback);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
      expect(guards).toContain(ClientHasOngoingProjectGuard);
    });

    it('should have FrontendSecretGuard on GET /client-feedback/:id (findOne)', () => {
      const guards = getGuardsForMethod(controller.findOne);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
    });

    it('should have FrontendSecretGuard on POST /client-feedback/:id/replies (createReply)', () => {
      const guards = getGuardsForMethod(controller.createReply);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
    });

    it('should have FrontendSecretGuard on GET /client-feedback/:id/replies (findReplies)', () => {
      const guards = getGuardsForMethod(controller.findReplies);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
    });

    it('should have FrontendSecretGuard on PATCH /client-feedback/:id (update)', () => {
      const guards = getGuardsForMethod(controller.update);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
    });

    it('should have FrontendSecretGuard on DELETE /client-feedback/:id (remove)', () => {
      const guards = getGuardsForMethod(controller.remove);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
    });
  });

  describe('Route Handlers Delegation', () => {
    const mockUser: any = { id: 1, email: 'test@example.com' };
    const mockReq: any = { user: mockUser };

    it('create calls service.create', async () => {
      const dto: any = { content: 'test feedback' };
      await controller.create(mockReq, dto);
      expect(service.create).toHaveBeenCalledWith(dto, mockUser);
    });

    it('submitFeedback calls service.submitFeedback', async () => {
      const dto: any = { content: 'client feedback submission' };
      await controller.submitFeedback(mockReq, dto);
      expect(service.submitFeedback).toHaveBeenCalledWith(dto, mockUser);
    });

    it('findAll calls service.findAll', async () => {
      const query: any = { page: 1 };
      await controller.findAll(mockReq, query);
      expect(service.findAll).toHaveBeenCalledWith(query, mockUser);
    });

    it('findClientFeedback calls service.findClientFeedback', async () => {
      const query: any = { page: 1 };
      await controller.findClientFeedback(mockReq, query);
      expect(service.findClientFeedback).toHaveBeenCalledWith(mockUser, query);
    });

    it('findOne calls service.findOne', async () => {
      await controller.findOne(mockReq, 'uuid-123');
      expect(service.findOne).toHaveBeenCalledWith('uuid-123', mockUser);
    });

    it('createReply calls service.createReply', async () => {
      const dto: any = { message: 'reply' };
      await controller.createReply(mockReq, 'uuid-123', dto);
      expect(service.createReply).toHaveBeenCalledWith('uuid-123', dto, mockUser);
    });

    it('findReplies calls service.findReplies', async () => {
      await controller.findReplies(mockReq, 'uuid-123');
      expect(service.findReplies).toHaveBeenCalledWith('uuid-123', mockUser);
    });

    it('update calls service.update', async () => {
      const dto: any = { status: 'RESOLVED' as any };
      await controller.update(mockReq, 'uuid-123', dto);
      expect(service.update).toHaveBeenCalledWith('uuid-123', dto, mockUser);
    });

    it('remove calls service.remove', async () => {
      await controller.remove(mockReq, 'uuid-123');
      expect(service.remove).toHaveBeenCalledWith('uuid-123', mockUser);
    });
  });
});
