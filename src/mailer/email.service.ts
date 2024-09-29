import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailDto } from "./dto/email.dto";
import { MailerService } from "@nestjs-modules/mailer";

@Injectable()
export class EmailService {
    constructor(
        private readonly configService: ConfigService,
        private readonly mailerService: MailerService
    ) {}

    async sendVerificationEmail(emailDto: EmailDto) {
        const to = emailDto.email
        const subject = emailDto.subject
        const text = emailDto.text
       try {
        const mailer = await this.mailerService.sendMail(
            {
                to,
                subject,
                text
            }
        )
        return true
       } 
       catch (error) {
        return false
       }
    }
}