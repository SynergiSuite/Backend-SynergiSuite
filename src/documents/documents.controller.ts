import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { JwtGuard } from 'src/shared/auth.guard';
import { IsVerifiedGuard } from 'src/shared/isVerified.guard';
import { DocumentDeleteGuard } from './document.guard';
import { Request } from 'express';

@Controller('documents')
@UseGuards(JwtGuard, IsVerifiedGuard)
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  create(@Req() req: Request, @Body() createDocumentDto: CreateDocumentDto) {
    this.logger.log(
      `Received request to create document: ${createDocumentDto.name}`,
    );
    return this.documentsService.create(req.user, createDocumentDto);
  }

  @Get()
  findAll(@Req() req: Request) {
    this.logger.log(`Received request to get all documents for user`);
    return this.documentsService.findAll(req.user);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
  ) {
    this.logger.log(`Received request to update document ID: ${id}`);
    return this.documentsService.update(req.user, +id, updateDocumentDto);
  }

  @Delete(':id')
  @UseGuards(DocumentDeleteGuard)
  remove(@Req() req: Request, @Param('id') id: string) {
    this.logger.log(`Received request to delete document ID: ${id}`);
    return this.documentsService.remove(req.user, +id);
  }
}
