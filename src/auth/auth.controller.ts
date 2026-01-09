import { Body, Controller, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PayloadDto } from './dto/payload.dto';
import { AuthService } from './auth.service';
import { CreateUserDto } from "../user/dto/create-user.dto"
import {
  userAlreadyExistGuard,
  userExistGuard,
  userNotVerified,
} from '../user/user.guard';
import { Request } from 'express';
import { JwtGuard } from '../shared/auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/new')
  @UseGuards(userAlreadyExistGuard)
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.authService.create(createUserDto);
  }

  @Post('/login')
  @UseGuards(userExistGuard)
  async login(@Body() authPayload: PayloadDto) {
    return await this.authService.validateSession(authPayload);
  }

  @Patch('update-email')
  @UseGuards(JwtGuard)
  async updateEmail(
    @Req() reqObj: Request,
    @Body('userCode') userCode: string,
  ) {
    return await this.authService.verifyUpdateEmailCode(userCode, reqObj.user);
  }

  @Patch('verify-email')
  @UseGuards(JwtGuard, userNotVerified)
  async verifyEmail(@Req() reqObj: Request, @Body('otp') otp: string) {
    return await this.authService.verifyEmailCode(reqObj.user, otp);
  }

  @Patch('refresh-token')
  @UseGuards(JwtGuard)
  refreshToken(@Req() reqObj: Request, @Body('token') token: string) {
    return this.authService.generateRefreshAccessToken(token, reqObj.user);
  }

  @Patch('forgot-password')
  async forgotPassword(@Body() data: ForgotPasswordDto) {
    return await this.authService.forgotPassword(data);
  }

  @Post('logout')
  @UseGuards(JwtGuard)
  async logout(@Req() data: any) {
    return await this.authService.logout(data.user);
  }
}
