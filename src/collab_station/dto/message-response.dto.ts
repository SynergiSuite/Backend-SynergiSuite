import { Message } from '../entities/message.entity';

export interface MessageResponseDto {
  id: string;
  groupId: string;
  senderId: number;
  sender: {
    user_id: number;
    name: string;
    email: string;
  } | null;
  text: string;
  type: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  replyToId?: string;
  isEdited: boolean;
  createdAt: string;
}

export function toMessageResponseDto(
  message: Message,
  signedFileUrl?: string,
): MessageResponseDto {
  return {
    id: message.id,
    groupId: message.groupId,
    senderId: message.senderId,
    sender: message.sender
      ? {
          user_id: message.sender.user_id,
          name: message.sender.name,
          email: message.sender.email,
        }
      : null,
    text: message.text,
    type: message.type,
    fileUrl: signedFileUrl || undefined,
    fileName: message.fileName || undefined,
    mimeType: message.mimeType || undefined,
    fileSize: message.fileSize || undefined,
    replyToId: message.replyToId || undefined,
    isEdited: message.isEdited,
    createdAt: message.createdAt.toISOString(),
  };
}
