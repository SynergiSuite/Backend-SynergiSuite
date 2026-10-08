import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { Business } from '../business/entities/business.entity';
import { TaskStatus } from '../projects/entities/task.entity';
import { Team } from '../teams/entities/team.entity';
import { User } from '../user/entities/user.entity';
import { UserHelper } from '../user/user.helper';
import { toRoleResponse } from '../roles/role-access';
import { ListReportsDto } from './dto/list-reports.dto';
import { RegisterReportFileDto } from './dto/register-report-file.dto';
import { UploadReportPdfDto } from './dto/upload-report-pdf.dto';
import {
  ChatbotReportFile,
  ChatbotReportJobType,
} from './entities/chatbot-report-file.entity';
import {
  ChatbotReportJob,
  ChatbotReportJobStatus,
} from './entities/chatbot-report-job.entity';
import { Report } from './entities/report.entity';

@Injectable()
export class ChatbotHelper {
  private readonly logger = new Logger(ChatbotHelper.name);

  constructor(
    @InjectRepository(ChatbotReportJob)
    private readonly reportJobRepository: Repository<ChatbotReportJob>,
    @InjectRepository(ChatbotReportFile)
    private readonly reportFileRepository: Repository<ChatbotReportFile>,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    private readonly userHelper: UserHelper,
    private readonly dataSource: DataSource,
  ) {}

  async listAllBusinesses() {
    const businesses = await this.businessRepository.find({
      relations: ['category'],
      order: { name: 'ASC' },
    });

    return {
      data: businesses.map((business) => ({
        businessId: business.business_id,
        name: business.name,
        numberOfEmployees: business.number_of_employees,
        registrationDate: business.registration_date,
        category: business.category
          ? {
              id: business.category.id,
              name: business.category.name,
            }
          : null,
      })),
      total: businesses.length,
    };
  }

  async listEmployeesByBusinessId(businessId: number) {
    await this.ensureBusinessExists(businessId);

    const employees = await this.userRepository.find({
      where: { business: { business_id: businessId } },
      relations: ['role', 'role.primary_role'],
      order: { name: 'ASC' },
    });
    const employeesOnly = employees.filter(
      (employee) => !this.isClientUser(employee),
    );

    return {
      data: employeesOnly.map((employee) => ({
        userId: employee.user_id,
        name: employee.name,
        email: employee.email,
        salary: employee.salary,
        isVerified: employee.is_Verified,
        registrationDate: employee.registration_date,
        role: toRoleResponse(employee.role),
      })),
      total: employeesOnly.length,
    };
  }

  async listTeamsByBusinessId(businessId: number) {
    await this.ensureBusinessExists(businessId);

    const teams = await this.teamRepository.find({
      where: { business: { business_id: businessId } },
      relationLoadStrategy: 'query',
      relations: [
        'leader',
        'leader.role',
        'leader.role.primary_role',
        'members',
        'members.user',
        'members.user.role',
        'members.user.role.primary_role',
        'projects',
        'tasks',
      ],
      order: { name: 'ASC' },
    });

    return {
      data: teams.map((team) => {
        const tasks = team.tasks ?? [];
        const members = (team.members ?? []).filter(
          (member) => member.user && !this.isClientUser(member.user),
        );
        const completedTasks = tasks.filter(
          (task) => task.status === TaskStatus.COMPLETED,
        ).length;

        return {
          teamId: team.id,
          name: team.name,
          description: team.description,
          leader:
            team.leader && !this.isClientUser(team.leader)
              ? {
                  userId: team.leader.user_id,
                  name: team.leader.name,
                  email: team.leader.email,
                }
              : null,
          members: members.map((member) => ({
            memberId: member.id,
            userId: member.user?.user_id,
            name: member.user?.name,
            email: member.user?.email,
          })),
          totalMembers: members.length,
          totalProjects: team.projects?.length ?? 0,
          totalTasks: tasks.length,
          completedTasks,
          ongoingTasks: tasks.length - completedTasks,
        };
      }),
      total: teams.length,
    };
  }

  async saveBusinessReport(input: {
    businessId: number;
    reportName: string;
    objectKey: string;
    fileSize: string;
    checksum: string;
  }) {
    return this.reportRepository.save(
      this.reportRepository.create({
        businessId: input.businessId,
        reportName: input.reportName,
        bucket: 'reports',
        objectKey: input.objectKey,
        contentType: 'application/pdf',
        fileSize: input.fileSize,
        checksum: input.checksum,
      }),
    );
  }

  async findReportJobsForBusiness(businessId: number) {
    return this.reportJobRepository.find({
      where: { businessId },
      order: { nextDueAt: 'ASC', updatedAt: 'DESC' },
    });
  }

