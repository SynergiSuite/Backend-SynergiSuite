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
import { IsString, IsEmail, MaxLength, MinLength, IsOptional, IsInt } from 'class-validator';
import { Business } from '../../business/entities/business.entity';
import { Project } from '../../projects/entities/project.entity';

@Entity({ name: 'clients' })
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  @IsString({ message: 'Client name must be a string' })
  @MinLength(3, { message: 'Name must be at least 3 characters long' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name: string;

  @Column({ nullable: true })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @Column({ nullable: true })
  @IsString({ message: 'Phone must be a string' })
  @MaxLength(20)
  phone: string;

  @Column({ nullable: true })
  @IsString({ message: 'Address must be a string' })
  address: string;

  @Column({ nullable: true })
  @IsString({ message: 'Company must be a string' })
  company: string;

  @Column()
  @IsInt()
  priority: number;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  // One business can have many clients
  @ManyToOne(() => Business, (business) => business.clients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  // One client can have many projects
  @OneToMany(() => Project, (project) => project.client, { cascade: true })
  projects: Project[];
}
