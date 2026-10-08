import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EjsAdapter } from '@nestjs-modules/mailer/dist/adapters/ejs.adapter';
import { join } from 'path';
import { existsSync } from 'fs';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const devPath = join(__dirname, 'templates');
        const prodPath = join(__dirname, '../../mailer/templates');
        const templateDir = existsSync(devPath) ? devPath : prodPath;

        return {
          transport: {
            host: configService.get('MAILER_HOST'),
            port: configService.get('MAILER_PORT'),
            secure: false,
            auth: {
              user: configService.get('MAILER_USERNAME'),
              pass: configService.get('MAILER_PASSWORD'),
            },
          },
          defaults: {
            from: configService.get('MAIL_SENDER'),
          },
          template: {
            dir: templateDir, // Path to your templates folder
            adapter: new EjsAdapter(), // Template engine adapter
            options: {
              strict: false,
            },
          },
        };
      },
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
