import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from 'src/user/user.module';
import { User } from 'src/user/entities/user.entity';
import { EmailModule } from 'src/mailer/email.module';
import { DatabaseModule } from 'src/database/database.module';
import { RedisModule } from 'src/redis/redis.module';
import { RolesModule } from 'src/roles/roles.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: 'synergi_user',
      signOptions: { expiresIn: '4h' },
    }),
    UserModule,
    TypeOrmModule.forFeature([User]),
    EmailModule,
    DatabaseModule,
    RedisModule,
    RolesModule
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule, PassportModule, AuthService],
})
export class AuthModule {}
