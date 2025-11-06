import { PartialType } from '@nestjs/mapped-types';
import { CreateTeamDto } from './create-team.dto';
export class UpdateTeamDto extends PartialType(CreateTeamDto) {
    id: string;
    name: string;
    description: string;
    members: number[];
    leader_id: number;
}
