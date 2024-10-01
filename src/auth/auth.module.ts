import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from 'src/user/user.module';
import { UserService } from 'src/user/user.service';
import { User } from 'src/user/entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from 'src/mailer/email.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt'}),
    JwtModule.register({
      secret: 'synergi_user',
      signOptions: { expiresIn: '1d' }
    }),
     UserModule,
     TypeOrmModule.forFeature([User]),
     EmailModule,
     DatabaseModule
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, UserService],
  exports:[JwtModule, PassportModule, AuthService]
})
export class AuthModule {}
