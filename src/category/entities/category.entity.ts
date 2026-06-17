import { Column, PrimaryGeneratedColumn, Entity, OneToMany } from 'typeorm';
import { IsInt, IsString } from 'class-validator';
import { Business } from '../../business/entities/business.entity';

@Entity({ name: 'categories' })
export class Category {
  @PrimaryGeneratedColumn()
  @IsInt()
  id: number;

  @Column()
  @IsString()
  name: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  registration_date: Date;

  @OneToMany(() => Business, (business) => business.category)
  business: Business[];
}
