import { Module } from "@nestjs/common";
import { S3Client } from '@aws-sdk/client-s3';
import { MinIO } from "./minIO.service";
import { ResourceController } from "./minIO.controller";
import { forwardRef } from "@nestjs/common";
import { DocumentsModule } from "src/documents/documents.module";
import { UserModule } from "src/user/user.module";
import { TeamsModule } from "src/teams/teams.module";
import { ProjectsModule } from "src/projects/projects.module";

@Module({
    providers: [
        {
            provide: 'S3_CLIENT',
            useValue: new S3Client({
                region: process.env.AWS_REGION,
                endpoint: process.env.AWS_S3_ENDPOINT,
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                },
                forcePathStyle: true,
            })
        },
        MinIO
    ],
    controllers: [ResourceController],
    exports: [MinIO],
    imports: [
        forwardRef(() => DocumentsModule),
        forwardRef(() => UserModule),
        forwardRef(() => TeamsModule),
        forwardRef(() => ProjectsModule)
    ],
})
export class MinIOModule { }