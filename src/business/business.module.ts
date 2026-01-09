import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';
import { Business } from './entities/business.entity';
import { UserModule } from '../user/user.module';
import { CategoryModule } from '../category/category.module';
import { RolesModule } from '../roles/roles.module';
import { EmailModule } from '../mailer/email.module';
@Module({
  imports: [TypeOrmModule.forFeature([Business]), DatabaseModule, RedisModule, UserModule, CategoryModule, RolesModule, EmailModule],
  controllers: [BusinessController],
  providers: [BusinessService, RedisService],
  exports: [BusinessService]
})
export class BusinessModule {}