  async upsertReportJob(
    businessId: number,
    dto: {
      jobName: string;
      status?: ChatbotReportJobStatus;
      nextDueAt?: string;
      maxAttempts?: number;
      metadata?: Record<string, any>;
    },
  ) {
    const existing = await this.findReportJob(businessId, dto.jobName);
    const job =
      existing ??
      this.reportJobRepository.create({
        businessId,
        jobName: dto.jobName,
      });

    job.status = dto.status ?? job.status ?? ChatbotReportJobStatus.PENDING;
    job.nextDueAt = dto.nextDueAt ? new Date(dto.nextDueAt) : job.nextDueAt;
    job.maxAttempts = dto.maxAttempts ?? job.maxAttempts ?? 3;
    job.metadata = dto.metadata ?? job.metadata ?? null;

    return this.reportJobRepository.save(job);
  }

  async updateReportJobStatus(
    businessId: number,
    jobName: string,
    status: ChatbotReportJobStatus,
    options: {
      errorMessage?: string;
      generatedPdfBucket?: string;
      generatedPdfKey?: string;
      nextDueAt?: string;
      metadata?: Record<string, any>;
    },
  ) {
    const job =
      (await this.findReportJob(businessId, jobName)) ??
      this.reportJobRepository.create({ businessId, jobName });

    this.applyJobStatus(job, status, options);
    return this.reportJobRepository.save(job);
  }

  async findReportFilesForBusiness(businessId: number) {
    return this.reportFileRepository.find({
      where: { businessId },
      order: { generatedAt: 'DESC', createdAt: 'DESC' },
      take: 100,
    });
  }

