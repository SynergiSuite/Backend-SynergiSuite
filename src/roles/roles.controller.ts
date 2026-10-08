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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtGuard } from '../shared/auth.guard';
import { CreateRoleGuard, VerifiedRolesUserGuard } from './roles.guard';
import { FrontendSecretGuard } from 'src/shared/frontend-secret.guard';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post('create')
  @UseGuards(FrontendSecretGuard, JwtGuard, CreateRoleGuard)
  createRole(@Req() req: any, @Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.createForBusiness(createRoleDto, req.userDetails);
  }

  @Get('primary-roles')
  @UseGuards(JwtGuard, VerifiedRolesUserGuard)
  findPrimaryRoles() {
    return this.rolesService.findPrimaryRoles();
  }

  @Post('add')
  @UseGuards(JwtGuard, CreateRoleGuard)
  create(@Req() req: any, @Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.createForBusiness(createRoleDto, req.userDetails);
  }

  @Get('get-all')
  @UseGuards(JwtGuard, VerifiedRolesUserGuard)
  findAll(@Req() req: any) {
    return this.rolesService.findAllForUserBusiness(req.userDetails);
  }

  @Get(':id')
  @UseGuards(JwtGuard, VerifiedRolesUserGuard)
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.rolesService.findOneForBusiness(
      +id,
      req.userDetails.business.business_id,
    );
  }

  @Patch(':id')
  @UseGuards(JwtGuard, CreateRoleGuard)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.rolesService.update(+id, updateRoleDto, req.userDetails);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, CreateRoleGuard)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.rolesService.remove(+id, req.userDetails);
  }
}
