import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { IsInt, MinLength, MaxLength, IsEmail } from 'class-validator';
import { Business } from 'src/business/entities/business.entity';
import { Role } from 'src/roles/entities/role.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  @IsInt()
  user_id: number;

  @Column({ nullable: false })
  @MinLength(3, {
    message: 'Name is too short to register. Try Using your full name',
  })
  @MaxLength(20, { message: 'Name is too long!' })
  name: string;

  @Column({ nullable: false, unique: true })
  @IsEmail()
  email: string;

  @Column({ nullable: false })
  password_hash: string;

  @Column({ nullable: true })
  token_digest: string;

  @Column({ nullable: false, default: false })
  is_Verified: boolean;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  registration_date: Date;

  @OneToOne(() => Business, (business) => business.user)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @OneToOne(() => Role, (roles) => roles.user)
  @JoinColumn({ name: 'role_id' })
  role: Role;
}
