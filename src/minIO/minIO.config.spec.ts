import { getS3ClientConfig, getS3PublicClientConfig } from './minIO.config';

describe('MinIO configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_S3_ENDPOINT;
    delete process.env.AWS_S3_PUBLIC_ENDPOINT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses MINIO variables for an external S3-compatible service', () => {
    process.env.MINIO_ENDPOINT = 'https://object-vault.example.com';
    process.env.MINIO_ACCESS_KEY = 'access-key';
    process.env.MINIO_SECRET_KEY = 'secret-key';

    expect(getS3ClientConfig()).toMatchObject({
      endpoint: 'https://object-vault.example.com',
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'access-key',
        secretAccessKey: 'secret-key',
      },
      forcePathStyle: true,
    });
  });

  it('prefers the public endpoint for presigned URLs', () => {
    process.env.MINIO_ENDPOINT = 'http://minio:9000';
    process.env.AWS_S3_PUBLIC_ENDPOINT = 'https://objects.example.com';

    expect(getS3PublicClientConfig().endpoint).toBe(
      'https://objects.example.com',
    );
  });
});
