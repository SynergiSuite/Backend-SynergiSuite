import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../shared/auth.guard';
import { IsVerifiedGuard } from '../shared/isVerified.guard';
import { UserHelper } from '../user/user.helper';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtGuard, IsVerifiedGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly userHelper: UserHelper,
  ) {}

  @Get()
  async findAll(@Req() req: Request, @Query() query: GetNotificationsDto) {
    const userId = await this.getRequestUserId(req);
    return this.notificationsService.findForUser(
      userId,
      query.limit,
      query.cursor,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: Request) {
    const userId = await this.getRequestUserId(req);
    return {
      count: await this.notificationsService.getUnreadCount(userId),
    };
  }

  @Patch('read-all')
  async markAllRead(@Req() req: Request) {
    const userId = await this.getRequestUserId(req);
    return this.notificationsService.markAllRead(userId);
  }

  @Patch(':id/read')
  async markRead(@Req() req: Request, @Param('id') id: string) {
    const userId = await this.getRequestUserId(req);
    return this.notificationsService.markRead(id, userId);
  }

  @Delete(':id')
  async delete(@Req() req: Request, @Param('id') id: string) {
    const userId = await this.getRequestUserId(req);
    return this.notificationsService.delete(id, userId);
  }

  private async getRequestUserId(req: Request): Promise<number> {
    const user = await this.userHelper.getUserWithBusinessDetail(
      (req.user as any).email,
    );
    return user.user_id;
  }
}
