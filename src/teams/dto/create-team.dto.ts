import { IsString, IsNumber, Matches, IsNotEmpty } from "class-validator";
  
export class CreateTeamDto {
    @IsNotEmpty({ message: 'Team name is required' })
    @IsString({message: "Name must be string!"})
    @Matches(/^[A-Za-z\s]+$/, {
        message: 'Name can only contain letters and spaces',
      })
    name: string;
    
    @IsNotEmpty({ message: 'Leader ID is required' })
    @IsNumber({}, { message: 'Leader ID must be a number' })
    leader_id: number;

    members: number[];
}
