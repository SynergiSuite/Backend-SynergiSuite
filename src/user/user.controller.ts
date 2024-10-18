import { Controller, UseGuards, Get, Post, Body, Patch, Param, Delete, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtGuard } from 'src/shared/auth.guard';
import { Request } from 'express';
import { JwtWithVerificationGuard } from 'src/shared/verification.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Patch('update-name')
  @UseGuards(JwtWithVerificationGuard)
  updateName(@Req() reqObj: Request, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateName(reqObj.user, updateUserDto);
  }

  @Post('request-change-email')
  @UseGuards(JwtGuard)
  requestUpdateEmail(@Req() reqObj: Request, @Body() userObject: UpdateUserDto) {
    return this.userService.requestEmailChangeCode(userObject, reqObj.user);
  };

  @Post('request-verify-email')
  @UseGuards(JwtGuard)
  requestVerification(@Req() reqObj: Request) {
    return this.userService.requestEmailVerification(reqObj.user);
  };


  // @Patch("update-password")
  // @UseGuards(userExistGuard, JwtGuard)
  // async updatePassword(@Req() req: Request, @Body() updateUserDto: UpdateUserDto){
  //   return this.userService.updatePassword(req.user, updateUserDto)
  // }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.userService.remove(id);
  }
}
