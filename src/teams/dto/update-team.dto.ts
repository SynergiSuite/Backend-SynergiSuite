import { PartialType } from '@nestjs/mapped-types';
import { CreateTeamDto } from './create-team.dto';

export class UpdateTeamDto extends PartialType(CreateTeamDto) {}

export class UpdateTeamNameDto extends PartialType(CreateTeamDto) {
    name: string;
    id: string;
}

export class AddMembersDto {
    team_id: string;
    members: number[];
}

export class RemoveMembersDto {
    team_id: string;
    members: number[];
}
