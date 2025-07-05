import { IsInt, IsString, MaxLength, MinLength } from 'class-validator';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { Category } from 'src/category/entities/category.entity';

@Entity({ name: 'business' })
export class Business {
  @PrimaryGeneratedColumn()
  @IsInt()
  business_id: number;

  @Column()
  @IsString()
  @MinLength(3, { message: 'Name should atleast be 3 letters long.' })
  @MaxLength(25, { message: 'Name can not exceed limit of 25 characters' })
  name: string;

  @Column()
  @IsInt()
  number_of_employees: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  registration_date: Date;

  @ManyToOne(() => Category, (category) => category.business)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @OneToMany(() => User, (user) => user.business)
  users: User[];
}
