import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../shared/auth.guard';
import { IsVerifiedGuard } from '../shared/isVerified.guard';
import { UserHelper } from '../user/user.helper';
import { ActivityService } from './activity.service';
import { GetActivityLogsDto } from './dto/get-activity-logs.dto';

@Controller('activity')
@UseGuards(JwtGuard, IsVerifiedGuard)
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly userHelper: UserHelper,
  ) {}

  @Get()
  async findAll(@Req() req: Request, @Query() query: GetActivityLogsDto) {
    const user = await this.userHelper.getUserWithBusinessDetail(
      (req.user as any).email,
    );

    return this.activityService.findForBusiness(
      user.business.business_id,
      query,
    );
  }
}
