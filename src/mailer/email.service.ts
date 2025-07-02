import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailDto } from './dto/email.dto';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  constructor(
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
  ) {}

  async sendVerificationEmail(obj: EmailDto) {
    const to = obj.to;
    const subject = obj.subject;
    const text = obj.text;
    const name = obj.name;
    const heading = obj.heading;
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        template: 'email',
        context: {
          name,
          heading,
          text,
        },
      });
      return true;
    } catch (error) {
      console.log(error.message);
      return false;
    }
  }

  async sendInvitationEmail(obj: EmailDto) {
    const to = obj.to;
    const subject = obj.subject;
    const text = obj.text;
    const name = obj.name;
    const heading = obj.heading;
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        template: 'email',
        context: {
          name,
          heading,
          text,
        },
      });
      return true;
    } catch (error) {
      console.log(error.message);
      return false;
    }
  }
}
