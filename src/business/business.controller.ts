import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { Request } from 'express';
import { JwtWithVerificationGuard } from 'src/shared/verification.guard';
import { InviteDto } from './dto/send-invitation.dto';
import { BusinessGuard } from './guards/user-business.guard';

@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post("/register")
  @UseGuards(JwtWithVerificationGuard)
  create(@Req() reqObj: Request, @Body() createBusinessDto: CreateBusinessDto) {
    return this.businessService.create(reqObj.user, createBusinessDto);
  }

  @Post("/invite")
  @UseGuards(BusinessGuard)
  sendInvitation(@Req() reqObj: Request, @Body() inviteDto: InviteDto) {
    return this.businessService.sendInvitation(reqObj.user, inviteDto);
  }

  @Get()
  findAll() {
    return this.businessService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.businessService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateBusinessDto: UpdateBusinessDto,
  ) {
    return this.businessService.update(+id, updateBusinessDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.businessService.remove(+id);
  }
}
