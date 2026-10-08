import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, LessThan, Repository } from 'typeorm';
import { GetActivityLogsDto } from './dto/get-activity-logs.dto';
import { ActivityAction, ActivityLog } from './entities/activity-log.entity';

export interface ActivityActor {
  user_id?: number;
  name?: string;
  email?: string;
  business?: {
    business_id?: number;
  };
}

export interface CreateActivityLogInput {
  action: ActivityAction;
  module: string;
  entityType: string;
  entityId: string | number;
  entityName?: string;
  fieldChanged?: string;
  oldValue?: any;
  newValue?: any;
  actor?: ActivityActor;
  businessId?: number;
  description?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  metadata?: Record<string, any>;
}

@Injectable()
export class ActivityHelper {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityRepository: Repository<ActivityLog>,
  ) {}

  async create(input: CreateActivityLogInput): Promise<ActivityLog> {
    const activity = this.activityRepository.create({
      action: input.action,
      module: input.module,
      entityType: input.entityType,
      entityId: String(input.entityId),
      entityName: input.entityName,
      fieldChanged: input.fieldChanged,
      oldValue: this.stringifyValue(input.oldValue),
      newValue: this.stringifyValue(input.newValue),
      userId: input.actor?.user_id,
      userName: input.actor?.name,
      userEmail: input.actor?.email,
      businessId: input.businessId ?? input.actor?.business?.business_id,
      description: input.description ?? this.buildDescription(input),
      before: input.before,
      after: input.after,
      metadata: input.metadata,
    });

    return await this.activityRepository.save(activity);
  }

  async findForBusiness(businessId: number, query: GetActivityLogsDto) {
    const where: FindOptionsWhere<ActivityLog> = { businessId };

    if (query.action) where.action = query.action;
    if (query.module) where.module = query.module;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.userId) where.userId = query.userId;
    if (query.fieldChanged) where.fieldChanged = query.fieldChanged;

    if (query.cursor) {
      const cursor = await this.activityRepository.findOne({
        where: { id: query.cursor, businessId },
      });

      if (cursor) {
        where.createdAt = LessThan(cursor.createdAt);
      }
    }

    const limit = query.limit ?? 50;
    const logs = await this.activityRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit + 1,
    });

    const hasMore = logs.length > limit;
    const data = hasMore ? logs.slice(0, limit) : logs;

    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
    };
  }

  getChangedFields(
    before: Record<string, any>,
    after: Record<string, any>,
    fields: string[],
  ): string[] {
    return fields.filter(
      (field) => !this.valuesEqual(before?.[field], after?.[field]),
    );
  }

  private stringifyValue(value: any): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value);
  }

  private valuesEqual(first: any, second: any): boolean {
    return JSON.stringify(first ?? null) === JSON.stringify(second ?? null);
  }

  private buildDescription(input: CreateActivityLogInput): string {
    const userName = input.actor?.name ?? input.actor?.email ?? 'A user';
    const entityName = input.entityName ?? input.entityType;

    if (input.action === ActivityAction.UPDATED && input.fieldChanged) {
      return `${userName} updated ${input.entityType} ${entityName} ${input.fieldChanged} from ${this.stringifyValue(input.oldValue)} to ${this.stringifyValue(input.newValue)}`;
    }

    return `${userName} ${input.action} ${input.entityType} ${entityName}`;
  }
}
