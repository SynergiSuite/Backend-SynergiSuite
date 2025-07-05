import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { EmailModule } from 'src/mailer/email.module';
import { DatabaseModule } from 'src/database/database.module';
import { RedisService } from 'src/redis/redis.service';
import { RedisModule } from 'src/redis/redis.module';
import { RolesModule } from 'src/roles/roles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    EmailModule,
    DatabaseModule,
    RedisModule,
    RolesModule,
  ],
  controllers: [UserController],
  providers: [UserService, RedisService],
  exports: [UserService],
})
export class UserModule {}
