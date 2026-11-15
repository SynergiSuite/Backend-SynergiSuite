import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { FrontendSecretGuard } from 'src/shared/frontend-secret.guard';
import { JwtGuard } from 'src/shared/auth.guard';
import { IsVerifiedGuard } from 'src/shared/isVerified.guard';
import { DocumentDeleteGuard } from './document.guard';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: jest.Mocked<DocumentsService>;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;

    controller = new DocumentsController(service);
  });

  const getGuardsForMethod = (method: Function) => {
    return Reflect.getMetadata('__guards__', method) || [];
  };

  describe('Guards Configuration', () => {
    it('should have FrontendSecretGuard on POST /documents (create)', () => {
      const guards = getGuardsForMethod(controller.create);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
    });

    it('should have FrontendSecretGuard on GET /documents (findAll)', () => {
      const guards = getGuardsForMethod(controller.findAll);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
    });

    it('should have FrontendSecretGuard on PATCH /documents/:id (update)', () => {
      const guards = getGuardsForMethod(controller.update);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
    });

    it('should have FrontendSecretGuard on DELETE /documents/:id (remove)', () => {
      const guards = getGuardsForMethod(controller.remove);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
      expect(guards).toContain(DocumentDeleteGuard);
    });
  });

  describe('Route Handlers Delegation', () => {
    const mockUser: any = { id: 1, email: 'user@example.com' };
    const mockReq: any = { user: mockUser };

    it('create calls service.create', async () => {
      const dto: any = { name: 'Doc 1' };
      await controller.create(mockReq, dto);
      expect(service.create).toHaveBeenCalledWith(mockUser, dto);
    });

    it('findAll calls service.findAll', async () => {
      await controller.findAll(mockReq);
      expect(service.findAll).toHaveBeenCalledWith(mockUser);
    });

    it('update calls service.update', async () => {
      const dto: any = { name: 'Doc Updated' };
      await controller.update(mockReq, '12', dto);
      expect(service.update).toHaveBeenCalledWith(mockUser, 12, dto);
    });

    it('remove calls service.remove', async () => {
      await controller.remove(mockReq, '12');
      expect(service.remove).toHaveBeenCalledWith(mockUser, 12);
    });
  });
});
