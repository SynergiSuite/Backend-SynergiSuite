import { ArrayNotEmpty, IsArray, IsNumber, IsString } from 'class-validator';

export class AddMemberDto {
  @IsArray({ message: 'Members must be an array' })
  @ArrayNotEmpty({ message: 'Members cannot be empty' })
  @IsNumber({}, { each: true, message: 'Each member must be a number' })
  members: number[];

  @IsString({ message: 'group id must be string' })
  groupId: string;
}
