import { IsString, IsNumber, Matches, IsNotEmpty, IsOptional, MinLength, MaxLength } from "class-validator";
  
export class CreateTeamDto {
    @IsNotEmpty({ message: 'Team name is required' })
    @IsString({message: "Name must be string!"})
    @Matches(/^[A-Za-z\s]+$/, {
        message: 'Name can only contain letters and spaces',
      })
    name: string;

    @IsOptional() 
    @IsString({ message: 'Description must be a string' })
    @MinLength(5, { message: 'Description is too short (min: 5 characters)' })
    @MaxLength(255, { message: 'Description is too long (max: 255 characters)' })
    description: string;
    
    @IsNotEmpty({ message: 'Leader ID is required' })
    @IsNumber({}, { message: 'Leader ID must be a number' })
    leader_id: number;

    members: number[];
}
