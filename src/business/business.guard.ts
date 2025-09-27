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
    const userDetails = await this.userService.userHasBusinessCheck(user.email);

    if (userDetails) {
      this.logger.error(`User already has a registered Businessssss: ${user.email}`)
      throw new BadRequestException('User already has a registered Business.');
    }

    this.logger.log(`User is eligible to register Business: ${user.email}`)
    return true;
  } 
}

// This Guard checks for inviting purpose.
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

// This Guard checks for accepting invitation purpose.
@Injectable()
export class businessAcceptInvitationGuard implements CanActivate {
  private readonly logger = new Logger(businessInvitationGuard.name);
  constructor(private readonly userService: UserService) { 
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.logger.log(`Checking if user already has a business: ${user.email}`);
    const userDetails = await this.userService.userHasBusinessCheck(user.email);
    if (userDetails) {
      this.logger.error(`User already has a registered Business: ${user.email}`);
      throw new BadRequestException('User already has a registered Business.');
    }

    return true;
  }
}


// This Gurads check for getting employees purpose.
@Injectable()
export class checkHasBusiness implements CanActivate {
  private readonly Logger = new Logger(checkHasBusiness.name);

  constructor(private readonly userService: UserService) { }
 
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.Logger.log(`Checking if user has a business: ${user.email}`);
    const userDetails = await this.userService.userHasBusinessCheck(user.email);
    if (!userDetails) {
      this.Logger.error(`User does not have a registered Business: ${user.email}`);
      throw new BadRequestException('User does not have a registered Business.');
    }

    return true;
  }
}
