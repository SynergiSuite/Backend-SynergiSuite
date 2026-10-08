import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { User } from '../../user/entities/user.entity';
import { Business } from '../../business/entities/business.entity';
import { PrimaryRole } from './primary-role.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  @IsInt()
  id: number;

  @Column()
  @MaxLength(20, { message: 'Role length can not exceed 20 characters.' })
  @MinLength(3, { message: 'Role length can not be below 3 characters.' })
  @IsString()
  name: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @ManyToOne(() => Business, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  @IsOptional()
  business: Business;

  @ManyToOne(() => PrimaryRole, (primaryRole) => primaryRole.roles, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'primary_role_id' })
  @IsOptional()
  primary_role: PrimaryRole;

  @OneToMany(() => User, (user) => user.role)
  users: User[];
}
