// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { Logger } from '@nestjs/common';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule, {
//     logger: ['log', 'error', 'warn', 'debug', 'verbose'],
//   });
  
//   // Enable CORS
//   app.enableCors({
//     origin: true, // Allow all origins (you might want to restrict this in production)
//     methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
//   });
  
//   const startTime = Date.now();
//   const logger = new Logger('Bootstrap');
//   logger.log(`Application is running on: http://localhost:3002 at ${startTime}`);
//   await app.listen(3002);
// }
// bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverless from 'serverless-http';
import express from 'express';

const expressApp = express();
let cachedServer: any;

async function bootstrapServer() {
  if (!cachedServer) {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      {
        logger: ['log', 'error', 'warn', 'debug', 'verbose'],
      }
    );

    // Enable CORS
    app.enableCors({
      origin: true, // Allow all origins (you might want to restrict this in production)
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    });
    
    await app.init();
    cachedServer = serverless(expressApp);
  }
  return cachedServer;
}

export default async function handler(req: any, res: any) {
  const server = await bootstrapServer();
  return server(req, res);
}

