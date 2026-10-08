import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException } from '@nestjs/common';
import { MessageService } from './message.service';
import { Message, MessageType } from '../entities/message.entity';
import { GroupMember } from '../entities/group-member.entity';
import { MinIO } from '../../minIO/minIO.service';

describe('MessageService', () => {
  let service: MessageService;

  const mockMessageRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockGroupMemberRepository = {
    findOne: jest.fn(),
  };

  const mockMinIOService = {
    generateViewUrl: jest.fn(),
  };

  const createMockMessage = (overrides = {}): Message => ({
    id: 'msg-uuid-1',
    groupId: 'group-uuid-1',
    senderId: 1,
    sender: { user_id: 1, name: 'Test User', email: 'test@test.com' } as any,
    text: null,
    type: MessageType.TEXT,
    fileUrl: null,
    fileName: null,
    mimeType: null,
    fileSize: null,
    replyToId: null,
    replyTo: null,
    replies: [],
    isEdited: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    group: null,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: getRepositoryToken(Message),
          useValue: mockMessageRepository,
        },
        {
          provide: getRepositoryToken(GroupMember),
          useValue: mockGroupMemberRepository,
        },
        {
          provide: MinIO,
          useValue: mockMinIOService,
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('save - Image-only message', () => {
    it('should save an image-only message with no text', async () => {
      const savedMessage = createMockMessage({
        type: MessageType.IMAGE,
        fileUrl: 'hr-documents/1234-photo.png',
        fileName: 'photo.png',
        mimeType: 'image/png',
        fileSize: 102400,
      });

      mockMessageRepository.create.mockReturnValue(savedMessage);
      mockMessageRepository.save.mockResolvedValue(savedMessage);
      mockMessageRepository.findOne.mockResolvedValue(savedMessage);

      const result = await service.save('group-uuid-1', 1, {
        type: MessageType.IMAGE,
        fileUrl: 'hr-documents/1234-photo.png',
        fileName: 'photo.png',
        mimeType: 'image/png',
        fileSize: 102400,
      });

      expect(result).toBeDefined();
      expect(result.fileUrl).toBe('hr-documents/1234-photo.png');
      expect(result.type).toBe(MessageType.IMAGE);
      expect(mockMessageRepository.save).toHaveBeenCalled();
    });
  });

  describe('save - File-only message', () => {
    it('should save a file-only message with no text', async () => {
      const savedMessage = createMockMessage({
        type: MessageType.FILE,
        fileUrl: 'hr-documents/1234-report.pdf',
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
        fileSize: 512000,
      });

      mockMessageRepository.create.mockReturnValue(savedMessage);
      mockMessageRepository.save.mockResolvedValue(savedMessage);
      mockMessageRepository.findOne.mockResolvedValue(savedMessage);

      const result = await service.save('group-uuid-1', 1, {
        type: MessageType.FILE,
        fileUrl: 'hr-documents/1234-report.pdf',
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
        fileSize: 512000,
      });

      expect(result).toBeDefined();
      expect(result.type).toBe(MessageType.FILE);
      expect(result.fileName).toBe('report.pdf');
    });
  });

  describe('save - Text with attachment', () => {
    it('should save a message with both text and attachment', async () => {
      const savedMessage = createMockMessage({
        text: 'Check out this file',
        type: MessageType.FILE,
        fileUrl: 'hr-documents/1234-doc.pdf',
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
        fileSize: 256000,
      });

      mockMessageRepository.create.mockReturnValue(savedMessage);
      mockMessageRepository.save.mockResolvedValue(savedMessage);
      mockMessageRepository.findOne.mockResolvedValue(savedMessage);

      const result = await service.save('group-uuid-1', 1, {
        text: 'Check out this file',
        type: MessageType.FILE,
        fileUrl: 'hr-documents/1234-doc.pdf',
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
        fileSize: 256000,
      });

      expect(result).toBeDefined();
      expect(result.text).toBe('Check out this file');
      expect(result.fileUrl).toBe('hr-documents/1234-doc.pdf');
    });
  });

  describe('save - Empty message rejection', () => {
    it('should reject a message with neither text nor fileUrl', async () => {
      await expect(service.save('group-uuid-1', 1, {})).rejects.toThrow(
        HttpException,
      );

      await expect(service.save('group-uuid-1', 1, {})).rejects.toThrow(
        'Message must contain either text or a file attachment',
      );
    });
  });

  describe('isGroupMember - Non-member rejection', () => {
    it('should return false for a non-member', async () => {
      mockGroupMemberRepository.findOne.mockResolvedValue(null);

      const result = await service.isGroupMember('group-uuid-1', 999);

      expect(result).toBe(false);
    });

    it('should return true for a member', async () => {
      mockGroupMemberRepository.findOne.mockResolvedValue({ id: 'member-1' });

      const result = await service.isGroupMember('group-uuid-1', 1);

      expect(result).toBe(true);
    });
  });

  describe('save - Invalid object-path rejection', () => {
    it('should reject external URLs', async () => {
      await expect(
        service.save('group-uuid-1', 1, {
          fileUrl: 'https://evil.com/malware.exe',
          type: MessageType.FILE,
        }),
      ).rejects.toThrow('Invalid file path: external URLs not allowed');
    });

    it('should reject path traversal', async () => {
      await expect(
        service.save('group-uuid-1', 1, {
          fileUrl: 'hr-documents/../../../etc/passwd',
          type: MessageType.FILE,
        }),
      ).rejects.toThrow('Invalid file path: path traversal not allowed');
    });

    it('should reject paths with disallowed prefix', async () => {
      await expect(
        service.save('group-uuid-1', 1, {
          fileUrl: 'private-data/secret.pdf',
          type: MessageType.FILE,
        }),
      ).rejects.toThrow('Invalid file path: must start with one of');
    });

    it('should accept valid hr-documents paths', async () => {
      const savedMessage = createMockMessage({
        fileUrl: 'hr-documents/1234-valid.pdf',
        type: MessageType.FILE,
      });

      mockMessageRepository.create.mockReturnValue(savedMessage);
      mockMessageRepository.save.mockResolvedValue(savedMessage);
      mockMessageRepository.findOne.mockResolvedValue(savedMessage);

      const result = await service.save('group-uuid-1', 1, {
        fileUrl: 'hr-documents/1234-valid.pdf',
        type: MessageType.FILE,
      });

      expect(result).toBeDefined();
    });

    it('should accept valid chat-attachments paths', async () => {
      const savedMessage = createMockMessage({
        fileUrl: 'chat-attachments/1234-image.jpg',
        type: MessageType.IMAGE,
      });

      mockMessageRepository.create.mockReturnValue(savedMessage);
      mockMessageRepository.save.mockResolvedValue(savedMessage);
      mockMessageRepository.findOne.mockResolvedValue(savedMessage);

      const result = await service.save('group-uuid-1', 1, {
        fileUrl: 'chat-attachments/1234-image.jpg',
        type: MessageType.IMAGE,
      });

      expect(result).toBeDefined();
    });
  });

  describe('toResponseDto - Signed URL generation', () => {
    it('should generate a signed URL for messages with fileUrl', async () => {
      const message = createMockMessage({
        fileUrl: 'hr-documents/1234-photo.png',
        type: MessageType.IMAGE,
        fileName: 'photo.png',
        mimeType: 'image/png',
      });

      mockMinIOService.generateViewUrl.mockResolvedValue({
        viewUrl: 'https://minio.local/signed-url?token=abc123',
      });

      const result = await service.toResponseDto(message);

      expect(result.fileUrl).toBe(
        'https://minio.local/signed-url?token=abc123',
      );
      expect(mockMinIOService.generateViewUrl).toHaveBeenCalledWith(
        'hr-documents/1234-photo.png',
        'synergi-chat-attachments',
      );
    });

    it('should not generate a signed URL for text-only messages', async () => {
      const message = createMockMessage({
        text: 'Hello world',
        type: MessageType.TEXT,
      });

      const result = await service.toResponseDto(message);

      expect(result.fileUrl).toBeUndefined();
      expect(mockMinIOService.generateViewUrl).not.toHaveBeenCalled();
    });
  });

  describe('findByGroup - Signed URLs in history', () => {
    it('should return messages with signed URLs for attachments', async () => {
      const messages = [
        createMockMessage({
          id: 'msg-1',
          text: 'Hello',
          type: MessageType.TEXT,
        }),
        createMockMessage({
          id: 'msg-2',
          type: MessageType.IMAGE,
          fileUrl: 'hr-documents/photo.png',
          fileName: 'photo.png',
        }),
      ];

      mockMessageRepository.find.mockResolvedValue(messages);
      mockMinIOService.generateViewUrl.mockResolvedValue({
        viewUrl: 'https://minio.local/signed-url',
      });

      const result = await service.findByGroup('group-uuid-1', 50);

      expect(result).toHaveLength(2);
      // Text message should not have fileUrl
      expect(result[0].fileUrl).toBeUndefined();
      // Image message should have signed URL
      expect(result[1].fileUrl).toBe('https://minio.local/signed-url');
    });
  });

  describe('save - Text-only message (backwards compatibility)', () => {
    it('should save a text-only message without attachment fields', async () => {
      const savedMessage = createMockMessage({
        text: 'Hello world',
        type: MessageType.TEXT,
      });

      mockMessageRepository.create.mockReturnValue(savedMessage);
      mockMessageRepository.save.mockResolvedValue(savedMessage);
      mockMessageRepository.findOne.mockResolvedValue(savedMessage);

      const result = await service.save('group-uuid-1', 1, {
        text: 'Hello world',
      });

      expect(result).toBeDefined();
      expect(result.text).toBe('Hello world');
      expect(result.fileUrl).toBeNull();
    });
  });
});
