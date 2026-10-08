import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { TaskPriority } from '../projects/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { UserHelper } from '../user/user.helper';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import {
  AnalyticsMetricType,
  AnalyticsRecord,
} from './entities/analytics-record.entity';

export interface AnalyticsDateRange {
  startDate: Date;
  endDate: Date;
}

export interface SaveAnalyticsRecordInput {
  businessId: number;
  metricType: AnalyticsMetricType;
  scopeType?: string | null;
  scopeId?: string | null;
  scopeName?: string | null;
  periodStart: Date;
  periodEnd: Date;
  score: number;
  data: Record<string, any>;
  calculatedAt: Date;
}

@Injectable()
export class AnalyticsHelper {
  private readonly analyticsCacheTtlMs = 24 * 60 * 60 * 1000;

  private readonly priorityWeights: Record<string, number> = {
    [TaskPriority.LOW]: 1,
    [TaskPriority.MEDIUM]: 2,
    [TaskPriority.HIGH]: 3,
  };

  constructor(
    @InjectRepository(AnalyticsRecord)
    private readonly analyticsRecordRepository: Repository<AnalyticsRecord>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly userHelper: UserHelper,
  ) {}

  async getBusinessContext(reqUser: any) {
    const user = await this.userHelper.getUserWithBusinessDetail(reqUser.email);

    return {
      user,
      businessId: user.business.business_id,
    };
  }

  async getBusinessEmployeeOrFail(userId: number, businessId: number) {
    const user = await this.userRepository.findOne({
      where: {
        user_id: userId,
        business: { business_id: businessId },
      },
      relations: ['business', 'role', 'role.primary_role'],
    });

    if (!user || this.isClientUser(user)) {
      throw new BadRequestException(
        'Employee does not exist for this business.',
      );
    }

    return user;
  }

  async saveRecord(input: SaveAnalyticsRecordInput): Promise<AnalyticsRecord> {
    const record = this.analyticsRecordRepository.create({
      businessId: input.businessId,
      metricType: input.metricType,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      scopeName: input.scopeName,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      score: Number(input.score ?? 0),
      data: input.data,
      calculatedAt: input.calculatedAt,
    });

    return this.analyticsRecordRepository.save(record);
  }

  async findFreshOverviewRecord(
    businessId: number,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsRecord | null> {
    const where: FindOptionsWhere<AnalyticsRecord> = {
      businessId,
      metricType: AnalyticsMetricType.OVERVIEW,
      scopeType: 'business',
      scopeId: String(businessId),
    };

    const records = await this.analyticsRecordRepository.find({
      where,
      order: { calculatedAt: 'DESC', createdAt: 'DESC' },
      take: 10,
    });

    const now = Date.now();
    const matchingRecord = records.find((record) => {
      if (now - record.calculatedAt.getTime() > this.analyticsCacheTtlMs) {
        return false;
      }

      if (!query.startDate && !query.endDate) {
        return true;
      }

      const range = this.resolveDateRange(query);
      return (
        record.periodStart.getTime() === range.startDate.getTime() &&
        record.periodEnd.getTime() === range.endDate.getTime()
      );
    });

    return matchingRecord ?? null;
  }

  async findFreshClientAnalyticsRecord(
    businessId: number,
    query: AnalyticsQueryDto,
    range: AnalyticsDateRange,
  ): Promise<AnalyticsRecord | null> {
    const where: FindOptionsWhere<AnalyticsRecord> = {
      businessId,
      metricType: AnalyticsMetricType.CLIENT_ANALYTICS,
      scopeType: query.clientId ? 'client' : 'business',
      scopeId: query.clientId ?? String(businessId),
    };

    const records = await this.analyticsRecordRepository.find({
      where,
      order: { calculatedAt: 'DESC', createdAt: 'DESC' },
      take: 10,
    });

    const now = Date.now();
    return (
      records.find((record) => {
        if (now - record.calculatedAt.getTime() > this.analyticsCacheTtlMs) {
          return false;
        }

        return (
          record.periodStart.getTime() === range.startDate.getTime() &&
          record.periodEnd.getTime() === range.endDate.getTime()
        );
      }) ?? null
    );
  }

  getRecordsWhere(
    businessId: number,
    query: AnalyticsQueryDto,
  ): FindOptionsWhere<AnalyticsRecord> {
    const where: FindOptionsWhere<AnalyticsRecord> = { businessId };

    if (query.metricType) where.metricType = query.metricType;
    if (query.scopeType) where.scopeType = query.scopeType;
    if (query.scopeId) where.scopeId = query.scopeId;

    if (query.startDate && query.endDate) {
      where.periodStart = MoreThanOrEqual(new Date(query.startDate));
      where.periodEnd = LessThanOrEqual(new Date(query.endDate));
    } else if (query.startDate) {
      where.periodStart = MoreThanOrEqual(new Date(query.startDate));
    } else if (query.endDate) {
      where.periodEnd = LessThanOrEqual(new Date(query.endDate));
    }

    return where;
  }

  async findRecordsForBusiness(businessId: number, query: AnalyticsQueryDto) {
    return this.analyticsRecordRepository.find({
      where: this.getRecordsWhere(businessId, query),
      order: { calculatedAt: 'DESC', createdAt: 'DESC' },
      take: 100,
    });
  }

  isClientUser(user: User) {
    return (
      user.role?.primary_role?.name?.trim().toLowerCase() === 'client' ||
      user.role?.name?.trim().toLowerCase() === 'client'
    );
  }

  resolveDateRange(query: AnalyticsQueryDto): AnalyticsDateRange {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date range.');
    }

    if (startDate > endDate) {
      throw new BadRequestException('startDate must be before endDate.');
    }

    return { startDate, endDate };
  }

  resolveQuarterRange(query: AnalyticsQueryDto): AnalyticsDateRange {
    if (query.startDate || query.endDate) {
      return this.resolveDateRange(query);
    }

    const now = new Date();
    const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
    const startDate = new Date(
      Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1),
    );
    const endDate = new Date();

    return { startDate, endDate };
  }

  getPreviousRange(range: AnalyticsDateRange): AnalyticsDateRange {
    const length = range.endDate.getTime() - range.startDate.getTime();
    const previousEnd = new Date(range.startDate.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - length);

    return {
      startDate: previousStart,
      endDate: previousEnd,
    };
  }

  getPriorityWeight(priority?: TaskPriority): number {
    return this.priorityWeights[priority] ?? 1;
  }
}
