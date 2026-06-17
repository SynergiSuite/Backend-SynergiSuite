import { Injectable, CanActivate, ExecutionContext, NotFoundException, UnauthorizedException, Logger, ForbiddenException } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { DocumentsService } from './documents.service';
import { TeamsService } from 'src/teams/teams.service';
import { ProjectsService } from 'src/projects/projects.service';

@Injectable()
export class DocumentAccessGuard implements CanActivate {
    private readonly logger = new Logger(DocumentAccessGuard.name);

    constructor(
        private readonly userService: UserService,
        private readonly documentsService: DocumentsService,
        private readonly teamsService: TeamsService,
        private readonly projectsService: ProjectsService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        this.logger.log(`Checking document access eligibility...`);
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const documentId = parseInt(request.params.id, 10);

        if (!documentId || isNaN(documentId)) {
            throw new NotFoundException('Invalid document ID');
        }

        this.logger.log(`Fetching document ID ${documentId}`);
        const document = await this.documentsService.findOne(documentId);
        
        // Attach document to request so controller can use it
        request.document = document;

        this.logger.log(`Getting user business context for ${user.email}`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        const businessId = userDetails.business.business_id;

        const refType = document.reference_type;
        const refId = document.reference_id;

        this.logger.log(`Document reference: ${refType} - ${refId}`);

        if (refType === 'team') {
            const teamValid = await this.teamsService.findValidTeam(refId, businessId);
            if (!teamValid) {
                this.logger.error(`User business ${businessId} does not have access to team ${refId}`);
                throw new ForbiddenException('You do not have access to this document');
            }
        } else if (refType === 'project') {
            const project = await this.projectsService.findProjectsById(refId);
            if (!project || project.business.business_id !== businessId) {
                this.logger.error(`User business ${businessId} does not have access to project ${refId}`);
                throw new ForbiddenException('You do not have access to this document');
            }
        } else if (refType === 'client' || refType === 'personal' || refType === 'other') {
            // Note: Since Document entity does not store business_id or user_id natively,
            // and frontend uses "client"/"personal" as reference_id, we currently just
            // allow access if they are authenticated and verified. 
            // In the future, Document should have a relation to Business or User.
            this.logger.log(`Allowing access to ${refType} document for verified user.`);
        } else {
            throw new ForbiddenException('Unknown reference type');
        }

        this.logger.log(`Access granted!`);
        return true;
    }
}

@Injectable()
export class DocumentDeleteGuard implements CanActivate {
    private readonly logger = new Logger(DocumentDeleteGuard.name);

    constructor(
        private readonly userService: UserService,
        private readonly documentsService: DocumentsService,
        private readonly teamsService: TeamsService,
        private readonly projectsService: ProjectsService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        this.logger.log(`Checking document DELETE eligibility...`);
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const documentId = parseInt(request.params.id, 10);

        if (!documentId || isNaN(documentId)) {
            throw new NotFoundException('Invalid document ID');
        }

        const document = await this.documentsService.findOne(documentId);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        
        const refType = document.reference_type;
        const refId = document.reference_id;
        const roleName = userDetails.role?.name?.toLowerCase();

        this.logger.log(`Delete attempt by user ${userDetails.user_id} (${roleName}) on ${refType} document.`);

        if (refType === 'personal' || refType === 'user') {
            if (refId !== userDetails.user_id.toString()) {
                throw new ForbiddenException('You can only delete your own personal documents.');
            }
        } 
        else if (refType === 'team') {
            const team = await this.teamsService.findOne(refId);
            if (!team || team.leader?.user_id !== userDetails.user_id) {
                throw new ForbiddenException('Only the team leader can delete team documents.');
            }
        } 
        else if (refType === 'project') {
            const project = await this.projectsService.findProjectsById(refId);
            if (!project || project.business.business_id !== userDetails.business.business_id) {
                throw new ForbiddenException('Project does not belong to your business.');
            }
            if (roleName !== 'manager' && roleName !== 'founder') {
                throw new ForbiddenException('Only manager and founder can delete project documents.');
            }
        } 
        else if (refType === 'client') {
            if (roleName !== 'client' && roleName !== 'manager' && roleName !== 'founder') {
                throw new ForbiddenException('Only client, manager, and founder can delete client documents.');
            }
        } 
        else if (refType === 'other') {
            if (roleName !== 'manager' && roleName !== 'founder') {
                throw new ForbiddenException('Only manager and founder can delete "other" documents.');
            }
        } 
        else {
            throw new ForbiddenException('Unknown document reference type.');
        }

        this.logger.log(`Delete access granted!`);
        return true;
    }
}
