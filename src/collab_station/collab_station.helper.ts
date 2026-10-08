import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UserHelper } from '../user/user.helper';
import { Call } from './entities/call.entity';
import { GroupMember } from './entities/group-member.entity';

@Injectable()
export class CollabStationHelper {
  constructor(
    @InjectRepository(Call)
    private readonly callRepository: Repository<Call>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
    private readonly userHelper: UserHelper,
  ) {}

  async getUserWithBusiness(email: string) {
    return this.userHelper.getUserWithBusinessDetail(email);
  }

  async findUserById(userId: number): Promise<User> {
    return this.userHelper.findOne(userId);
  }

  async findCallById(callId: string): Promise<Call | null> {
    return this.callRepository.findOne({
      where: { id: callId },
    });
  }

  async findGroupMembership(
    groupId: string,
    userId: number,
  ): Promise<GroupMember | null> {
    return this.groupMemberRepository.findOne({
      where: { userId, groupId },
    });
  }

  isCallParticipant(call: Call, userId: number): boolean {
    return call.callerId === userId || call.recipientId === userId;
  }
}
