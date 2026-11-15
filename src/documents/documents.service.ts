import { Injectable, Logger } from '@nestjs/common';
import { Document } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { MinIO } from 'src/minIO/minIO.service';
import { TeamsService } from 'src/teams/teams.service';
import { ProjectsService } from 'src/projects/projects.service';
import { ActivityService } from 'src/activity/activity.service';
import { ActivityAction } from 'src/activity/entities/activity-log.entity';
import { DocumentsHelper } from './documents.helper';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly minioService: MinIO,
    private readonly teamsService: TeamsService,
    private readonly projectsService: ProjectsService,
    private readonly activityService: ActivityService,
    private readonly documentsHelper: DocumentsHelper,
  ) {}

  async create(
    user: any,
    createDocumentDto: CreateDocumentDto,
  ): Promise<Document> {
    this.logger.log(`Initiating document creation for user: ${user.email}`);
    const userDetails = await this.documentsHelper.getUserWithBusiness(
      user.email,
    );

    if (
      createDocumentDto.reference_type === 'personal' ||
      createDocumentDto.reference_type === 'user'
    ) {
      createDocumentDto.reference_id = userDetails.user_id.toString();
      this.logger.log(
        `Overrode reference_id to user_id: ${userDetails.user_id} for personal document`,
      );
    }

    const result = await this.documentsHelper.createDocument(createDocumentDto);
    this.logger.log(
      `Document created successfully with ID: ${result.document_id}`,
    );
    await this.activityService.log({
      action: ActivityAction.CREATED,
      module: 'documents',
      entityType: 'Document',
      entityId: result.document_id,
      entityName: result.name,
      actor: userDetails,
      businessId: userDetails.business?.business_id,
      after: {
        document_id: result.document_id,
        name: result.name,
        label: result.label,
        reference_type: result.reference_type,
        reference_id: result.reference_id,
      },
    });
    return result;
  }

  async findAll(user: any): Promise<Document[]> {
    this.logger.log(
      `Initiating to fetch all contextual documents for user: ${user.email}`,
    );
    const userDetails = await this.documentsHelper.getUserWithBusiness(
      user.email,
    );
    const userId = userDetails.user_id;

    const userTeams = await this.teamsService.findTeamsForUser(userId);
    const teamIds = userTeams.map((team) => team.id);

    const userProjects =
      await this.projectsService.findProjectsByTeams(teamIds);
    const projectIds = userProjects.map((project) => project.id);

    this.logger.log(`Fetching documents matching dynamically built conditions`);
    const results = await this.documentsHelper.findContextualDocuments(
      userId,
      teamIds,
      projectIds,
    );
    this.logger.log(`Successfully fetched ${results.length} documents`);
    return results;
  }

  async findOne(id: number): Promise<Document> {
    this.logger.log(`Initiating lookup for document ID: ${id}`);
    const document = await this.documentsHelper.findDocumentById(id);
    this.logger.log(`Document found: ${document.name}`);
    return document;
  }

  async update(
    user: any,
    id: number,
    updateDocumentDto: UpdateDocumentDto,
  ): Promise<Document> {
    this.logger.log(`Initiating update for document ID: ${id}`);
    const userDetails = await this.documentsHelper.getUserWithBusiness(
      user.email,
    );
    const document = await this.documentsHelper.findDocumentById(id);

    const before = {
      name: document.name,
      label: document.label,
    };

    // If the name is being updated, we also rename the file in MinIO
    if (updateDocumentDto.name && updateDocumentDto.name !== document.name) {
      this.logger.log(
        `Renaming file in MinIO from ${document.name} to ${updateDocumentDto.name}`,
      );
      const newFilePath = await this.minioService.renameFile(
        document.file_path,
        updateDocumentDto.name,
      );
      document.file_path = newFilePath;
      document.name = updateDocumentDto.name;
    }

    if (updateDocumentDto.label !== undefined) {
      document.label = updateDocumentDto.label;
    }

    const result = await this.documentsHelper.saveDocument(document);
    this.logger.log(`Document updated successfully: ${id}`);
    const after = {
      name: result.name,
      label: result.label,
    };

    await this.activityService.logFieldChanges(
      {
        action: ActivityAction.UPDATED,
        module: 'documents',
        entityType: 'Document',
        entityId: result.document_id,
        entityName: result.name,
        actor: userDetails,
        businessId: userDetails.business?.business_id,
      },
      before,
      after,
      ['name', 'label'],
    );
    return result;
  }

  async remove(user: any, id: number): Promise<void> {
    this.logger.log(`Initiating deletion for document ID: ${id}`);
    const userDetails = await this.documentsHelper.getUserWithBusiness(
      user.email,
    );
    const document = await this.documentsHelper.findDocumentById(id);

    const before = {
      document_id: document.document_id,
      name: document.name,
      label: document.label,
      reference_type: document.reference_type,
      reference_id: document.reference_id,
    };

    // Delete from MinIO first
    this.logger.log(`Deleting file from MinIO: ${document.file_path}`);
    await this.minioService.deleteFile(document.file_path);

    // Then delete from DB
    this.logger.log(`Deleting document record from database: ${id}`);
    await this.documentsHelper.removeDocument(document);
    this.logger.log(`Document deleted successfully: ${id}`);
    await this.activityService.log({
      action: ActivityAction.DELETED,
      module: 'documents',
      entityType: 'Document',
      entityId: document.document_id,
      entityName: document.name,
      actor: userDetails,
      businessId: userDetails.business?.business_id,
      before,
    });
  }
}
