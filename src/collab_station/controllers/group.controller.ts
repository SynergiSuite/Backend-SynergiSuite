import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../../shared/auth.guard';
import { IsVerifiedGuard } from '../../shared/isVerified.guard';
import { GroupMemberGuard } from '../guards/collab-station.guard';
import { GroupService } from '../services/group.service';
import { MessageService } from '../services/message.service';
import { CreateGroupDto } from '../dto/create-group.dto';
import { UpdateGroupDto } from '../dto/update-group.dto';
import { AddMemberDto } from '../dto/add-member.dto';
import { CollabStationHelper } from '../collab_station.helper';
import { SharedEntityType } from '../entities/message.entity';

@Controller('collab-station')
export class GroupController {
  constructor(
    private readonly groupService: GroupService,
    private readonly messageService: MessageService,
    private readonly collabStationHelper: CollabStationHelper,
  ) {}

  @Post('groups/custom')
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async createCustomGroup(@Req() req: Request, @Body() dto: CreateGroupDto) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    return this.groupService.createCustomGroup(
      dto,
      user.user_id,
      user.name,
      user.business.business_id,
    );
  }

  @Post('groups/direct/:targetUserId')
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async createDirectChat(
    @Req() req: Request,
    @Param('targetUserId') targetUserId: string,
  ) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    return this.groupService.createDirectChat(
      user.user_id,
      parseInt(targetUserId),
      user.business.business_id,
    );
  }

  @Get('groups')
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async findAllForUser(@Req() req: Request) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    return this.groupService.findAllForUser(
      user.user_id,
      user.business.business_id,
    );
  }

  @Get('groups/:groupId')
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async findOneById(@Req() req: Request, @Param('groupId') groupId: string) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    return this.groupService.findOneForUser(
      groupId,
      user.user_id,
      user.business.business_id,
    );
  }

  @Get('groups/project/:projectId')
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async findProjectGroup(
    @Req() req: Request,
    @Param('projectId') projectId: string,
  ) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    return this.groupService.findProjectGroupForUser(
      projectId,
      user.user_id,
      user.business.business_id,
    );
  }

  @Post('groups/add-members')
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async addMember(@Req() req: Request, @Body() dto: AddMemberDto) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    // To be added in guard
    const isAdmin = await this.groupService.isAdmin(dto.groupId, user.user_id);
    if (!isAdmin) {
      throw new HttpException(
        'Only admins can add members',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.groupService.addMembers(
      dto.groupId,
      dto.members,
      user.user_id,
      user.name,
      user.business.business_id,
    );
  }

  @Delete('groups/:groupId')
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async deleteGroup(@Req() req: Request, @Param('groupId') groupId: string) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    const isAdmin = await this.groupService.isAdmin(groupId, user.user_id);
    if (!isAdmin) {
      throw new HttpException(
        'Only admins can delete groups',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.groupService.deleteGroup(groupId);
  }

  @Delete('groups/:groupId/chat')
  @UseGuards(JwtGuard, IsVerifiedGuard, GroupMemberGuard)
  async deleteChatForCurrentUser(
    @Req() req: Request,
    @Param('groupId') groupId: string,
  ) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    return this.groupService.deleteChatForUser(groupId, user.user_id);
  }

  @Delete('groups/:groupId/members/:userId')
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async removeMember(
    @Req() req: Request,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    const targetUserId = parseInt(userId);
    const isSelf = targetUserId === user.user_id;

    if (!isSelf) {
      const isAdmin = await this.groupService.isAdmin(groupId, user.user_id);
      if (!isAdmin) {
        throw new HttpException(
          'Only admins can remove other members',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return this.groupService.removeMember(groupId, targetUserId);
  }

  @Patch('groups/:groupId')
  @UseGuards(JwtGuard, IsVerifiedGuard)
  async updateGroup(
    @Req() req: Request,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    const isAdmin = await this.groupService.isAdmin(groupId, user.user_id);
    if (!isAdmin) {
      throw new HttpException(
        'Only admins can update groups',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.groupService.updateGroup(groupId, dto);
  }

  @Get('groups/:groupId/messages')
  @UseGuards(JwtGuard, IsVerifiedGuard, GroupMemberGuard)
  async findByGroup(
    @Req() req: Request,
    @Param('groupId') groupId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('sharedEntityType') sharedEntityType?: SharedEntityType,
    @Query('sharedEntityId') sharedEntityId?: string,
  ) {
    const user = await this.collabStationHelper.getUserWithBusiness(
      (req.user as any).email,
    );
    return this.messageService.findByGroup(
      groupId,
      limit ? parseInt(limit) : 50,
      cursor,
      sharedEntityType,
      sharedEntityId,
      user.user_id,
    );
  }
}
