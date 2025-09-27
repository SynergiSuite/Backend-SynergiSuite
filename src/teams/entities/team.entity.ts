import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { TeamMember } from './team_members.entity';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { Business } from 'src/business/entities/business.entity';

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

  @ManyToOne(() => Business, (business) => business.teams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => User, (user) => user.leads, { eager: true })
  @JoinColumn({ name: 'leader_id' })
  leader: User;

  @OneToMany(() => TeamMember, (member) => member.team, { cascade: true })
  members: TeamMember[];
}
