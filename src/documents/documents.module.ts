import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { Document } from './entities/document.entity';
import { UserModule } from 'src/user/user.module';
import { MinIOModule } from 'src/minIO/minIO.module';
import { TeamsModule } from 'src/teams/teams.module';
import { ProjectsModule } from 'src/projects/projects.module';
import { forwardRef } from '@nestjs/common';
import { DocumentAccessGuard, DocumentDeleteGuard } from './document.guard';
import { ActivityModule } from 'src/activity/activity.module';
import { DocumentsHelper } from './documents.helper';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    UserModule,
    forwardRef(() => MinIOModule),
    forwardRef(() => TeamsModule),
    forwardRef(() => ProjectsModule),
    ActivityModule,
  ],
  providers: [
    DocumentsService,
    DocumentsHelper,
    DocumentAccessGuard,
    DocumentDeleteGuard,
  ],
  controllers: [DocumentsController],
  exports: [
    DocumentsService,
    DocumentsHelper,
    DocumentAccessGuard,
    DocumentDeleteGuard,
  ],
})
export class DocumentsModule {}
