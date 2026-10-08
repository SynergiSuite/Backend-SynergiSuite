import { Injectable, Logger } from '@nestjs/common';
import {
  ActivityActor,
  ActivityHelper,
  CreateActivityLogInput,
} from './activity.helper';
import { GetActivityLogsDto } from './dto/get-activity-logs.dto';
import { ActivityLog } from './entities/activity-log.entity';

export { ActivityActor, CreateActivityLogInput };

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly activityHelper: ActivityHelper) {}

  async log(input: CreateActivityLogInput): Promise<ActivityLog | null> {
    try {
      return await this.activityHelper.create(input);
    } catch (error) {
      this.logger.error(
        `Failed to write activity log: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  async logFieldChanges(
    baseInput: Omit<
      CreateActivityLogInput,
      'fieldChanged' | 'oldValue' | 'newValue'
    >,
    before: Record<string, any>,
    after: Record<string, any>,
    fields: string[],
  ): Promise<void> {
    const changes = this.activityHelper.getChangedFields(before, after, fields);

    if (changes.length === 0) {
      return;
    }

    for (const field of changes) {
      await this.log({
        ...baseInput,
        fieldChanged: field,
        oldValue: before?.[field],
        newValue: after?.[field],
        before,
        after,
      });
    }
  }

  async findForBusiness(businessId: number, query: GetActivityLogsDto) {
    return this.activityHelper.findForBusiness(businessId, query);
  }
}
