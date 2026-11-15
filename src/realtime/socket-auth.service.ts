import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { UserHelper } from '../user/user.helper';

export interface AuthenticatedSocketUser {
  user_id: number;
  email: string;
  name: string;
  businessId?: number;
}

@Injectable()
export class SocketAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userHelper: UserHelper,
  ) {}

  async authenticate(client: Socket): Promise<AuthenticatedSocketUser> {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    const payload = this.jwtService.verify(token, { secret: 'synergi_user' });
    if (!payload?.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.userHelper.getUserWithBusinessDetail(payload.email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      businessId: user.business?.business_id,
    };
  }
}
