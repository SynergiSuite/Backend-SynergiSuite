import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Message } from '../entities/message.entity';
import { GroupMember } from '../entities/group-member.entity';
import { SendMessageDto } from '../dto/send-message.dto';
import {
  MessageResponseDto,
  toMessageResponseDto,
} from '../dto/message-response.dto';
import { MinIO } from '../../minIO/minIO.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

// Allowed MinIO object path prefixes
const ALLOWED_PATH_PREFIXES = ['hr-documents/', 'chat-attachments/'];

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
    private readonly minioService: MinIO,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  // Validate that a fileUrl is a safe MinIO object path
  private validateObjectPath(fileUrl: string): void {
    this.logger.log(`Validating object path: ${fileUrl}`);

    // Reject path traversal
    if (fileUrl.includes('..')) {
      throw new HttpException(
        'Invalid file path: path traversal not allowed',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Reject external URLs
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      throw new HttpException(
        'Invalid file path: external URLs not allowed',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Must start with an allowed prefix
    const isAllowed = ALLOWED_PATH_PREFIXES.some((prefix) =>
      fileUrl.startsWith(prefix),
    );
    if (!isAllowed) {
      throw new HttpException(
        `Invalid file path: must start with one of ${ALLOWED_PATH_PREFIXES.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(`Object path validated: ${fileUrl}`);
  }

  // Generate a signed URL for a message's fileUrl, returns undefined if no fileUrl
  private async generateSignedUrl(
    fileUrl: string | null,
  ): Promise<string | undefined> {
    if (!fileUrl) return undefined;
    try {
      const result = await this.minioService.generateViewUrl(
        fileUrl,
        'synergi-chat-attachments',
      );
      return result.viewUrl;
    } catch (error) {
      this.logger.error(
        `Error generating signed URL for: ${fileUrl}`,
        error.message,
      );
      return undefined;
    }
  }

  // Convert a message entity to a response DTO with signed URL
  async toResponseDto(message: Message): Promise<MessageResponseDto> {
    const signedUrl = await this.generateSignedUrl(message.fileUrl);
    return toMessageResponseDto(message, signedUrl);
  }

  // Check if a user is a member of a group
  async isGroupMember(groupId: string, userId: number): Promise<boolean> {
    const membership = await this.groupMemberRepository.findOne({
      where: { userId, groupId },
    });
    return !!membership;
  }

  // Save a new message
  async save(groupId: string, senderId: number, dto: SendMessageDto) {
    this.logger.log(
      `Saving message to group: ${groupId} from user: ${senderId}`,
    );
    try {
      // Validate that at least text or fileUrl is provided
      if (!dto.text && !dto.fileUrl) {
        throw new HttpException(
          'Message must contain either text or a file attachment',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate the object path if fileUrl is provided
      if (dto.fileUrl) {
        this.validateObjectPath(dto.fileUrl);
      }

      const message = this.messageRepository.create({
        groupId,
        senderId,
        text: dto.text || null,
        type: dto.type,
        fileUrl: dto.fileUrl || null,
        fileName: dto.fileName || null,
        mimeType: dto.mimeType || null,
        fileSize: dto.fileSize || null,
        replyToId: dto.replyToId,
      });
      const saved = await this.messageRepository.save(message);

      // Return with sender relation loaded
      const full = await this.messageRepository.findOne({
        where: { id: saved.id },
        relations: ['sender', 'replyTo'],
      });

      this.logger.log(`Message saved successfully: ${saved.id}`);
      return full;
    } catch (error) {
      this.logger.error(
        `Error saving message to group: ${groupId}`,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async notifyRecipients(message: Message): Promise<void> {
    if (!this.notificationsService) {
      return;
    }

    const memberships = await this.groupMemberRepository.find({
      where: { groupId: message.groupId },
      relations: ['group'],
    });
    const recipients = memberships.filter(
      (membership) =>
        membership.userId !== message.senderId && !membership.isMuted,
    );
    if (!recipients.length) {
      return;
    }

    const senderName = message.sender?.name || 'Someone';
    const groupName = memberships[0]?.group?.name;
    const preview = message.text?.trim()
      ? message.text.trim().slice(0, 160)
      : `Sent ${message.fileName || 'an attachment'}`;

    await this.notificationsService.createMany(
      recipients.map((membership) => ({
        recipientId: membership.userId,
        actorId: message.senderId,
        type: NotificationType.MESSAGE_RECEIVED,
        title: `New message from ${senderName}`,
        body: groupName ? `${groupName}: ${preview}` : preview,
        data: {
          groupId: message.groupId,
          messageId: message.id,
          href: '/collab-station',
        },
      })),
    );
  }

  // Paginated messages by group, ordered ASC by createdAt, with signed URLs
  async findByGroup(
    groupId: string,
    limit: number = 50,
    cursor?: string,
  ): Promise<MessageResponseDto[]> {
    this.logger.log(
      `Finding messages for group: ${groupId}, limit: ${limit}, cursor: ${cursor}`,
    );
    try {
      const whereCondition: any = { groupId };

      if (cursor) {
        whereCondition.createdAt = LessThan(new Date(cursor));
      }

      const messages = await this.messageRepository.find({
        where: whereCondition,
        relations: ['sender', 'replyTo'],
        order: { createdAt: 'ASC' },
        take: limit,
        withDeleted: false,
      });

      // Generate signed URLs for all messages with attachments
      const responseDtos = await Promise.all(
        messages.map((message) => this.toResponseDto(message)),
      );

      this.logger.log(
        `Found ${messages.length} messages for group: ${groupId}`,
      );
      return responseDtos;
    } catch (error) {
      this.logger.error(
        `Error finding messages for group: ${groupId}`,
        error.message,
      );
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Soft delete a message (only if sender matches)
  async softDelete(messageId: string, requestingUserId: number) {
    this.logger.log(
      `Soft deleting message: ${messageId} by user: ${requestingUserId}`,
    );
    try {
      const message = await this.messageRepository.findOne({
        where: { id: messageId },
      });

      if (!message) {
        throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
      }

      if (message.senderId !== requestingUserId) {
        throw new HttpException(
          'You can only delete your own messages',
          HttpStatus.FORBIDDEN,
        );
      }

      await this.messageRepository.softRemove(message);
      this.logger.log(`Message soft deleted successfully: ${messageId}`);
      return { messageId, groupId: message.groupId };
    } catch (error) {
      this.logger.error(
        `Error soft deleting message: ${messageId}`,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Update message text and set isEdited
  async update(messageId: string, requestingUserId: number, text: string) {
    this.logger.log(
      `Updating message: ${messageId} by user: ${requestingUserId}`,
    );
    try {
      const message = await this.messageRepository.findOne({
        where: { id: messageId },
      });

      if (!message) {
        throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
      }

      if (message.senderId !== requestingUserId) {
        throw new HttpException(
          'You can only edit your own messages',
          HttpStatus.FORBIDDEN,
        );
      }

      message.text = text;
      message.isEdited = true;
      const updated = await this.messageRepository.save(message);

      // Return with sender relation loaded
      const full = await this.messageRepository.findOne({
        where: { id: updated.id },
        relations: ['sender', 'replyTo'],
      });

      this.logger.log(`Message updated successfully: ${messageId}`);
      return full;
    } catch (error) {
      this.logger.error(`Error updating message: ${messageId}`, error.message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
