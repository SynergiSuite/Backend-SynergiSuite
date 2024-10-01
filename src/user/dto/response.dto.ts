import { HttpStatus } from "@nestjs/common"
import { User } from "../entities/user.entity"

export class VerificationResponseDto {
    name?: string
    email?: string
    message?: string
    isVerified?: boolean
    user?: User
    error?: string
    status?: HttpStatus
    access_token?: string
}