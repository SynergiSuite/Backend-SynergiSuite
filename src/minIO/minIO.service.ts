import { Injectable, Inject, Logger } from "@nestjs/common";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Injectable()
export class MinIO {
    private readonly logger = new Logger(MinIO.name);
    private readonly presignClient = new S3Client({
        region: process.env.AWS_REGION,
        endpoint: process.env.NODE_ENV === 'development' ? 'http://localhost:9000' : process.env.AWS_S3_ENDPOINT,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
    });

    constructor(@Inject('S3_CLIENT') private readonly s3: S3Client) { }

    async generateUploadUrl(fileName: string, mimeType: string) {
        this.logger.log(`Initiating generateUploadUrl for file: ${fileName}`);
        const key = `hr-documents/${Date.now()}-${fileName}`;
        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            ContentType: mimeType,
        });

        this.logger.log(`Fetching presigned upload URL from S3`);
        const url = await getSignedUrl(this.presignClient, command, { expiresIn: 300 });
        this.logger.log(`Presigned upload URL successfully generated`);

        return { uploadUrl: url, filePath: key };
    }

    async generateViewUrl(filePath: string) {
        this.logger.log(`Initiating generateViewUrl for file path: ${filePath}`);
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: filePath,
        });

        this.logger.log(`Fetching presigned view URL from S3`);
        const url = await getSignedUrl(this.presignClient, command, { expiresIn: 300 });
        this.logger.log(`Presigned view URL successfully generated`);

        return { viewUrl: url };
    }

    async deleteFile(filePath: string) {
        this.logger.log(`Initiating deleteFile for file path: ${filePath}`);
        const command = new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: filePath,
        });
        await this.s3.send(command);
        this.logger.log(`File successfully deleted from S3`);
    }

    async renameFile(oldFilePath: string, newFileName: string) {
        this.logger.log(`Initiating renameFile for file path: ${oldFilePath} to ${newFileName}`);
        // Extract the prefix part (e.g., 'hr-documents/16843232-')
        const lastDashIndex = oldFilePath.lastIndexOf('-');
        const newFilePath = lastDashIndex !== -1 
            ? `${oldFilePath.substring(0, lastDashIndex + 1)}${newFileName}`
            : `hr-documents/${Date.now()}-${newFileName}`;
        
        // Copy to new location
        this.logger.log(`Copying file to new location: ${newFilePath}`);
        const copyCommand = new CopyObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            CopySource: `${process.env.S3_BUCKET_NAME}/${oldFilePath}`,
            Key: newFilePath,
        });
        await this.s3.send(copyCommand);

        // Delete old file
        this.logger.log(`Deleting old file: ${oldFilePath}`);
        await this.deleteFile(oldFilePath);
        
        this.logger.log(`File successfully renamed in S3`);
        return newFilePath;
    }
}
