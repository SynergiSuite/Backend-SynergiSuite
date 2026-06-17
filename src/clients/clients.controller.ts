import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, ParseUUIDPipe } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { roleGuard, createClientGuard, checkClientBusiness, editClientGuard } from './client.guard';
import { Request } from 'express';
import { JwtGuard } from 'src/shared/auth.guard';
import { IsVerifiedGuard } from 'src/shared/isVerified.guard';


@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post("add-client")
  @UseGuards(JwtGuard, IsVerifiedGuard, roleGuard, createClientGuard)
  create(@Req() req: Request, @Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(createClientDto, req.user);
  }

  @Get("get-all-clients")
  @UseGuards(JwtGuard, IsVerifiedGuard, checkClientBusiness)
  findAll(@Req() req: Request) {
    return this.clientsService.findAll(req.user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findOne(id);
  }

  @Post('edit-client/:id')
  @UseGuards(JwtGuard, IsVerifiedGuard, roleGuard, editClientGuard)
  update(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(id, updateClientDto, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, IsVerifiedGuard, roleGuard, editClientGuard)
  remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.remove(id, req.user);
  }
}
