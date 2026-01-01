import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { TeamMember } from './team_members.entity';
import { IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { Business } from 'src/business/entities/business.entity';
import { Project } from 'src/projects/entities/project.entity';

@Entity()
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @IsString({ message: 'Name must be a string' })
  @MinLength(3, { message: 'Name is too short (min: 3 characters)' })
  @MaxLength(50, { message: 'Name is too long (max: 50 characters)' })
  @Matches(/^[A-Za-z\s]+$/, {
    message: 'Name can only contain letters and spaces',
  })
  name: string;

  @Column({ nullable: true })
  @IsOptional() 
  @IsString({ message: 'Description must be a string' })
  @MinLength(10, { message: 'Description is too short (min: 10 characters)' })
  @MaxLength(255, { message: 'Description is too long (max: 255 characters)' })
  description: string;

  @ManyToOne(() => Business, (business) => business.teams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => User, (user) => user.leads, { eager: true })
  @JoinColumn({ name: 'leader_id' })
  leader: User;

  @OneToMany(() => TeamMember, (member) => member.team, { cascade: true })
  members: TeamMember[];

  @ManyToMany(() => Project, (project) => project.teams)
  projects: Project[];
}
