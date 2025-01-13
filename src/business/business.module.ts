import { Module } from '@nestjs/common';
import { BusinessService } from './business.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessController } from './business.controller';
import { DatabaseModule } from 'src/database/database.module';
import { RedisModule } from 'src/redis/redis.module';
import { RedisService } from 'src/redis/redis.service';
import { Business } from './entities/business.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Business]), DatabaseModule, RedisModule],
  controllers: [BusinessController],
  providers: [BusinessService, RedisService],
})
export class BusinessModule {}
