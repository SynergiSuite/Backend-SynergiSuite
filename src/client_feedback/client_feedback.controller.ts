import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../shared/auth.guard';
import { IsVerifiedGuard } from '../shared/isVerified.guard';
import { ClientFeedbackService } from './client_feedback.service';
import { CreateClientFeedbackReplyDto } from './dto/create-client-feedback-reply.dto';
import { CreateClientFeedbackDto } from './dto/create-client-feedback.dto';
import { GetClientFeedbackDto } from './dto/get-client-feedback.dto';
import { SubmitClientFeedbackDto } from './dto/submit-client-feedback.dto';
import { UpdateClientFeedbackDto } from './dto/update-client-feedback.dto';
import {
  ClientHasOngoingProjectGuard,
  ValidClientFeedbackSubmissionGuard,
} from './client_feedback.guard';
import { FrontendSecretGuard } from 'src/shared/frontend-secret.guard';

@Controller('client-feedback')
@UseGuards(FrontendSecretGuard, JwtGuard, IsVerifiedGuard)
export class ClientFeedbackController {
  constructor(private readonly clientFeedbackService: ClientFeedbackService) {}

  @Post()
  create(
    @Req() req: Request,
    @Body() createClientFeedbackDto: CreateClientFeedbackDto,
  ) {
    return this.clientFeedbackService.create(createClientFeedbackDto, req.user);
  }

  @Post('submit')
  @UseGuards(ValidClientFeedbackSubmissionGuard)
  submitFeedback(
    @Req() req: Request,
    @Body() submitClientFeedbackDto: SubmitClientFeedbackDto,
  ) {
    return this.clientFeedbackService.submitFeedback(
      submitClientFeedbackDto,
      req.user,
    );
  }

  @Get()
  findAll(@Req() req: Request, @Query() query: GetClientFeedbackDto) {
    return this.clientFeedbackService.findAll(query, req.user);
  }

  @Get('my-feedback')
  @UseGuards(ClientHasOngoingProjectGuard)
  findClientFeedback(
    @Req() req: Request,
    @Query() query: GetClientFeedbackDto,
  ) {
    return this.clientFeedbackService.findClientFeedback(req.user, query);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.clientFeedbackService.findOne(id, req.user);
  }

  @Post(':id/replies')
  createReply(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createClientFeedbackReplyDto: CreateClientFeedbackReplyDto,
  ) {
    return this.clientFeedbackService.createReply(
      id,
      createClientFeedbackReplyDto,
      req.user,
    );
  }

  @Get(':id/replies')
  findReplies(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.clientFeedbackService.findReplies(id, req.user);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateClientFeedbackDto: UpdateClientFeedbackDto,
  ) {
    return this.clientFeedbackService.update(
      id,
      updateClientFeedbackDto,
      req.user,
    );
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.clientFeedbackService.remove(id, req.user);
  }
}
