import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'Typeorm';
import { IsInt, IsString, MaxLength, MinLength } from 'class-validator';
import { User } from 'src/user/entities/user.entity';

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

  @OneToMany(() => User, (user) => user.role)
  users: User[];
}
