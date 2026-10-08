import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AnalyticsMetricType {
  EMPLOYEE_PRODUCTIVITY = 'employee_productivity',
  TEAM_EXECUTION_VELOCITY = 'team_execution_velocity',
  QUARTERLY_GROWTH = 'quarterly_growth',
  CLIENT_ANALYTICS = 'client_analytics',
  OVERVIEW = 'overview',
}

@Entity({ name: 'analytics_records' })
export class AnalyticsRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'int' })
  businessId: number;

  @Column({
    name: 'metric_type',
    type: 'enum',
    enum: AnalyticsMetricType,
  })
  metricType: AnalyticsMetricType;

  @Column({ name: 'scope_type', length: 50, nullable: true })
  scopeType?: string;

  @Column({ name: 'scope_id', length: 100, nullable: true })
  scopeId?: string;

  @Column({ name: 'scope_name', length: 255, nullable: true })
  scopeName?: string;

  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd: Date;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  score: number;

  @Column({ type: 'jsonb' })
  data: Record<string, any>;

  @Column({ name: 'calculated_at', type: 'timestamptz' })
  calculatedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
