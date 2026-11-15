import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Team } from '../../teams/entities/team.entity';
import { Project } from '../../projects/entities/project.entity';
import { GroupMember } from './group-member.entity';
import { Message } from './message.entity';

export enum GroupType {
  TEAM = 'team',
  PROJECT = 'project',
  CUSTOM = 'custom',
  DIRECT = 'direct',
}

@Entity({ name: 'groups' })
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'enum', enum: GroupType })
  type: GroupType;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @OneToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teamId' })
  team: Team;

  @Column({ nullable: true })
  teamId: string;

  @OneToOne(() => Project, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ nullable: true })
  projectId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ nullable: true })
  createdById: number;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany(() => GroupMember, (member) => member.group, { cascade: true })
  members: GroupMember[];

  @OneToMany(() => Message, (message) => message.group)
  messages: Message[];
}
