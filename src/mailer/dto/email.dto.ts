import { Address } from "@nestjs-modules/mailer/dist/interfaces/send-mail-options.interface";

export class EmailDto {
    sender?: string
    // recipients?: Address[]
    email: string
    subject: string
    text: string
}