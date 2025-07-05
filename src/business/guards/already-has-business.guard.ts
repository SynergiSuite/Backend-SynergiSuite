import {
    BadRequestException,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AlreadyHasBusinessGuard extends AuthGuard('jwt') {
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
      throw new UnauthorizedException('User not found');
    }

    const isVerifiedUser = await this.userService.isUserverified(user.email);
    if (!isVerifiedUser) {
      throw new UnauthorizedException('User is not verified');
    }

    const hasBusiness = await this.userService.userHasBusiness(user.email)
    if (hasBusiness) {
        throw new BadRequestException('You are already part of a business, kindly leave old. business to register a new one.')
    }
    return true;
  }
}