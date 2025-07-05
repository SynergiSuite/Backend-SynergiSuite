import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { DatabaseModule } from 'src/database/database.module';
import { RedisModule } from 'src/redis/redis.module';
import { RedisService } from 'src/redis/redis.service';
import { Business } from './entities/business.entity';
import { UserModule } from 'src/user/user.module';
import { CategoryModule } from 'src/category/category.module';
import { RolesModule } from 'src/roles/roles.module';
import { EmailModule } from 'src/mailer/email.module';
@Module({
  imports: [TypeOrmModule.forFeature([Business]), DatabaseModule, RedisModule, UserModule, CategoryModule, RolesModule, EmailModule],
  controllers: [BusinessController],
  providers: [BusinessService, RedisService],
})
export class BusinessModule {}
