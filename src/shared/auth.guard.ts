import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { isCronSecretRequest } from './cron-secret';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    if (isCronSecretRequest(context)) {
      const request = context.switchToHttp().getRequest();
      request.isCronRequest = true;
      request.user = request.user ?? { isCronRequest: true };
      return true;
    }

    return super.canActivate(context);
  }
}
