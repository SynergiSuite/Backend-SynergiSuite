import { Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { MinIO } from './minIO.service';
import { ResourceController } from './minIO.controller';
import { forwardRef } from '@nestjs/common';
import { DocumentsModule } from 'src/documents/documents.module';
import { UserModule } from 'src/user/user.module';
import { TeamsModule } from 'src/teams/teams.module';
import { ProjectsModule } from 'src/projects/projects.module';
import { getS3ClientConfig } from './minIO.config';

@Module({
  providers: [
    {
      provide: 'S3_CLIENT',
      useFactory: () => new S3Client(getS3ClientConfig()),
    },
    MinIO,
  ],
  controllers: [ResourceController],
  exports: [MinIO],
  imports: [
    forwardRef(() => DocumentsModule),
    forwardRef(() => UserModule),
    forwardRef(() => TeamsModule),
    forwardRef(() => ProjectsModule),
  ],
})
export class MinIOModule {}
