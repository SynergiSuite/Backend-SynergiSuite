import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PayloadDto } from './dto/payload.dto';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { userAlreadyExistGuard, userExistGuard } from 'src/user/user.guard';
import { JwtGuard } from 'src/shared/auth.guard';
import { Console } from 'console';
import { Request } from 'express';

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
}
