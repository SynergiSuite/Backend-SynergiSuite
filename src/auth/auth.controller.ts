import { Body, Controller, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PayloadDto } from './dto/payload.dto';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import {
  UserAlreadyExistGuard,
  UserExistGuard,
  UserNotVerified,
} from '../user/user.guard';
import { Request } from 'express';
import { JwtGuard } from '../shared/auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { FrontendSecretGuard } from 'src/shared/frontend-secret.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/new')
  @UseGuards(FrontendSecretGuard, UserAlreadyExistGuard)
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.authService.create(createUserDto);
  }

  @Post('/login')
  @UseGuards(FrontendSecretGuard, UserExistGuard)
  async login(@Body() authPayload: PayloadDto) {
    return await this.authService.validateSession(authPayload);
  }

  @Patch('verify-email')
  @UseGuards(FrontendSecretGuard, JwtGuard, UserNotVerified)
  async verifyEmail(@Req() reqObj: Request, @Body('otp') otp: string) {
    return await this.authService.verifyEmailCode(reqObj.user, otp);
  }

  @Patch('refresh-token')
  @UseGuards(JwtGuard)
  refreshToken(@Req() reqObj: Request, @Body('token') token: string) {
    return this.authService.generateRefreshAccessToken(token, reqObj.user);
  }

  @Patch('forgot-password')
  @UseGuards(FrontendSecretGuard, UserExistGuard)
  async forgotPassword(@Body() data: ForgotPasswordDto) {
    return await this.authService.forgotPassword(data);
  }

  @Post('logout')
  @UseGuards(FrontendSecretGuard, JwtGuard)
  async logout(@Req() data: any) {
    return await this.authService.logout(data.user);
  }
}
