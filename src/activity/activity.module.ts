import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { ActivityLog } from './entities/activity-log.entity';
import { ActivityHelper } from './activity.helper';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog]), UserModule],
  controllers: [ActivityController],
  providers: [ActivityService, ActivityHelper],
  exports: [ActivityService],
})
export class ActivityModule {}
