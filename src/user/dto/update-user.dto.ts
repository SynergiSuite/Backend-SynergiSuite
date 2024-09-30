import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    new_email?: string
    old_password?: string
    new_password?: string
    code?: number
}
