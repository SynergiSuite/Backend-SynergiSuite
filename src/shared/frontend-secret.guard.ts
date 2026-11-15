import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isClientSecretRequest } from './frontend-secret';

@Injectable()
export class FrontendSecretGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!isClientSecretRequest(context)) {
      throw new UnauthorizedException('Invalid client secret.');
    }
    return true;
  }
}
