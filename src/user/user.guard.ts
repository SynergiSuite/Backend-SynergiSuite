import {
  CanActivate,
  Injectable,
  ExecutionContext,
  ConflictException,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { UserHelper } from './user.helper';

// This Guard only checks if the user already exists or not.
@Injectable()
export class UserAlreadyExistGuard implements CanActivate {
  private readonly logger = new Logger(UserAlreadyExistGuard.name);
  constructor(private readonly userHelper: UserHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const createUserDto = request.body;

    this.logger.log(`Checking if user already exists: ${createUserDto.email}`);
    const existingUser = await this.userHelper.getUserWithBusinessDetailWithoutException(createUserDto.email);

    if (existingUser) {
      this.logger.error(
        `Cannot sign this user up. User already exists. Email: ${existingUser.email}`,
      );
      throw new ConflictException(
        'Cannot sign this user up. User already exists.',
      );
    } else {
      this.logger.log(
        `Allowing user to sign up. Email: ${createUserDto.email}`,
      );
      return true;
    }
  }
}

@Injectable()
export class UserExistGuard implements CanActivate {
  constructor(private readonly userHelper: UserHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const createUserDto = request.body;

    const existingUser = await this.userHelper.findByEmail(createUserDto.email);

    if (!existingUser) {
      throw new NotFoundException('Could not find user linked with this email');
    } else {
      return true;
    }
  }
}

// This Guard only checks if the user is already verified or not.
@Injectable()
export class UserNotVerified implements CanActivate {
  private readonly logger = new Logger(UserNotVerified.name);
  constructor(private readonly userHelper: UserHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const createUserDto = request.user;

    const existingUser = await this.userHelper.findByEmail(createUserDto.email);
    this.logger.log(`Checking if user is verified: ${existingUser.email}`);

    if (existingUser.is_Verified) {
      this.logger.error(`User is already verified: ${existingUser.email}`);
      throw new BadRequestException('User is already verified!');
    } else {
      this.logger.log(`User is not verified: ${existingUser.email}`);
      return true;
    }
  }
}
