import {
    Entity,
    PrimaryGeneratedColumn,
    ManyToOne,
  } from 'typeorm';
  import { User } from 'src/user/entities/user.entity';
  import { Team } from 'src/teams/entities/team.entity';
  
  @Entity({ name: 'team_members' })
  export class TeamMember {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @ManyToOne(() => User, (user) => user.teamMemberships, { eager: true })
    user: User;
  
    @ManyToOne(() => Team, (team) => team.members)
    team: Team;
  }
  