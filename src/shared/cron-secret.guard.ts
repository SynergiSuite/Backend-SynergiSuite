import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isCronSecretRequest } from './cron-secret';

@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!isCronSecretRequest(context)) {
      throw new UnauthorizedException('Invalid cron secret.');
    }

    return true;
  }
}
