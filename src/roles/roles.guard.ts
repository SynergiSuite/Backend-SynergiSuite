import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { hasAccessRoleIds } from './role-access';

@Injectable()
export class VerifiedRolesUserGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.email) {
      throw new UnauthorizedException('User not found');
    }

    const userDetails = await this.userRepository.findOne({
      where: { email: user.email },
      relations: ['business', 'role', 'role.primary_role'],
    });

    if (!userDetails) {
      throw new UnauthorizedException('User not found');
    }

    if (!userDetails.is_Verified) {
      throw new UnauthorizedException('User is not verified');
    }

    request.userDetails = userDetails;
    return true;
  }
}

@Injectable()
export class CreateRoleGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.email) {
      throw new UnauthorizedException('User not found');
    }

    const userDetails = await this.userRepository.findOne({
      where: { email: user.email },
      relations: ['business', 'role', 'role.primary_role'],
    });

    if (!userDetails) {
      throw new UnauthorizedException('User not found');
    }

    if (!userDetails.is_Verified) {
      throw new UnauthorizedException('User is not verified');
    }

    if (!userDetails.business?.business_id) {
      throw new BadRequestException(
        'User does not have a registered Business.',
      );
    }

    if (!hasAccessRoleIds(userDetails.role, [1, 2])) {
      throw new ForbiddenException('User is not authorized to create roles.');
    }

    request.userDetails = userDetails;
    return true;
  }
}
