import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { MinIO } from 'src/minIO/minIO.service';
import { UserService } from 'src/user/user.service';
import { TeamsService } from 'src/teams/teams.service';
import { ProjectsService } from 'src/projects/projects.service';
import { In } from 'typeorm';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentsRepository: Repository<Document>,
    private readonly minioService: MinIO,
    private readonly userService: UserService,
    private readonly teamsService: TeamsService,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(user: any, createDocumentDto: CreateDocumentDto): Promise<Document> {
    this.logger.log(`Initiating document creation for user: ${user.email}`);
    const userDetails = await this.userService.getUserWithBusiness(user.email);
    
    if (createDocumentDto.reference_type === 'personal' || createDocumentDto.reference_type === 'user') {
        createDocumentDto.reference_id = userDetails.user_id.toString();
        this.logger.log(`Overrode reference_id to user_id: ${userDetails.user_id} for personal document`);
    }

    const document = this.documentsRepository.create(createDocumentDto);
    const result = await this.documentsRepository.save(document);
    this.logger.log(`Document created successfully with ID: ${result.document_id}`);
    return result;
  }

  async findAll(user: any): Promise<Document[]> {
    this.logger.log(`Initiating to fetch all contextual documents for user: ${user.email}`);
    const userDetails = await this.userService.getUserWithBusiness(user.email);
    const userId = userDetails.user_id;

    // 1. Get user's teams
    const userTeams = await this.teamsService.findTeamsForUser(userId);
    const teamIds = userTeams.map(t => t.id);

    // 2. Get user's projects
    const userProjects = await this.projectsService.findProjectsByTeams(teamIds);
    const projectIds = userProjects.map(p => p.id);

    // 3. Build conditions
    const conditions: any[] = [
      { reference_type: 'personal', reference_id: userId.toString() },
      { reference_type: 'user', reference_id: userId.toString() },
    ];

    if (teamIds.length > 0) {
      conditions.push({ reference_type: 'team', reference_id: In(teamIds) });
    }

    if (projectIds.length > 0) {
      conditions.push({ reference_type: 'project', reference_id: In(projectIds) });
    }

    // Include 'client' and 'other' globally for now
    conditions.push({ reference_type: 'client' });
    conditions.push({ reference_type: 'other' });

    this.logger.log(`Fetching documents matching dynamically built conditions`);
    const results = await this.documentsRepository.find({
      where: conditions,
      order: { created_at: 'DESC' }
    });
    this.logger.log(`Successfully fetched ${results.length} documents`);
    return results;
  }

  async findOne(id: number): Promise<Document> {
    this.logger.log(`Initiating lookup for document ID: ${id}`);
    const document = await this.documentsRepository.findOne({ where: { document_id: id } });
    if (!document) {
      this.logger.warn(`Document with ID ${id} not found`);
      throw new NotFoundException(`Document with ID ${id} not found`);
    }
    this.logger.log(`Document found: ${document.name}`);
    return document;
  }

  async update(id: number, updateDocumentDto: UpdateDocumentDto): Promise<Document> {
    this.logger.log(`Initiating update for document ID: ${id}`);
    const document = await this.documentsRepository.findOne({ where: { document_id: id } });
    if (!document) {
      this.logger.warn(`Document with ID ${id} not found`);
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    // If the name is being updated, we also rename the file in MinIO
    if (updateDocumentDto.name && updateDocumentDto.name !== document.name) {
      this.logger.log(`Renaming file in MinIO from ${document.name} to ${updateDocumentDto.name}`);
      const newFilePath = await this.minioService.renameFile(document.file_path, updateDocumentDto.name);
      document.file_path = newFilePath;
      document.name = updateDocumentDto.name;
    }

    if (updateDocumentDto.label !== undefined) {
      document.label = updateDocumentDto.label;
    }

    const result = await this.documentsRepository.save(document);
    this.logger.log(`Document updated successfully: ${id}`);
    return result;
  }

  async remove(id: number): Promise<void> {
    this.logger.log(`Initiating deletion for document ID: ${id}`);
    const document = await this.documentsRepository.findOne({ where: { document_id: id } });
    if (!document) {
      this.logger.warn(`Document with ID ${id} not found`);
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    // Delete from MinIO first
    this.logger.log(`Deleting file from MinIO: ${document.file_path}`);
    await this.minioService.deleteFile(document.file_path);

    // Then delete from DB
    this.logger.log(`Deleting document record from database: ${id}`);
    await this.documentsRepository.remove(document);
    this.logger.log(`Document deleted successfully: ${id}`);
  }
}
