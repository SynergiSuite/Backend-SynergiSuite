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
  Logger,
} from '@nestjs/common';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { Request } from 'express';
import { InviteDto } from './dto/send-invitation.dto';
import { JwtGuard } from 'src/shared/auth.guard';
import { businessAcceptInvitationGuard, businessAlreadyExistsGuard, checkHasBusiness, businessInvitationGuard } from './business.guard';
import { IsVerifiedGuard } from 'src/shared/isVerified.guard';

@Controller('business')
export class BusinessController {
  private readonly logger = new Logger(BusinessController.name);

  constructor(private readonly businessService: BusinessService) {}

  @Post("/register")
  @UseGuards(JwtGuard, IsVerifiedGuard, businessAlreadyExistsGuard) 
  create(@Req() reqObj: Request, @Body() createBusinessDto: CreateBusinessDto) {
    return this.businessService.create(reqObj.user, createBusinessDto);
  }

  @Post("/invite")
  @UseGuards(JwtGuard, IsVerifiedGuard, businessInvitationGuard)
  async sendInvitation(@Req() reqObj: Request, @Body() inviteDto: InviteDto) {
    const requestUser = reqObj.user as any;

    this.logger.log(
      `[InviteUser] Controller received invite request | invitingUser=${requestUser?.email ?? 'unknown'} | invitedEmail=${inviteDto.email} | roleId=${inviteDto.role_id}`,
    );

    try {
      const response = await this.businessService.sendInvitation(requestUser, inviteDto);
      this.logger.log(
        `[InviteUser] Controller completed invite request | invitedEmail=${inviteDto.email}`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `[InviteUser] Controller failed invite request | invitingUser=${requestUser?.email ?? 'unknown'} | invitedEmail=${inviteDto.email} | error=${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post("/join-business")
  @UseGuards(JwtGuard, IsVerifiedGuard, businessAcceptInvitationGuard)
  acceptInvitation(@Req() reqObj: Request, @Body('token') token: string){
    return this.businessService.acceptInvitation(reqObj.user, token)
  }

  @Post("get-employees")
  @UseGuards(JwtGuard, IsVerifiedGuard, checkHasBusiness)
  getEmployees(@Req() reqObj: Request){
    return this.businessService.getEmployees(reqObj.user)
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
