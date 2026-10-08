import {
  Controller,
  UseGuards,
  Get,
  Post,
  Body,
  Patch,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtGuard } from '../shared/auth.guard';
import { Request } from 'express';
import { JwtWithVerificationGuard } from '../shared/verification.guard';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UserExistGuard, UserNotVerified } from './user.guard';
import { FrontendSecretGuard } from 'src/shared/frontend-secret.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Patch('update-name')
  @UseGuards(FrontendSecretGuard, JwtWithVerificationGuard)
  updateName(@Req() reqObj: Request, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateName(reqObj.user, updateUserDto);
  }

  @Post('request-verify-email')
  @UseGuards(FrontendSecretGuard, JwtGuard, UserNotVerified)
  requestVerification(@Req() reqObj: Request) {
    return this.userService.requestEmailVerification(reqObj.user);
  }

  @Post('request-forgot-password')
  @UseGuards(FrontendSecretGuard, UserExistGuard)
  async requestForgotPasswordCode(@Body('email') dataObj: string) {
    return await this.userService.requestForgotPasswordCode(dataObj);
  }

  @Patch('update-password')
  @UseGuards(FrontendSecretGuard, JwtWithVerificationGuard)
  async updatePassword(
    @Req() req: Request,
    @Body() dataObj: UpdatePasswordDto,
  ) {
    return this.userService.updatePassword(req.user, dataObj);
  }
}
