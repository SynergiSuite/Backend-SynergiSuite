import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { EmailModule } from '../mailer/email.module';
import { DatabaseModule } from '../database/database.module';
import { RedisService } from '../redis/redis.service';
import { RedisModule } from '../redis/redis.module';
import { RolesModule } from '../roles/roles.module';
import { JwtService } from '@nestjs/jwt';
import { UserHelper } from './user.helper';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    EmailModule,
    DatabaseModule,
    RedisModule,
    RolesModule,
  ],
  controllers: [UserController],
  providers: [UserService, RedisService, JwtService, UserHelper],
  exports: [UserService, UserHelper],
})
export class UserModule {}
