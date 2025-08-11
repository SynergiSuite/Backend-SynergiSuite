import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins (you might want to restrict this in production)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });
  
  await app.listen(3002);
}
bootstrap();
