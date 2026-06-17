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

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]), 
    UserModule, 
    TeamsModule,
    ProjectsModule,
    forwardRef(() => MinIOModule)
  ],
  providers: [DocumentsService, DocumentAccessGuard, DocumentDeleteGuard],
  controllers: [DocumentsController],
  exports: [DocumentsService, DocumentAccessGuard, DocumentDeleteGuard]
})
export class DocumentsModule { }
