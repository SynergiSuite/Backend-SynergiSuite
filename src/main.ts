import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as ngrok from '@ngrok/ngrok';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = Number(process.env.PORT) || 3002;

  if (
    (process.env.MINIO_NGROK_AUTHTOKEN || process.env.NGROK_AUTHTOKEN) &&
    process.env.MINIO_NGROK_ENABLED === 'true'
  ) {
    try {
      const minioNgrokOptions: Parameters<typeof ngrok.forward>[0] = {
        addr: process.env.AWS_S3_ENDPOINT || 'http://minio:9000',
        authtoken:
          process.env.MINIO_NGROK_AUTHTOKEN || process.env.NGROK_AUTHTOKEN,
      };

      if (process.env.MINIO_NGROK_DOMAIN) {
        minioNgrokOptions.domain = process.env.MINIO_NGROK_DOMAIN;
      }

      const minioListener = await ngrok.forward({
        ...minioNgrokOptions,
      });
      process.env.AWS_S3_PUBLIC_ENDPOINT = minioListener.url();
      process.env.MINIO_ENDPOINT = minioListener.url();
      logger.log(`MinIO ngrok tunnel started: ${minioListener.url()}`);
    } catch (error) {
      logger.error(`Failed to start MinIO ngrok tunnel: ${error.message}`);
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    rawBody: true,
  });
  app.useBodyParser('json', {
    type: ['application/json', 'application/webhook+json'],
  });

  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins (you might want to restrict this in production)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'ngrok-skip-browser-warning',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const startTime = Date.now();
  await app.listen(port);
  logger.log(
    `Application is running on: http://localhost:${port} at ${startTime}`,
  );

  if (process.env.NGROK_AUTHTOKEN) {
    try {
      const ngrokOptions: Parameters<typeof ngrok.forward>[0] = {
        addr: port,
        authtoken: process.env.NGROK_AUTHTOKEN,
      };

      if (process.env.NGROK_DOMAIN) {
        ngrokOptions.domain = process.env.NGROK_DOMAIN;
      }

      const listener = await ngrok.forward({
        ...ngrokOptions,
      });
      logger.log(`ngrok tunnel started: ${listener.url()}`);
    } catch (error) {
      logger.error(`Failed to start ngrok tunnel: ${error.message}`);
    }
  } else {
    logger.warn('NGROK_AUTHTOKEN not set. Skipping ngrok tunnel startup.');
  }
}

bootstrap();
