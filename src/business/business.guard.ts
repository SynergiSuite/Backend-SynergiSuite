import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { Logger } from '@nestjs/common';

// This Guard only checks if the user already has a business or not.
@Injectable()
export class businessAlreadyExistsGuard implements CanActivate {
  private readonly logger = new Logger(businessAlreadyExistsGuard.name);
  constructor(private readonly userService: UserService) { 
  }
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user  


    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.logger.log(`Checking if user already has a business: ${user.email}`);
    const isVerifiedUser = await this.userService.isUserverified(user.email);
    const userDetails = await this.userService.userHasBusinessCheck(user.email);

    if (!isVerifiedUser) {
      this.logger.error(`User is not verified: ${user.email}`)
      throw new UnauthorizedException('User is not verified');
    }

    if (userDetails) {
      this.logger.error(`User already has a registered Businessssss: ${user.email}`)
      throw new BadRequestException('User already has a registered Business.');
    }

    this.logger.log(`User is eligible to register Business: ${user.email}`)
    return true;
  } 
}

// This Guard checks for invitation purpose.
@Injectable()
export class businessInvitationGuard implements CanActivate {
  private readonly logger = new Logger(businessInvitationGuard.name);
  constructor(private readonly userService: UserService) { 
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const invitingUser = request.user
    const invitedUser = request.body


    if (!invitedUser.email && !invitingUser) {
      throw new UnauthorizedException('User not found');
    }

    this.logger.log(`Checking if user is verified: ${invitingUser.email}`);
    const isVerifiedUser = await this.userService.isUserverified(invitingUser.email);
    this.logger.log(`Checking if inviting user already has a business: ${invitingUser.email}`);
    const invitingUserDetails = await this.userService.userHasBusinessCheck(invitingUser.email);
    this.logger.log(`Checking if invited user already has a business: ${invitedUser.email}`)
    const invitedUserDetails = await this.userService.userHasBusinessCheck(invitedUser.email);
    console.log(invitedUserDetails)

    if (!isVerifiedUser) {
      this.logger.error(`User is not verified: ${invitingUser.email}`)
      throw new UnauthorizedException('User is not verified');
    }

    if (invitedUserDetails) {
      this.logger.error(`User already has a registered Business: ${invitedUser.email}`)
      throw new BadRequestException('User already has a registered Business.');
    }

    if (!invitingUserDetails) {
      this.logger.error(`User does not have a registered Businessssss: ${invitingUser.email}`)
      throw new BadRequestException('User does not have a registered Business.');
    }

    this.logger.log(`User is eligible to invite ${invitedUser}: ${invitingUser.email}`)
    return true;
  } 
}
