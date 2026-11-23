import { S3ClientConfig } from '@aws-sdk/client-s3';

export function getS3ClientConfig(): S3ClientConfig {
  const endpoint =
    process.env.AWS_S3_ENDPOINT ||
    process.env.MINIO_ENDPOINT ||
    process.env.AWS_S3_PUBLIC_ENDPOINT;
  const accessKeyId =
    process.env.AWS_ACCESS_KEY_ID || process.env.MINIO_ACCESS_KEY;
  const secretAccessKey =
    process.env.AWS_SECRET_ACCESS_KEY || process.env.MINIO_SECRET_KEY;

  return {
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint,
    credentials:
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
          }
        : undefined,
    forcePathStyle: true,
  };
}

export function getS3PublicClientConfig(): S3ClientConfig {
  return {
    ...getS3ClientConfig(),
    endpoint:
      process.env.AWS_S3_PUBLIC_ENDPOINT ||
      process.env.MINIO_ENDPOINT ||
      process.env.AWS_S3_ENDPOINT,
  };
}
