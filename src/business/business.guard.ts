import {
  BadRequestException,
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NotAcceptableException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { hasAccessRoleIds } from '../roles/role-access';
import { UserHelper } from 'src/user/user.helper';

// This Guard only checks if the user already has a business or not.
@Injectable()
export class BusinessAlreadyExistsGuard implements CanActivate {
  private readonly logger = new Logger(BusinessAlreadyExistsGuard.name);
  constructor(private readonly userHelper: UserHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new InternalServerErrorException(
        'No user credentials found within this request.',
      );
    }

    const userDetails = await this.userHelper.findByEmail(user.email);

    if (userDetails?.business) {
      this.logger.error(
        `User already has a registered Business: ${user.email}`,
      );
      throw new BadRequestException('User already has a registered Business.');
    }
    return true;
  }
}

// This Guard checks for inviting purpose.
@Injectable()
export class BusinessInvitationGuard implements CanActivate {
  private readonly logger = new Logger(BusinessInvitationGuard.name);
  constructor(private readonly userHelper: UserHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const reqUserObj = request.user;
    const reqBody = request.body;

    if (!reqUserObj) {
      throw new UnauthorizedException('User not found');
    }

    if (!reqBody?.email) {
      throw new NotAcceptableException('Invited user email is required.');
    }

    const invitingUserBusiness = await this.userHelper.userHasBusinessCheck(
      reqUserObj.email,
    );
    const invitedUserBusiness = await this.userHelper.userHasBusinessCheck(
      reqBody.email,
    );

    if (invitedUserBusiness) {
      throw new ConflictException('User already has a registered Business.');
    }

    if (!invitingUserBusiness) {
      throw new NotAcceptableException(
        'User does not have a registered Business.',
      );
    }
    return true;
  }
}

// This Guard checks for accepting invitation purpose.
@Injectable()
export class BusinessAcceptInvitationGuard implements CanActivate {
  private readonly logger = new Logger(BusinessAcceptInvitationGuard.name);
  constructor(private readonly userHelper: UserHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userBusiness = await this.userHelper.userHasBusinessCheck(user.email);
    if (userBusiness) {
      throw new ConflictException('User already has a registered Business.');
    }

    return true;
  }
}

// This Gurads check for getting employees purpose.
@Injectable()
export class CheckHasBusiness implements CanActivate {
  private readonly Logger = new Logger(CheckHasBusiness.name);

  constructor(private readonly userHelper: UserHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as any;
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userBusiness = await this.userHelper.userHasBusinessCheck(user.email);
    if (!userBusiness) {
      throw new NotAcceptableException(
        'User does not have a registered Business.',
      );
    }

    request.business = userBusiness.business_id;
    return true;
  }
}

@Injectable()
export class checkValidRequestedUser implements CanActivate {
  private readonly Logger = new Logger(checkValidRequestedUser.name);

  constructor(private readonly userHelper: UserHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const params = request.params;
    const user = request.user;
    const requestedUserId = params.id;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!requestedUserId) {
      throw new BadRequestException('Id required for deletion.');
    }

    this.Logger.log(`Checking if user has a business: ${user.email}`);
    const userDetails = await this.userHelper.userHasBusinessCheck(user.email);
    const reqUserDetails = await this.userHelper.findOneById(requestedUserId);

    if (!userDetails) {
      this.Logger.error(
        `User does not have a registered Business: ${user.email}`,
      );
      throw new BadRequestException(
        'User does not have a registered Business.',
      );
    }

    if (!reqUserDetails) {
      this.Logger.error(`Requested user does exists: ${user.email}`);
      throw new BadRequestException(
        'User does not have a registered Business.',
      );
    }

    if (userDetails.business_id != reqUserDetails.business.business_id) {
      this.Logger.error(
        `Requested user does exists for this business: ${user.email}`,
      );
      throw new BadRequestException(
        'User does not have a registered Business.',
      );
    }

    if (hasAccessRoleIds(reqUserDetails.role, [1])) {
      this.Logger.error(`Requested user is an admin: ${user.email}`);
      throw new BadRequestException('User is an founder.');
    }

    return true;
  }
}

@Injectable()
export class EmployeeBelongsToBusinessGuard implements CanActivate {
  private readonly logger = new Logger(EmployeeBelongsToBusinessGuard.name);

  constructor(private readonly userHelper: UserHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const employeeId = Number(request.params.id);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!employeeId || Number.isNaN(employeeId)) {
      throw new BadRequestException('Valid employee id is required.');
    }

    const requester = await this.userHelper.getUserWithBusinessDetail(
      user.email,
    );
    if (!requester?.business?.business_id) {
      throw new BadRequestException(
        'User does not have a registered Business.',
      );
    }

    if (requester.user_id === employeeId) {
      throw new BadRequestException(
        'You cannot remove yourself from the business.',
      );
    }

    const employee = await this.userHelper.findOneById(employeeId);
    if (!employee) {
      throw new BadRequestException('Employee does not exist.');
    }

    if (employee.business?.business_id !== requester.business.business_id) {
      this.logger.error(
        `Employee ${employeeId} does not belong to requester business ${requester.business.business_id}`,
      );
      throw new BadRequestException(
        'Employee does not belong to this business.',
      );
    }

    request.actor = requester;
    request.employee = employee;
    return true;
  }
}

@Injectable()
export class RequestedEmployeeBelongsToBusinessGuard implements CanActivate {
  private readonly logger = new Logger(
    RequestedEmployeeBelongsToBusinessGuard.name,
  );

  constructor(private readonly userHelper: UserHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const requestedEmployeeId = Number(request.params.id);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!requestedEmployeeId || Number.isNaN(requestedEmployeeId)) {
      throw new NotAcceptableException('Valid employee id is required.');
    }

    const requester = await this.userHelper.getUserWithBusinessDetail(
      user.email,
    );
    if (!requester?.business?.business_id) {
      throw new UnauthorizedException(
        'User does not have a registered Business.',
      );
    }

    const employee = await this.userHelper.findOneById(requestedEmployeeId);
    if (!employee) {
      throw new NotFoundException('Employee does not exist.');
    }

    if (employee.business?.business_id !== requester.business.business_id) {
      this.logger.error(
        `Employee ${requestedEmployeeId} does not belong to requester business ${requester.business.business_id}`,
      );
      throw new NotFoundException('Employee does not belong to this business.');
    }

    request.employee = employee;
    return true;
  }
}

@Injectable()
export class roleGuard implements CanActivate {
  private readonly logger = new Logger(roleGuard.name);

  constructor(private readonly userHelper: UserHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.log(`Checking if user has right role: ${user.email}`);
    const userDetails = await this.userHelper.getUserWithBusinessDetail(
      user.email,
    );
    if (!hasAccessRoleIds(userDetails.role, [1, 2])) {
      this.logger.error(`User does not have right role: ${user.email}`);
      throw new UnauthorizedException(
        'User is not authorized to add new client.',
      );
    }
    this.logger.log(`User has right role: ${user.email}`);
    return true;
  }
}
