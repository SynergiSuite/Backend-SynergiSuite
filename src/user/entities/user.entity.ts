import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { IsInt, MinLength, MaxLength, IsEmail } from 'class-validator';

@Entity({ name: 'user' })
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
}
