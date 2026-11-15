import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { MinIO } from './minIO.service';
import { JwtGuard } from 'src/shared/auth.guard';
import { IsVerifiedGuard } from 'src/shared/isVerified.guard';
import { FrontendSecretGuard } from 'src/shared/frontend-secret.guard';
import { DocumentAccessGuard } from 'src/documents/document.guard';

@Controller('resources')
export class ResourceController {
  private readonly logger = new Logger(ResourceController.name);

  constructor(private readonly minioService: MinIO) {}

  @Post('upload-url')
  @UseGuards(FrontendSecretGuard)
  async getUploadUrl(
    @Body() body: { fileName: string; mimeType: string; bucket?: string },
  ) {
    this.logger.log(
      `Received request to generate upload URL for file: ${body.fileName}`,
    );
    return await this.minioService.generateUploadUrl(
      body.fileName,
      body.mimeType,
      body.bucket,
    );
  }

  @Post('chat/upload-url')
  @UseGuards(FrontendSecretGuard, JwtGuard, IsVerifiedGuard)
  async getChatUploadUrl(@Body() body: { fileName: string; mimeType: string }) {
    this.logger.log(
      `Received request to generate chat upload URL for file: ${body.fileName}`,
    );
    return await this.minioService.generateUploadUrl(
      body.fileName,
      body.mimeType,
      'synergi-chat-attachments',
    );
  }

  @Get(':id/view-url')
  @UseGuards(
    FrontendSecretGuard,
    JwtGuard,
    IsVerifiedGuard,
    DocumentAccessGuard,
  )
  async getViewUrl(@Param('id') id: string, @Req() req: any) {
    this.logger.log(
      `Received request to generate view URL for document ID: ${id}`,
    );
    // Document is attached by the DocumentAccessGuard
    const document = req.document;

    return await this.minioService.generateViewUrl(document.file_path);
  }
}
