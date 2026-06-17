import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { Project } from 'src/projects/entities/project.entity';
import { Task } from 'src/projects/entities/task.entity';

@Entity({ name: 'milestones' })
export class Milestone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  @IsString()
  @MinLength(3, { message: 'Name should be at least 3 letters long.' })
  @MaxLength(100, { message: 'Name can not exceed 100 characters' })
  name: string;

  @Column({ type: 'text', nullable: false })
  @IsString()
  end_date: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @ManyToOne(() => Project, (project) => project.milestones, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @OneToMany(() => Task, (task) => task.milestone)
  tasks: Task[];
}
