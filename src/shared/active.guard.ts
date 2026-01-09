import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from 'src/user/user.service';

@Injectable()
export class JWTwithVerficationAndActiveGuard extends AuthGuard('jwt') {
  constructor(private readonly userService: UserService) {
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
      throw new UnauthorizedException('User not found.');
    }

    const validate = await this.userService.isUserActive(user.email);

    if (!validate) {
      throw new UnauthorizedException(
        'User is not active. To activate the user make sure the user has a business to join.',
      );
    }

    return true;
  }
}
