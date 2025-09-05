import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  
  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins (you might want to restrict this in production)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });
  
  const startTime = Date.now();
  const logger = new Logger('Bootstrap');
  logger.log(`Application is running on: http://localhost:3002 at ${startTime}`);
  await app.listen(3002);
}
bootstrap();
