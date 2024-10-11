
export class EmailDto {
    sender?: string
    // recipients?: Address[]
    to: string
    subject: string
    text: string
}