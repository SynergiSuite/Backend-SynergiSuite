import {
  CanActivate,
  Injectable,
  ExecutionContext,
  ConflictException,
  NotFoundException,
  Logger,
  UnauthorizedException
} from '@nestjs/common'
import { UserService } from './user.service';


// This Guard only checks if the user already exists or not.
@Injectable()
export class userAlreadyExistGuard implements CanActivate {
  private readonly logger = new Logger(userAlreadyExistGuard.name);
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const createUserDto = request.body;

    this.logger.log(`Checking if user already exists: ${createUserDto.email}`);
    const existingUser = await this.userService.findByEmail(
      createUserDto.email,
    );

    if (existingUser) {
      this.logger.error(`User already exists: ${createUserDto.email}`)
      throw new ConflictException('User Already Exist');
    } else {
      this.logger.log(`User does not exist: ${createUserDto.email}`)
      return true;
    }
  }
}

@Injectable()
export class userExistGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const createUserDto = request.body;

    const existingUser = await this.userService.findByEmail(
      createUserDto.email,
    );

    if (!existingUser) {
      throw new NotFoundException('Could not find email!');
    } else {
      return true;
    }
  }
}

// This Guard only checks if the user is already verified or not.
@Injectable()
export class userNotVerified implements CanActivate {
  private readonly logger = new Logger(userNotVerified.name);
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const createUserDto = request.user;

    const existingUser = await this.userService.findByEmail(
      createUserDto.email,
    );
    this.logger.log(`Checking if user is verified: ${existingUser.email}`);

    if (existingUser.is_Verified) {
      this.logger.error(`User is already verified: ${existingUser.email}`)
      throw new UnauthorizedException('User is already verified!');
    } else {
      this.logger.log(`User is not verified: ${existingUser.email}`)
      return true;
    }
  }
}
