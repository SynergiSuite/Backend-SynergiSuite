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
import { InviteDto } from './dto/send-invitation.dto';
import { JwtGuard } from 'src/shared/auth.guard';
import { businessAcceptInvitationGuard, businessAlreadyExistsGuard, businessInvitationGuard } from './business.guard';

@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post("/register")
  @UseGuards(JwtGuard, businessAlreadyExistsGuard) 
  create(@Req() reqObj: Request, @Body() createBusinessDto: CreateBusinessDto) {
    return this.businessService.create(reqObj.user, createBusinessDto);
  }

  @Post("/invite")
  @UseGuards(JwtGuard, businessInvitationGuard)
  sendInvitation(@Req() reqObj: Request, @Body() inviteDto: InviteDto) {
    return this.businessService.sendInvitation(reqObj.user, inviteDto);
  }

  @Post("/join-business")
  @UseGuards(JwtGuard, businessAcceptInvitationGuard)
  acceptInvitation(@Req() reqObj: Request, @Body('token') token: string){
    return this.businessService.acceptInvitation(reqObj.user, token)
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
