import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserHelper } from 'src/user/user.helper';

@Injectable()
export class JwtWithVerificationGuard extends AuthGuard('jwt') {
  constructor(private readonly userHelper: UserHelper) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isValid = (await super.canActivate(context)) as boolean;

    if (!isValid) {
      return false;
    }

    const request = context.switchToHttp().getRequest();

    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isVerifiedUser = await this.userHelper.isUserVerified(user.email);
    if (!isVerifiedUser) {
      throw new UnauthorizedException('User is not verified');
    }
    return true;
  }
}
