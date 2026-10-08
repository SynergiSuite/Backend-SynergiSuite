import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class MinIO {
  private readonly logger = new Logger(MinIO.name);

  constructor(@Inject('S3_CLIENT') private readonly s3: S3Client) {}

  onModuleInit() {
    const publicEndpoint =
      process.env.AWS_S3_PUBLIC_ENDPOINT || process.env.AWS_S3_ENDPOINT;
    if (
      publicEndpoint?.includes('localhost') ||
      publicEndpoint?.includes('minio:9000')
    ) {
      this.logger.warn(
        `Presigned URLs are using a private endpoint (${publicEndpoint}). External users will not be able to upload or view files.`,
      );
    }
  }

  private createPresignClient() {
    return new S3Client({
      region: process.env.AWS_REGION,
      endpoint:
        process.env.AWS_S3_PUBLIC_ENDPOINT || process.env.AWS_S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }

  async ensureBucket(bucket: string = process.env.S3_BUCKET_NAME) {
    await this.ensureBucketExists(bucket);
  }

  private async ensureBucketExists(bucket: string) {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      this.logger.warn(`Bucket ${bucket} not found. Creating bucket...`);
      await this.s3.send(new CreateBucketCommand({ Bucket: bucket }));
      this.logger.log(`Bucket ${bucket} created successfully`);
    }
  }

  async generateUploadUrl(
    fileName: string,
    mimeType: string,
    bucket: string = process.env.S3_BUCKET_NAME,
  ) {
    this.logger.log(`Initiating generateUploadUrl for file: ${fileName}`);
    await this.ensureBucketExists(bucket);

    const prefix =
      bucket === 'synergi-chat-attachments'
        ? 'chat-attachments'
        : 'hr-documents';
    const key = `${prefix}/${Date.now()}-${fileName}`;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mimeType,
    });

    this.logger.log(`Fetching presigned upload URL from S3`);
    const url = await getSignedUrl(this.createPresignClient(), command, {
      expiresIn: 300,
    });
    this.logger.log(`Presigned upload URL successfully generated`);

    return { uploadUrl: url, filePath: key };
  }

  async uploadBuffer(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string = 'application/octet-stream',
  ) {
    this.logger.log(`Uploading object to bucket ${bucket}: ${key}`);
    await this.ensureBucketExists(bucket);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    this.logger.log(`Object uploaded successfully: ${key}`);
    return { bucket, key };
  }

  async generateViewUrl(
    filePath: string,
    bucket: string = process.env.S3_BUCKET_NAME,
    expiresIn: number = 300,
  ) {
    this.logger.log(`Initiating generateViewUrl for file path: ${filePath}`);
    await this.ensureBucketExists(bucket);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: filePath,
    });

    this.logger.log(`Fetching presigned view URL from S3`);
    const url = await getSignedUrl(this.createPresignClient(), command, {
      expiresIn,
    });
    this.logger.log(`Presigned view URL successfully generated`);

    return { viewUrl: url };
  }

  async deleteFile(
    filePath: string,
    bucket: string = process.env.S3_BUCKET_NAME,
  ) {
    this.logger.log(`Initiating deleteFile for file path: ${filePath}`);
    await this.ensureBucketExists(bucket);

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: filePath,
    });
    await this.s3.send(command);
    this.logger.log(`File successfully deleted from S3`);
  }

  async renameFile(
    oldFilePath: string,
    newFileName: string,
    bucket: string = process.env.S3_BUCKET_NAME,
  ) {
    this.logger.log(
      `Initiating renameFile for file path: ${oldFilePath} to ${newFileName}`,
    );
    await this.ensureBucketExists(bucket);

    // Extract the prefix part (e.g., 'hr-documents/16843232-')
    const lastDashIndex = oldFilePath.lastIndexOf('-');
    const prefix =
      bucket === 'synergi-chat-attachments'
        ? 'chat-attachments'
        : 'hr-documents';
    const newFilePath =
      lastDashIndex !== -1
        ? `${oldFilePath.substring(0, lastDashIndex + 1)}${newFileName}`
        : `${prefix}/${Date.now()}-${newFileName}`;

    // Copy to new location
    this.logger.log(`Copying file to new location: ${newFilePath}`);
    const copyCommand = new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${oldFilePath}`,
      Key: newFilePath,
    });
    await this.s3.send(copyCommand);

    // Delete old file
    this.logger.log(`Deleting old file: ${oldFilePath}`);
    await this.deleteFile(oldFilePath, bucket);

    this.logger.log(`File successfully renamed in S3`);
    return newFilePath;
  }
}
