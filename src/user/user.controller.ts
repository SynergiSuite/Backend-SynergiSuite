import { Controller , UseGuards, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { EmailDto } from 'src/mailer/dto/email.dto';
import { isUserVerfied, userAlreadyExistGuard, userExistGuard } from './user.guard';
import { console } from 'inspector';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create/new')
  @UseGuards(userAlreadyExistGuard)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get('check_verification')
  @UseGuards(userExistGuard)
  async checkVerification(@Param('email') email: string) {
    return this.userService.checkVerification(email)
  }

  @Post('request-verification')
  @UseGuards(userExistGuard, isUserVerfied)
  async requestVerification(@Body() emailDto ) {
    return this.userService.requestVerfication(emailDto)
  }

  @Post('set-verification')
  @UseGuards(userExistGuard, isUserVerfied)
  async setVerification(@Body() updateUserDto: UpdateUserDto ) {
    return this.userService.setVerification(updateUserDto)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch('update-name/:id')
  updateName(@Param('id') id: number, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateName(id, updateUserDto);
  }

  @Patch('update-email/:id')
  updateEmail(@Param('id') id: number, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateName(id, updateUserDto);
  }

  @Patch("update-password")
  @UseGuards(userExistGuard)
  async updatePassword(@Body() updateUserDto: UpdateUserDto){
    return this.userService.updatePassword(updateUserDto)
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.userService.remove(id);
  }
}
