import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { EmailModule } from 'src/mailer/email.module';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from 'src/auth/auth.module';
import { RedisService } from 'src/redis/redis.service';
import { RedisModule } from 'src/redis/redis.module';


@Module({
  imports: [TypeOrmModule.forFeature([User]), EmailModule, DatabaseModule, RedisModule ],
  controllers: [UserController],
  providers: [UserService, RedisService],
})
export class UserModule {}
