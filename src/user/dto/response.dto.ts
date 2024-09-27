import { User } from "../entities/user.entity"

export class VerificationResponseDto {
    message: string
    isVerified: boolean
    user: User
}