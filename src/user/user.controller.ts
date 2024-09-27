import { Controller, UseGuards, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { userAlreadyExistGuard, userExistGuard } from './user.guard';
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

  @Post('check_verification')
  @UseGuards(userExistGuard)
  async checkVerification(@Body('email') email: string) {
    return this.userService.checkVerification(email)
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
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }
}
