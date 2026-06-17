import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsString,
} from 'class-validator';

export class UpdateTeamDto {
  @IsString({ message: 'Project ID must be a string' })
  project_id: string;

  @IsArray({ message: 'Teams must be an array of team IDs' })
  @ArrayNotEmpty({ message: 'At least one team must be provided' })
  @ArrayUnique({ message: 'Team IDs must be unique' })
  @IsString({ each: true, message: 'Each team ID must be a string' })
  team_id: string[];
}
