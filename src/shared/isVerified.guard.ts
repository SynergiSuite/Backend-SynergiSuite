import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { isCronSecretRequest } from './cron-secret';
import { UserHelper } from 'src/user/user.helper';

@Injectable()
export class IsVerifiedGuard implements CanActivate {
  private readonly logger = new Logger(IsVerifiedGuard.name);
  constructor(private readonly userHelper: UserHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isCronSecretRequest(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.log(`Checking if request contains user`);
    if (!user) {
      this.logger.error(`User not found in the request.`);
      throw new UnauthorizedException('User not found');
    }
    this.logger.log(`User Found: ${user.email}`);

    this.logger.log(`Checking is user verified: ${user.email}`);
    const isVerifiedUser = await this.userHelper.isUserVerified(user.email);
    if (!isVerifiedUser) {
      this.logger.error(`User is not verified: ${user.email}`);
      throw new UnauthorizedException('User is not verified');
    }
    this.logger.log(`User is verified: ${user.email}`);
    return true;
  }
}
