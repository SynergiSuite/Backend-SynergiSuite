import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'documents' })
export class Document {
  @PrimaryGeneratedColumn()
  document_id: number;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: false })
  reference_type: string;

  @Column({ nullable: false })
  reference_id: string;

  @Column({ nullable: false })
  file_path: string;

  @Column({ nullable: true })
  label: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