  async findReportsForBusiness(businessId: number, query: ListReportsDto = {}) {
    return this.reportRepository.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
      take: query.limit ?? 100,
    });
  }

  async saveReportFile(businessId: number, dto: RegisterReportFileDto) {
    return this.reportFileRepository.save(
      this.reportFileRepository.create({
        businessId,
        bucket: dto.bucket,
        objectKey: dto.objectKey,
        generatedAt: dto.generatedAt ? new Date(dto.generatedAt) : new Date(),
        jobType: dto.jobType,
        reportPeriodStart: new Date(dto.reportPeriodStart),
        reportPeriodEnd: new Date(dto.reportPeriodEnd),
        entityType: dto.entityType ?? this.getEntityType(dto.jobType),
        entityId: dto.entityId ?? null,
        entityName: dto.entityName ?? null,
        fileSize: dto.fileSize ?? null,
        checksum: dto.checksum ?? null,
        contentType: dto.contentType ?? 'application/pdf',
        metadata: dto.metadata ?? null,
      }),
    );
  }

  async markJobSucceeded(
    businessId: number,
    jobName: string,
    reportFile: ChatbotReportFile,
    options: { nextDueAt?: string; metadata?: Record<string, any> },
  ) {
    await this.updateReportJobStatus(
      businessId,
      jobName,
      ChatbotReportJobStatus.SUCCESS,
      {
        generatedPdfBucket: reportFile.bucket,
        generatedPdfKey: reportFile.objectKey,
        nextDueAt: options.nextDueAt,
        metadata: options.metadata,
      },
    );
  }

  async findReportJob(businessId: number, jobName: string) {
    return this.reportJobRepository.findOne({
      where: { businessId, jobName },
    });
  }

  async ensureReportTables() {
    await this.dataSource.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chatbot_report_jobs_status_enum') THEN
          CREATE TYPE chatbot_report_jobs_status_enum AS ENUM (
            'pending',
            'running',
            'success',
            'failed'
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chatbot_report_files_job_type_enum') THEN
          CREATE TYPE chatbot_report_files_job_type_enum AS ENUM (
            'business',
            'team',
            'employee'
          );
        END IF;
      END
      $$;

      CREATE TABLE IF NOT EXISTS chatbot_report_jobs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id int NOT NULL,
        job_name varchar(120) NOT NULL,
        status chatbot_report_jobs_status_enum NOT NULL DEFAULT 'pending',
        last_successful_run timestamptz,
        next_due_at timestamptz,
        error_message text,
        generated_pdf_bucket varchar(255),
        generated_pdf_key text,
        attempt_count int NOT NULL DEFAULT 0,
        max_attempts int NOT NULL DEFAULT 3,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_chatbot_report_jobs_business_job UNIQUE (business_id, job_name)
      );

      CREATE INDEX IF NOT EXISTS idx_chatbot_report_jobs_due_status
        ON chatbot_report_jobs (next_due_at, status);

      CREATE TABLE IF NOT EXISTS chatbot_report_files (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id int NOT NULL,
        bucket varchar(255) NOT NULL,
        object_key text NOT NULL,
        generated_at timestamptz NOT NULL,
        job_type chatbot_report_files_job_type_enum NOT NULL,
        report_period_start timestamptz NOT NULL,
        report_period_end timestamptz NOT NULL,
        entity_type varchar(50),
        entity_id varchar(120),
        entity_name varchar(255),
        file_size bigint,
        checksum varchar(128),
        content_type varchar(120) NOT NULL DEFAULT 'application/pdf',
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_chatbot_report_files_business_generated
        ON chatbot_report_files (business_id, generated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_chatbot_report_files_entity
        ON chatbot_report_files (entity_type, entity_id);

      CREATE TABLE IF NOT EXISTS reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id int NOT NULL,
        report_name varchar(255) NOT NULL,
        bucket varchar(255) NOT NULL DEFAULT 'reports',
        object_key text NOT NULL,
        content_type varchar(120) NOT NULL DEFAULT 'application/pdf',
        file_size bigint NOT NULL,
        checksum varchar(128) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_reports_business_created
        ON reports (business_id, created_at DESC);
    `);

    this.logger.log('Chatbot report tables are ready.');
  }

  async ensureBusinessExists(businessId: number) {
    const exists = await this.businessRepository.exist({
      where: { business_id: businessId },
    });

    if (!exists) {
      throw new NotFoundException('Business not found.');
    }
  }

  buildReportObjectKey(dto: UploadReportPdfDto, generatedAt: Date) {
    const date = generatedAt.toISOString().slice(0, 10);
    const period = this.formatPeriod(
      dto.reportPeriodStart,
      dto.reportPeriodEnd,
    );
    const entitySegment = dto.entityId
      ? `/${this.slugify(dto.entityName || dto.entityId)}`
      : '';
    const fileName = this.slugify(dto.fileName || `${period}.pdf`);

    return `reports/monthly/${dto.jobType}${entitySegment}/${date}-${fileName}`;
  }

  buildBusinessReportObjectKey(
    businessId: number,
    reportName: string,
    generatedAt: Date,
  ) {
    const date = generatedAt.toISOString().slice(0, 10);
    return `business/${businessId}/${date}-${this.slugify(reportName)}`;
  }

  sha256(buffer: Buffer) {
    return createHash('sha256').update(buffer).digest('hex');
  }

  async getBusinessId(reqUser: any) {
    const directBusinessId =
      reqUser?.businessId ??
      reqUser?.business_id ??
      reqUser?.business?.business_id ??
      reqUser?.business?.id;

    if (directBusinessId) {
      return Number(directBusinessId);
    }

    if (reqUser?.email) {
      const user = await this.userHelper.getUserWithBusinessDetail(
        reqUser.email,
      );
      return user.business.business_id;
    }

    throw new BadRequestException('Unable to resolve business for user.');
  }

  private applyJobStatus(
    job: ChatbotReportJob,
    status: ChatbotReportJobStatus,
    options: {
      errorMessage?: string;
      generatedPdfBucket?: string;
      generatedPdfKey?: string;
      nextDueAt?: string;
      metadata?: Record<string, any>;
    },
  ) {
    job.status = status;
    job.errorMessage =
      status === ChatbotReportJobStatus.FAILED
        ? (options.errorMessage ?? 'Report job failed.')
        : null;
    job.nextDueAt = options.nextDueAt
      ? new Date(options.nextDueAt)
      : job.nextDueAt;
    job.metadata = options.metadata ?? job.metadata ?? null;

    if (status === ChatbotReportJobStatus.RUNNING) {
      job.attemptCount = (job.attemptCount ?? 0) + 1;
    }

    if (status === ChatbotReportJobStatus.SUCCESS) {
      job.lastSuccessfulRun = new Date();
      job.attemptCount = 0;
      job.generatedPdfBucket =
        options.generatedPdfBucket ?? job.generatedPdfBucket ?? null;
      job.generatedPdfKey =
        options.generatedPdfKey ?? job.generatedPdfKey ?? null;
    }
  }

  private formatPeriod(startDate: string, endDate: string) {
    return `${startDate.slice(0, 10)}_${endDate.slice(0, 10)}`;
  }

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private getEntityType(jobType: ChatbotReportJobType) {
    if (jobType === ChatbotReportJobType.TEAM) return 'team';
    if (jobType === ChatbotReportJobType.EMPLOYEE) return 'employee';
    return 'business';
  }

  private isClientUser(user: User) {
    return (
      user.role?.primary_role?.name?.trim().toLowerCase() === 'client' ||
      user.role?.name?.trim().toLowerCase() === 'client'
    );
  }
}
