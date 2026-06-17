import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as ngrok from '@ngrok/ngrok';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = Number(process.env.PORT) || 3002;
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  
  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins (you might want to restrict this in production)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
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
  logger.log(`Application is running on: http://localhost:${port} at ${startTime}`);

  if (process.env.NGROK_AUTHTOKEN) {
    try {
      const listener = await ngrok.forward({
        addr: port,
        authtoken: process.env.NGROK_AUTHTOKEN,
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
