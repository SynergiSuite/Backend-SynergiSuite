import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class AuthHelper {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async createToken(email: string) {
    const payload = { email: email };
    const token = this.jwtService.sign(payload);
    return token;
  }

  async validate(payload: any) {
    return { email: payload.email, iat: payload.iat, exp: payload.exp };
  }

  async getCodeFromRedis(email: string) {
    const data = await this.redisService.get(email);
    return JSON.parse(data);
  }
}
