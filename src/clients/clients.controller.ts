import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { roleGuard, createClientGuard, checkClientBusiness } from './client.guard';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { JwtGuard } from '../shared/auth.guard';
import { IsVerifiedGuard } from '../shared/isVerified.guard';


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
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(+id, updateClientDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(+id);
  }
}
