import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  UseGuards,
  Req,
  Logger,
  Query,
} from '@nestjs/common';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { Request } from 'express';
import { InviteDto } from './dto/send-invitation.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtGuard } from '../shared/auth.guard';
import {
  BusinessAcceptInvitationGuard,
  BusinessAlreadyExistsGuard,
  CheckHasBusiness,
  EmployeeBelongsToBusinessGuard,
  roleGuard,
  BusinessInvitationGuard,
  RequestedEmployeeBelongsToBusinessGuard,
} from './business.guard';
import { IsVerifiedGuard } from '../shared/isVerified.guard';
import { FrontendSecretGuard } from 'src/shared/frontend-secret.guard';

@Controller('business')
export class BusinessController {
  private readonly logger = new Logger(BusinessController.name);

  constructor(private readonly businessService: BusinessService) {}

  @Post('/register')
  @UseGuards(
    FrontendSecretGuard,
    JwtGuard,
    IsVerifiedGuard,
    BusinessAlreadyExistsGuard, 
  )
  create(@Req() reqObj: Request, @Body() createBusinessDto: CreateBusinessDto) {
    const user = reqObj.user as any;
    return this.businessService.create(user.email, createBusinessDto);
  }

  @Post('/invite')
  @UseGuards(
    FrontendSecretGuard,
    JwtGuard,
    IsVerifiedGuard,
    BusinessInvitationGuard,
  )
  async sendInvitation(@Req() reqObj: Request, @Body() inviteDto: InviteDto) {
    const requestUser = reqObj.user as any;

    this.logger.log(
      `[InviteUser] Controller received invite request | invitingUser=${requestUser?.email ?? 'unknown'} | invitedEmail=${inviteDto.email} | roleId=${inviteDto.role_id}`,
    );

    try {
      const response = await this.businessService.sendInvitation(
        requestUser,
        inviteDto,
      );
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

  @Post('/join-business')
  @UseGuards(
    FrontendSecretGuard,
    JwtGuard,
    IsVerifiedGuard,
    BusinessAcceptInvitationGuard,
  )
  acceptInvitation(@Req() reqObj: Request, @Body('token') token: string) {
    return this.businessService.acceptInvitation(reqObj.user, token);
  }

  @Get('get-employees')
  @UseGuards(FrontendSecretGuard, JwtGuard, IsVerifiedGuard, CheckHasBusiness)
  getEmployees(
    @Req() reqObj: Request & { user: any; business: number },
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.businessService.getEmployees({
      ...(reqObj.user as any),
      search,
      business_id: reqObj.business,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('get-employees-all')
  @UseGuards(FrontendSecretGuard, JwtGuard, IsVerifiedGuard, CheckHasBusiness)
  getEmployeesAll(@Req() reqObj: Request & { business: number }) {
    return this.businessService.getEmployeesAll(reqObj.business);
  }

  @Get('employees/:id')
  @UseGuards(
    FrontendSecretGuard,
    JwtGuard,
    IsVerifiedGuard,
    RequestedEmployeeBelongsToBusinessGuard,
  )
  getEmployeeDetail(@Req() reqObj: Request & { employee: any }) {
    return this.businessService.getEmployeeDetail(reqObj.employee);
  }

  @Post('employees/:id')
  @UseGuards(
    FrontendSecretGuard,
    JwtGuard,
    IsVerifiedGuard,
    roleGuard,
    EmployeeBelongsToBusinessGuard,
  )
  updateEmployee(
    @Req() reqObj: Request & { requester: any; employee: any },
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.businessService.updateEmployee(
      reqObj.employee,
      updateEmployeeDto,
      reqObj.requester,
    );
  }

  @Delete('employees/:id')
  @UseGuards(
    FrontendSecretGuard,
    JwtGuard,
    IsVerifiedGuard,
    roleGuard,
    EmployeeBelongsToBusinessGuard,
  )
  removeEmployee(@Req() reqObj: Request & { requester: any; employee: any }) {
    return this.businessService.removeEmployeeFromBusiness(
      reqObj.employee,
      reqObj.requester,
    );
  }
}
