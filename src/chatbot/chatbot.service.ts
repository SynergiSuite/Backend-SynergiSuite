import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsQueryDto } from '../analytics/dto/analytics-query.dto';
import { MinIO } from '../minIO/minIO.service';
import { ChatbotHelper } from './chatbot.helper';
import { ListReportsDto } from './dto/list-reports.dto';
import { RegisterReportFileDto } from './dto/register-report-file.dto';
import { UpdateReportJobStatusDto } from './dto/update-report-job-status.dto';
import { UploadReportPdfDto } from './dto/upload-report-pdf.dto';
import { UpsertReportJobDto } from './dto/upsert-report-job.dto';
import { Report } from './entities/report.entity';

interface UploadedPdfFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class ChatbotService implements OnModuleInit {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly minioService: MinIO,
    private readonly chatbotHelper: ChatbotHelper,
  ) {}

  async onModuleInit() {
    await this.chatbotHelper.ensureReportTables();
  }

  async getAnalyticsManifest(
    reqUser: any,
    query: AnalyticsQueryDto,
  ): Promise<any> {
    const [business, teams, employees] = await Promise.all([
      this.analyticsService.getBusinessDetail(reqUser, query),
      this.analyticsService.getTeamsAnalytics(reqUser, query),
      this.analyticsService.getEmployeesAnalytics(reqUser, query),
    ]);

    return {
      endpoints: {
        businessReport: '/analytics/details/business',
        teamsList: '/analytics/teams',
        teamDetail: '/analytics/details/teams/:id',
        employeesList: '/analytics/employees',
        employeeDetail: '/analytics/details/employees/:id',
      },
      data: {
        business,
        teams,
        employees,
      },
    };
  }

  getBusinessAnalytics(reqUser: any, query: AnalyticsQueryDto): Promise<any> {
    return this.analyticsService.getBusinessDetail(reqUser, query);
  }

  getTeamsAnalytics(reqUser: any, query: AnalyticsQueryDto): Promise<any> {
    return this.analyticsService.getTeamsAnalytics(reqUser, query);
  }

  getTeamDetail(
    reqUser: any,
    teamId: string,
    query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getTeamDetail(reqUser, teamId, query);
  }

  getEmployeesAnalytics(reqUser: any, query: AnalyticsQueryDto): Promise<any> {
    return this.analyticsService.getEmployeesAnalytics(reqUser, query);
  }

  getEmployeeDetail(
    reqUser: any,
    userId: number,
    query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.analyticsService.getEmployeeDetail(reqUser, userId, query);
  }

  async listAllBusinesses() {
    return this.chatbotHelper.listAllBusinesses();
  }

  async listEmployeesByBusinessId(businessId: number) {
    return this.chatbotHelper.listEmployeesByBusinessId(businessId);
  }

  async getEmployeeDetailByBusinessId(
    businessId: number,
    userId: number,
    query: AnalyticsQueryDto,
  ) {
    await this.chatbotHelper.ensureBusinessExists(businessId);
    return this.analyticsService.getEmployeeDetailByBusinessId(
      businessId,
      userId,
      query,
    );
  }

  async listTeamsByBusinessId(businessId: number) {
    return this.chatbotHelper.listTeamsByBusinessId(businessId);
  }

  async getTeamDetailByBusinessId(
    businessId: number,
    teamId: string,
    query: AnalyticsQueryDto,
  ) {
    await this.chatbotHelper.ensureBusinessExists(businessId);
    return this.analyticsService.getTeamDetailByBusinessId(
      businessId,
      teamId,
      query,
    );
  }

  async uploadBusinessReports(businessId: number, files: UploadedPdfFile[]) {
    await this.chatbotHelper.ensureBusinessExists(businessId);

    if (!files?.length) {
      throw new BadRequestException('At least one PDF file is required.');
    }

    const savedReports: Report[] = [];

    for (const file of files) {
      if (file.mimetype !== 'application/pdf') {
        throw new BadRequestException(
          `Only PDF files are allowed. Invalid file: ${file.originalname}`,
        );
      }

      const checksum = this.chatbotHelper.sha256(file.buffer);
      const reportName = file.originalname;
      const objectKey = this.chatbotHelper.buildBusinessReportObjectKey(
        businessId,
        reportName,
        new Date(),
      );

      await this.minioService.uploadBuffer(
        'reports',
        objectKey,
        file.buffer,
        'application/pdf',
      );

      savedReports.push(
        await this.chatbotHelper.saveBusinessReport({
          businessId,
          reportName,
          objectKey,
          fileSize: String(file.size),
          checksum,
        }),
      );
    }

    return {
      data: savedReports,
      total: savedReports.length,
    };
  }

  async listReportJobs(reqUser: any) {
    const businessId = await this.getBusinessId(reqUser);
    return this.chatbotHelper.findReportJobsForBusiness(businessId);
  }

  async getReportJob(reqUser: any, jobName: string) {
    const businessId = await this.getBusinessId(reqUser);
    const job = await this.chatbotHelper.findReportJob(businessId, jobName);
    if (!job) {
      throw new NotFoundException('Report job not found.');
    }
    return job;
  }

  async upsertReportJob(reqUser: any, dto: UpsertReportJobDto) {
    const businessId = await this.getBusinessId(reqUser);
    return this.chatbotHelper.upsertReportJob(businessId, dto);
  }

  async updateReportJobStatus(
    reqUser: any,
    jobName: string,
    dto: UpdateReportJobStatusDto,
  ) {
    const businessId = await this.getBusinessId(reqUser);
    return this.chatbotHelper.updateReportJobStatus(
      businessId,
      jobName,
      dto.status,
      {
        errorMessage: dto.errorMessage,
        generatedPdfBucket: dto.generatedPdfBucket,
        generatedPdfKey: dto.generatedPdfKey,
        nextDueAt: dto.nextDueAt,
        metadata: dto.metadata,
      },
    );
  }

  async listReportFiles(reqUser: any) {
    const businessId = await this.getBusinessId(reqUser);
    return this.chatbotHelper.findReportFilesForBusiness(businessId);
  }

  async listReports(reqUser: any, query: ListReportsDto = {}) {
    const businessId = await this.getBusinessId(reqUser);
    const expiresIn = query.expiresIn ?? 300;

    const reports = await this.chatbotHelper.findReportsForBusiness(
      businessId,
      query,
    );

    const data = await Promise.all(
      reports.map(async (report) => {
        const { viewUrl } = await this.minioService.generateViewUrl(
          report.objectKey,
          report.bucket,
          expiresIn,
        );

        return {
          id: report.id,
          businessId: report.businessId,
          reportName: report.reportName,
          bucket: report.bucket,
          objectKey: report.objectKey,
          contentType: report.contentType,
          fileSize: report.fileSize,
          checksum: report.checksum,
          createdAt: report.createdAt,
          url: viewUrl,
          expiresIn,
        };
      }),
    );

    return {
      data,
      total: data.length,
    };
  }

  async uploadReportPdf(reqUser: any, dto: UploadReportPdfDto) {
    const businessId = await this.getBusinessId(reqUser);
    const buffer = Buffer.from(dto.pdfBase64, 'base64');
    if (!buffer.length) {
      throw new BadRequestException('PDF payload is empty.');
    }

    const checksum = this.chatbotHelper.sha256(buffer);
    const bucket =
      process.env.CHATBOT_REPORTS_BUCKET || process.env.S3_BUCKET_NAME;
    const objectKey = this.chatbotHelper.buildReportObjectKey(dto, new Date());

    await this.minioService.uploadBuffer(
      bucket,
      objectKey,
      buffer,
      'application/pdf',
    );

    const reportFile = await this.chatbotHelper.saveReportFile(businessId, {
      ...dto,
      bucket,
      objectKey,
      fileSize: String(buffer.length),
      checksum,
      contentType: 'application/pdf',
    });

    await this.chatbotHelper.markJobSucceeded(
      businessId,
      dto.jobName,
      reportFile,
      {
        nextDueAt: dto.nextDueAt,
        metadata: dto.metadata,
      },
    );

    return reportFile;
  }

  async registerReportFile(reqUser: any, dto: RegisterReportFileDto) {
    const businessId = await this.getBusinessId(reqUser);
    const reportFile = await this.chatbotHelper.saveReportFile(businessId, dto);

    await this.chatbotHelper.markJobSucceeded(
      businessId,
      dto.jobName,
      reportFile,
      {
        nextDueAt: dto.nextDueAt,
        metadata: dto.metadata,
      },
    );

    return reportFile;
  }

  getRetryPolicy() {
    return {
      apiCalls: {
        retry: true,
        maxAttempts: 3,
        behavior: 'Retry transient failures before failing the job.',
      },
      pdfUpload: {
        retry: true,
        maxAttempts: 3,
        behavior: 'Retry upload failures before storing report metadata.',
      },
      jobOutcome: {
        requiredBusinessReport: 'failed',
        teamOrEmployeeBatch: 'partial_success_metadata_or_failed_job',
        behavior:
          'Store failed entity ids/names in job metadata; mark the whole job failed when no report file is produced.',
      },
      alerts: {
        behavior:
          'Persist status/error_message and rely on application logging until an alerting provider is added.',
      },
    };
  }

  private async getBusinessId(reqUser: any) {
    return this.chatbotHelper.getBusinessId(reqUser);
  }
}
