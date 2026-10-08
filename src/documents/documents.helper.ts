import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserHelper } from '../user/user.helper';
import { CreateDocumentDto } from './dto/create-document.dto';
import { Document } from './entities/document.entity';

@Injectable()
export class DocumentsHelper {
  private readonly logger = new Logger(DocumentsHelper.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentsRepository: Repository<Document>,
    private readonly userHelper: UserHelper,
  ) {}

  async getUserWithBusiness(email: string) {
    return this.userHelper.getUserWithBusinessDetail(email);
  }

  async createDocument(
    createDocumentDto: CreateDocumentDto,
  ): Promise<Document> {
    const document = this.documentsRepository.create(createDocumentDto);
    return this.documentsRepository.save(document);
  }

  async findDocumentById(id: number): Promise<Document> {
    const document = await this.documentsRepository.findOne({
      where: { document_id: id },
    });

    if (!document) {
      this.logger.warn(`Document with ID ${id} not found`);
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    return document;
  }

  async findContextualDocuments(
    userId: number,
    teamIds: string[],
    projectIds: string[],
  ): Promise<Document[]> {
    const conditions: any[] = [
      { reference_type: 'personal', reference_id: userId.toString() },
      { reference_type: 'user', reference_id: userId.toString() },
    ];

    if (teamIds.length > 0) {
      conditions.push({ reference_type: 'team', reference_id: In(teamIds) });
    }

    if (projectIds.length > 0) {
      conditions.push({
        reference_type: 'project',
        reference_id: In(projectIds),
      });
    }

    conditions.push({ reference_type: 'client' });
    conditions.push({ reference_type: 'other' });

    return this.documentsRepository.find({
      where: conditions,
      order: { created_at: 'DESC' },
    });
  }

  async saveDocument(document: Document): Promise<Document> {
    return this.documentsRepository.save(document);
  }

  async removeDocument(document: Document): Promise<Document> {
    return this.documentsRepository.remove(document);
  }
}
