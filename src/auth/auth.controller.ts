import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PayloadDto } from './dto/payload.dto';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { userAlreadyExistGuard, userExistGuard } from 'src/user/user.guard';
import { Request } from 'express';
import { JwtWithVerificationGuard } from 'src/shared/verification.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/new')
  @UseGuards(userAlreadyExistGuard)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.authService.create(createUserDto);
  }

  @Post("/login")
  @UseGuards(userExistGuard)
  async login (@Body() authPayload: PayloadDto) {
    return await this.authService.validateSession(authPayload)
  }

  @Patch('update-email')
  @UseGuards(JwtWithVerificationGuard)
  updateEmail(@Req()reqObj: Request, @Body('userCode') userCode: number) {
    return this.authService.verifyEmailCode(userCode, reqObj.user);
  }
}
