import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { AnalyticsQueryDto } from '../analytics/dto/analytics-query.dto';
import { JwtGuard } from '../shared/auth.guard';
import { CronSecretGuard } from '../shared/cron-secret.guard';
import { IsVerifiedGuard } from '../shared/isVerified.guard';
import { ChatbotService } from './chatbot.service';
import { ListReportsDto } from './dto/list-reports.dto';
import { RegisterReportFileDto } from './dto/register-report-file.dto';
import { UpdateReportJobStatusDto } from './dto/update-report-job-status.dto';
import { UploadReportPdfDto } from './dto/upload-report-pdf.dto';
import { UpsertReportJobDto } from './dto/upsert-report-job.dto';

@Controller('chatbot')
@UseGuards(JwtGuard, IsVerifiedGuard)
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Get('analytics/manifest')
  getAnalyticsManifest(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.chatbotService.getAnalyticsManifest(req.user, query);
  }

  @Get('analytics/details/business')
  getBusinessAnalytics(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.chatbotService.getBusinessAnalytics(req.user, query);
  }

  @Get('analytics/teams')
  getTeamsAnalytics(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.chatbotService.getTeamsAnalytics(req.user, query);
  }

  @Get('analytics/details/teams/:teamId')
  getTeamDetail(
    @Req() req: Request,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.chatbotService.getTeamDetail(req.user, teamId, query);
  }

  @Get('analytics/employees')
  getEmployeesAnalytics(
    @Req() req: Request,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.chatbotService.getEmployeesAnalytics(req.user, query);
  }

  @Get('analytics/details/employees/:userId')
  getEmployeeDetail(
    @Req() req: Request,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: AnalyticsQueryDto,
  ): Promise<any> {
    return this.chatbotService.getEmployeeDetail(req.user, userId, query);
  }

  @Get('businesses')
  @UseGuards(CronSecretGuard)
  listAllBusinesses() {
    return this.chatbotService.listAllBusinesses();
  }

  @Get('businesses/:businessId/employees')
  @UseGuards(CronSecretGuard)
  listEmployeesByBusinessId(
    @Param('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.chatbotService.listEmployeesByBusinessId(businessId);
  }

  @Get('businesses/:businessId/employees/:userId')
  @UseGuards(CronSecretGuard)
  getEmployeeDetailByBusinessId(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.chatbotService.getEmployeeDetailByBusinessId(
      businessId,
      userId,
      query,
    );
  }

  @Get('businesses/:businessId/teams')
  @UseGuards(CronSecretGuard)
  listTeamsByBusinessId(@Param('businessId', ParseIntPipe) businessId: number) {
    return this.chatbotService.listTeamsByBusinessId(businessId);
  }

  @Get('businesses/:businessId/teams/:teamId')
  @UseGuards(CronSecretGuard)
  getTeamDetailByBusinessId(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.chatbotService.getTeamDetailByBusinessId(
      businessId,
      teamId,
      query,
    );
  }

  @Post('businesses/:businessId/reports')
  @UseGuards(CronSecretGuard)
  @UseInterceptors(FilesInterceptor('files', 20))
  uploadBusinessReports(
    @Param('businessId', ParseIntPipe) businessId: number,
    @UploadedFiles() files: any[],
  ) {
    return this.chatbotService.uploadBusinessReports(businessId, files);
  }

  @Get('report-jobs')
  listReportJobs(@Req() req: Request) {
    return this.chatbotService.listReportJobs(req.user);
  }

  @Get('report-jobs/:jobName')
  getReportJob(@Req() req: Request, @Param('jobName') jobName: string) {
    return this.chatbotService.getReportJob(req.user, jobName);
  }

  @Post('report-jobs')
  upsertReportJob(@Req() req: Request, @Body() dto: UpsertReportJobDto) {
    return this.chatbotService.upsertReportJob(req.user, dto);
  }

  @Patch('report-jobs/:jobName/status')
  updateReportJobStatus(
    @Req() req: Request,
    @Param('jobName') jobName: string,
    @Body() dto: UpdateReportJobStatusDto,
  ) {
    return this.chatbotService.updateReportJobStatus(req.user, jobName, dto);
  }

  @Get('report-files')
  listReportFiles(@Req() req: Request) {
    return this.chatbotService.listReportFiles(req.user);
  }

  @Post('reports/upload-pdf')
  uploadReportPdf(@Req() req: Request, @Body() dto: UploadReportPdfDto) {
    return this.chatbotService.uploadReportPdf(req.user, dto);
  }

  @Post('reports/metadata')
  registerReportFile(@Req() req: Request, @Body() dto: RegisterReportFileDto) {
    return this.chatbotService.registerReportFile(req.user, dto);
  }

  @Get('reports')
  listReports(@Req() req: Request, @Query() query: ListReportsDto) {
    return this.chatbotService.listReports(req.user, query);
  }

  @Get('reports/retry-policy')
  getRetryPolicy() {
    return this.chatbotService.getRetryPolicy();
  }
}
