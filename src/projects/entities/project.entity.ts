import { IsInt, IsString, MaxLength, MinLength, IsOptional } from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Business } from 'src/business/entities/business.entity';
import { Team } from 'src/teams/entities/team.entity';
import { Task } from './task.entity';
import { Client } from 'src/clients/entities/client.entity';
import { Milestone } from 'src/milestone/entities/milestone.entity';

@Entity({ name: 'projects' })
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  @IsString()
  @MinLength(3, { message: 'Name should be at least 3 letters long.' })
  @MaxLength(50, { message: 'Name can not exceed 50 characters' })
  name: string;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Column({ type: 'int', nullable: false, default: 0 })
  @IsInt()
  status: number

  @Column({ type: 'text', nullable: false, default: 'N/A' })
  @IsString()
  duration: string
  
  // Timestamps (matching your general style)
  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;


  @ManyToOne(() => Business, (business) => business.projects)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @OneToMany(() => Task, (task) => task.project, { cascade: true })
  tasks: Task[];

  @OneToMany(() => Milestone, (milestone) => milestone.project, { cascade: true })
  milestones: Milestone[];


  @ManyToMany(() => Team, (team) => team.projects)
  @JoinTable({
    name: 'project_teams',
    joinColumn: { name: 'project_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'team_id', referencedColumnName: 'id' },
  })
  teams: Team[];

  @ManyToOne(() => Client, (client) => client.projects, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client: Client;
}
