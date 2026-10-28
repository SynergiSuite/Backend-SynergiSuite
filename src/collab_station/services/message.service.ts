import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import {
  Message,
  MessageType,
  SharedEntitySnapshot,
  SharedEntityType,
} from '../entities/message.entity';
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
export class MessageService implements OnModuleInit {
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

  async onModuleInit(): Promise<void> {
    await this.ensureSharedItemSchema();
  }

  /**
   * SQL migrations in this repository are not registered with TypeORM's
   * migration runner. Keep chat usable after an application deployment by
   * applying the shared-item schema idempotently before the gateway accepts
   * connections. The checked-in migration remains the source of truth for
   * environments that run SQL migrations explicitly.
   */
  async ensureSharedItemSchema(): Promise<void> {
    try {
      await this.messageRepository.manager.transaction(async (manager) => {
        const [messageTypeColumn] = await manager.query(`
          SELECT udt_name
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'messages'
            AND column_name = 'type'
        `);
        const messageTypeEnum = messageTypeColumn?.udt_name;
        if (
          !messageTypeEnum ||
          !/^[A-Za-z_][A-Za-z0-9_]*$/.test(messageTypeEnum)
        ) {
          throw new Error('Unable to resolve the messages type enum');
        }

        await manager.query(
          `ALTER TYPE "${messageTypeEnum}" ADD VALUE IF NOT EXISTS 'shared_item'`,
        );
        await manager.query(`
          DO $$ BEGIN
            CREATE TYPE messages_shared_entity_type_enum AS ENUM (
              'task',
              'milestone',
              'client_feedback'
            );
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$
        `);
        await manager.query(`
          ALTER TABLE "messages"
            ADD COLUMN IF NOT EXISTS "sharedEntityType" messages_shared_entity_type_enum,
            ADD COLUMN IF NOT EXISTS "sharedEntityId" uuid,
            ADD COLUMN IF NOT EXISTS "sharedEntitySnapshot" jsonb
        `);
        await manager.query(`
          ALTER TABLE "messages" ALTER COLUMN "text" DROP NOT NULL
        `);
        await manager.query(`
          CREATE INDEX IF NOT EXISTS "IDX_messages_shared_entity"
            ON "messages" ("sharedEntityType", "sharedEntityId")
        `);
      });
      this.logger.log('Shared-item message schema verified.');
    } catch (error) {
      this.logger.error(
        'Failed to initialize the shared-item message schema',
        error.stack ?? error.message,
      );
      throw error;
    }
  }

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

  async saveSharedItem(
    groupId: string,
    senderId: number,
    input: {
      entityType: SharedEntityType;
      entityId: string;
      snapshot: SharedEntitySnapshot;
      text?: string;
    },
  ): Promise<Message> {
    const message = this.messageRepository.create({
      groupId,
      senderId,
      text: input.text?.trim() || null,
      type: MessageType.SHARED_ITEM,
      sharedEntityType: input.entityType,
      sharedEntityId: input.entityId,
      sharedEntitySnapshot: input.snapshot,
    });
    const saved = await this.messageRepository.save(message);
    return this.messageRepository.findOne({
      where: { id: saved.id },
      relations: ['sender', 'replyTo'],
    });
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
      : message.type === MessageType.SHARED_ITEM
        ? `Shared ${message.sharedEntitySnapshot?.title || 'an item'}`
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
    sharedEntityType?: SharedEntityType,
    sharedEntityId?: string,
  ): Promise<MessageResponseDto[]> {
    this.logger.log(
      `Finding messages for group: ${groupId}, limit: ${limit}, cursor: ${cursor}`,
    );
    try {
      const whereCondition: any = { groupId };

      if (cursor) {
        whereCondition.createdAt = LessThan(new Date(cursor));
      }
      if (sharedEntityType) whereCondition.sharedEntityType = sharedEntityType;
      if (sharedEntityId) whereCondition.sharedEntityId = sharedEntityId;

      let where: any = whereCondition;
      if (sharedEntityType || sharedEntityId) {
        const roots = await this.messageRepository.find({
          where: whereCondition,
          select: ['id'],
        });
        if (roots.length) {
          const replyCondition: any = {
            groupId,
            replyToId: In(roots.map((root) => root.id)),
          };
          if (cursor) {
            replyCondition.createdAt = LessThan(new Date(cursor));
          }
          where = [whereCondition, replyCondition];
        }
      }

      const messages = await this.messageRepository.find({
        where,
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
