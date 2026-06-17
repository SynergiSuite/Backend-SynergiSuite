import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsNotEmpty, IsNumber, Max, Min } from 'class-validator';

export class InviteDto {
    @IsEmail({}, { message: 'Invalid invited user email format' })
    @IsNotEmpty({ message: 'Invited user email is required' })
    email: string;

    @IsNumber()
    @Min(0)
    @Max(1000000)
    salary: number;

    @Type(() => Number)
    @IsInt({ message: 'Role ID must be a number' })
    @IsNotEmpty({ message: 'Role ID is required' })
    role_id: number;
}
