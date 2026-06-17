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

    this.logger.log(
      `[InviteUser] Guard started | invitingUser=${invitingUser?.email ?? 'unknown'} | invitedEmail=${invitedUser?.email ?? 'missing'} | roleId=${invitedUser?.role_id ?? 'missing'}`,
    );

    if (!invitingUser) {
      this.logger.error('[InviteUser] Guard failed | authenticated user missing');
      throw new UnauthorizedException('User not found');
    }

    if (!invitedUser?.email) {
      this.logger.error(
        `[InviteUser] Guard failed | invited email missing | invitingUser=${invitingUser.email}`,
      );
      throw new BadRequestException('Invited user email is required.');
    }

    this.logger.log(`[InviteUser] Guard checking verification | invitingUser=${invitingUser.email}`);
    const isVerifiedUser = await this.userService.isUserverified(invitingUser.email);
    this.logger.log(
      `[InviteUser] Guard verification result | invitingUser=${invitingUser.email} | isVerified=${isVerifiedUser}`,
    );
    this.logger.log(`[InviteUser] Guard checking inviting user business | invitingUser=${invitingUser.email}`);
    const invitingUserDetails = await this.userService.userHasBusinessCheck(invitingUser.email);
    this.logger.log(
      `[InviteUser] Guard inviting user business result | invitingUser=${invitingUser.email} | hasBusiness=${Boolean(invitingUserDetails)} | businessId=${invitingUserDetails ? invitingUserDetails.business_id : 'none'}`,
    );
    this.logger.log(`[InviteUser] Guard checking invited user business | invitedEmail=${invitedUser.email}`)
    const invitedUserDetails = await this.userService.userHasBusinessCheck(invitedUser.email);
    this.logger.log(
      `[InviteUser] Guard invited user business result | invitedEmail=${invitedUser.email} | hasBusiness=${Boolean(invitedUserDetails)} | businessId=${invitedUserDetails ? invitedUserDetails.business_id : 'none'}`,
    );

    if (invitedUserDetails) {
      this.logger.error(`[InviteUser] Guard rejected | invited user already has business | invitedEmail=${invitedUser.email}`)
      throw new BadRequestException('User already has a registered Business.');
    }

    if (!invitingUserDetails) {
      this.logger.error(`[InviteUser] Guard rejected | inviting user has no business | invitingUser=${invitingUser.email}`)
      throw new BadRequestException('User does not have a registered Business.');
    }

    this.logger.log(`[InviteUser] Guard passed | invitingUser=${invitingUser.email} | invitedEmail=${invitedUser.email}`)
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

@Injectable()
export class checkValidRequestedUser implements CanActivate {
  private readonly Logger = new Logger(checkValidRequestedUser.name);

  constructor(private readonly userService: UserService) { }
 
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const params = request.params;
    const user = request.user
    const requestedUserId = params.id

    if (!user) {
      throw new UnauthorizedException("User not found")
    }

    if (!requestedUserId) {
      throw new BadRequestException('Id required for deletion.');
    }

    this.Logger.log(`Checking if user has a business: ${user.email}`);
    const userDetails = await this.userService.userHasBusinessCheck(user.email);
    const reqUserDetails = await this.userService.findOne(requestedUserId);

    if (!userDetails) {
      this.Logger.error(`User does not have a registered Business: ${user.email}`);
      throw new BadRequestException('User does not have a registered Business.');
    }

    if (!reqUserDetails) {
      this.Logger.error(`Requested user does exists: ${user.email}`);
      throw new BadRequestException('User does not have a registered Business.');
    }

    if (userDetails.business_id != reqUserDetails.business.business_id) {
      this.Logger.error(`Requested user does exists for this business: ${user.email}`);
      throw new BadRequestException('User does not have a registered Business.');
    }

    if (reqUserDetails.role.id == 1) {
      this.Logger.error(`Requested user is an admin: ${user.email}`);
      throw new BadRequestException('User is an founder.');
    }

    return true;
  }
}

@Injectable()
export class roleGuard implements CanActivate {
  private readonly logger = new Logger(roleGuard.name);

  constructor(private readonly userService: UserService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        this.logger.log(`Checking if user has right role: ${user.email}`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        if(userDetails.role.id !== 1 && userDetails.role.id !== 2){
          this.logger.error(`User does not have right role: ${user.email}`);
          throw new UnauthorizedException('User is not authorized to add new client.');
        }
        this.logger.log(`User has right role: ${user.email}`);
        return true;
    }
}
