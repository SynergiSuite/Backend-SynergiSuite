import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { IsInt, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from './role.entity';

@Entity('primary_roles')
export class PrimaryRole {
  @PrimaryGeneratedColumn()
  @IsInt()
  id: number;

  @Column()
  @MaxLength(20, {
    message: 'Primary role length can not exceed 20 characters.',
  })
  @MinLength(3, {
    message: 'Primary role length can not be below 3 characters.',
  })
  @IsString()
  name: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @OneToMany(() => Role, (role) => role.primary_role)
  roles: Role[];
}
