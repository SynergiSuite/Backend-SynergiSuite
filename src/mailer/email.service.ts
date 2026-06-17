import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailDto } from './dto/email.dto';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

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
        template: 'verification_email',
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

  async sendInvitationEmail(obj: EmailDto, token: string) {
    const to = obj.to;
    const subject = obj.subject;
    const invited_by = obj.invited_by;
    const invited_bys_role = obj.invited_bys_role;
    const business = obj.business;
    const text = token;
    const name = obj.name;
    const heading = obj.heading;
    this.logger.log(
      `[InviteUser] Mailer started | to=${to} | subject=${subject} | invitedBy=${invited_by} | business=${business} | tokenLength=${token.length}`,
    );
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        template: 'invitation_email',
        context: {
          name,
          heading,
          text,
          invited_by,
          invited_bys_role,
          business
        },
      });
      this.logger.log(`[InviteUser] Mailer completed | to=${to}`);
      return true;
    } catch (error) {
      this.logger.error(
        `[InviteUser] Mailer failed | to=${to} | subject=${subject} | error=${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
