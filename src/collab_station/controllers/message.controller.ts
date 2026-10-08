import {
  Controller,
  Delete,
  Param,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../../shared/auth.guard';
import { IsVerifiedGuard } from '../../shared/isVerified.guard';
import { MessageService } from '../services/message.service';
import { CollabStationHelper } from '../collab_station.helper';
import { ChatGateway } from '../gateways/chat.gateway';

@Controller('chat/messages')
export class MessageController {
  private readonly logger = new Logger(MessageController.name);

  constructor(
    private readonly messageService: MessageService,
    private readonly collabStationHelper: CollabStationHelper,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Delete(':messageId')
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async deleteMessage(
    @Req() req: Request,
    @Param('messageId') messageId: string,
  ) {
    this.logger.log(`REST request to delete message: ${messageId}`);

    // 1. Get the authenticated user
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );

    // 2. Perform the soft delete (validates ownership inside)
    const result = await this.messageService.softDelete(
      messageId,
      user.user_id,
    );

    // 3. Notify connected clients in the group room via Socket.IO
    this.chatGateway.server.to(result.groupId).emit('message:deleted', {
      messageId: result.messageId,
      groupId: result.groupId,
    });

    return {
      message: 'Message deleted successfully',
      messageId: result.messageId,
      groupId: result.groupId,
    };
  }
}
