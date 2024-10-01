import { Controller , UseGuards, Get, Post, Body, Patch, Param, Delete, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { EmailDto } from 'src/mailer/dto/email.dto';
import { isUserVerfied, userAlreadyExistGuard, userExistGuard } from './user.guard';
import { console } from 'inspector';
import { JwtGuard } from 'src/shared/auth.guard';
import { Request } from 'express';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get('check_verification')
  @UseGuards(userExistGuard, JwtGuard)
  async checkVerification(@Param('email') email: string) {
    return this.userService.checkVerification(email)
  }

  @Post('request-verification')
  @UseGuards(userExistGuard, isUserVerfied, JwtGuard)
  async requestVerification(@Req() req: Request ,@Body() emailDto ) {
    return this.userService.requestVerfication(emailDto)
  }

  @Post('set-verification')
  @UseGuards(userExistGuard, isUserVerfied, JwtGuard)
  async setVerification(@Body() updateUserDto: UpdateUserDto ) {
    return this.userService.setVerification(updateUserDto)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch('update-name')
  @UseGuards(JwtGuard)
  updateName(@Req() req: Request, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateName(req.user, updateUserDto);
  }

  @Patch('update-email')
  @UseGuards(userExistGuard, JwtGuard)
  updateEmail(@Req() req: Request, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateEmail(req.user, updateUserDto);
  }

  @Patch("update-password")
  @UseGuards(userExistGuard, JwtGuard)
  async updatePassword(@Req() req: Request, @Body() updateUserDto: UpdateUserDto){
    return this.userService.updatePassword(req.user, updateUserDto)
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.userService.remove(id);
  }
}
