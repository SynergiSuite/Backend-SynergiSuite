import { ResourceController } from './minIO.controller';
import { MinIO } from './minIO.service';
import { FrontendSecretGuard } from 'src/shared/frontend-secret.guard';
import { JwtGuard } from 'src/shared/auth.guard';
import { IsVerifiedGuard } from 'src/shared/isVerified.guard';
import { DocumentAccessGuard } from 'src/documents/document.guard';

describe('ResourceController', () => {
  let controller: ResourceController;
  let service: jest.Mocked<MinIO>;

  beforeEach(() => {
    service = {
      generateUploadUrl: jest.fn(),
      generateViewUrl: jest.fn(),
    } as any;

    controller = new ResourceController(service);
  });

  const getGuardsForMethod = (method: Function) => {
    return Reflect.getMetadata('__guards__', method) || [];
  };

  describe('Guards Configuration', () => {
    it('should have FrontendSecretGuard on POST /resources/upload-url (getUploadUrl)', () => {
      const guards = getGuardsForMethod(controller.getUploadUrl);
      expect(guards).toContain(FrontendSecretGuard);
    });

    it('should have FrontendSecretGuard on POST /resources/chat/upload-url (getChatUploadUrl)', () => {
      const guards = getGuardsForMethod(controller.getChatUploadUrl);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
    });

    it('should have FrontendSecretGuard on GET /resources/:id/view-url (getViewUrl)', () => {
      const guards = getGuardsForMethod(controller.getViewUrl);
      expect(guards).toContain(FrontendSecretGuard);
      expect(guards).toContain(JwtGuard);
      expect(guards).toContain(IsVerifiedGuard);
      expect(guards).toContain(DocumentAccessGuard);
    });
  });

  describe('Route Handlers Delegation', () => {
    it('getUploadUrl calls minioService.generateUploadUrl', async () => {
      const mockResult = { uploadUrl: 'http://upload-url', filePath: 'hr-documents/123-test.png' };
      service.generateUploadUrl.mockResolvedValue(mockResult);
      const body = { fileName: 'test.png', mimeType: 'image/png', bucket: 'my-bucket' };

      const result = await controller.getUploadUrl(body);

      expect(service.generateUploadUrl).toHaveBeenCalledWith(
        'test.png',
        'image/png',
        'my-bucket',
      );
      expect(result).toBe(mockResult);
    });

    it('getChatUploadUrl calls minioService.generateUploadUrl with synergi-chat-attachments', async () => {
      const mockResult = { uploadUrl: 'http://chat-upload-url', filePath: 'chat-attachments/123-chat.pdf' };
      service.generateUploadUrl.mockResolvedValue(mockResult);
      const body = { fileName: 'chat.pdf', mimeType: 'application/pdf' };

      const result = await controller.getChatUploadUrl(body);

      expect(service.generateUploadUrl).toHaveBeenCalledWith(
        'chat.pdf',
        'application/pdf',
        'synergi-chat-attachments',
      );
      expect(result).toBe(mockResult);
    });

    it('getViewUrl calls minioService.generateViewUrl with document file_path', async () => {
      const mockResult = { viewUrl: 'http://view-url' };
      service.generateViewUrl.mockResolvedValue(mockResult);
      const req: any = {
        document: { file_path: 'path/to/file.pdf' },
      };

      const result = await controller.getViewUrl('123', req);

      expect(service.generateViewUrl).toHaveBeenCalledWith('path/to/file.pdf');
      expect(result).toBe(mockResult);
    });
  });
});
