import { Injectable, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import * as crypto from 'crypto';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: RedisClientType;
  constructor() {
    this.redisClient = createClient({
      // redis://default:AVJXAAIncDEwNGRhZTIzYjBjYTU0NGFmYjhiNWMyOWE5N2JiMzUzNnAxMjEwNzk@magical-puma-21079.upstash.io:6379
      // 'redis://redis:6379'
      
      url: 'redis://default:gQAAAAAAAYu8AAIocDJmMTM1NjQ0NmRiYjI0MDFkYTI3NDJmNmM3NGU1YzdkNHAyMTAxMzA4@hopeful-dingo-101308.upstash.io:6379',
      socket: {
        tls: true,
      },
    });
    this.redisClient.connect();
  }

  async set(key: string, value: string): Promise<void> {
    await this.redisClient.set(key, value);
  }

  async get(key: string) {
    return await this.redisClient.get(key);
  }

  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async setWithExpiration(key: string, value: any, ttl: number): Promise<void> {
    this.logger.log(`[InviteUser] Redis set with expiration | keyLength=${key.length} | ttl=${ttl}`);
    await this.redisClient.set(key, value, { EX: ttl });
    this.logger.log(`[InviteUser] Redis set completed | keyLength=${key.length}`);
  }

  async generateUpdateEmailCode(
    newEmail: string,
    email: string,
  ): Promise<string> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const ttl = 3600;
    const value = {
      otp: otp,
      newEmail: newEmail,
    };
    const jsonString = JSON.stringify(value);

    await this.setWithExpiration(email, jsonString, ttl);
    return otp;
  }

  async generateVerificationCode(email: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const ttl = 3600;
    const value = {
      otp: otp,
    };
    const jsonString = JSON.stringify(value);
    await this.setWithExpiration(email, jsonString, ttl);
    return otp;
  }

  async generateTokenForInvitation(
    invited: string,
    invitedBy: string,
    invitedAs: number,
  ) {
    this.logger.log(
      `[InviteUser] Redis invitation token generation started | invitedEmail=${invited} | invitedBy=${invitedBy} | roleId=${invitedAs}`,
    );
    const token = await crypto.randomBytes(16).toString('hex');
    const ttl = 3600;
    const obj = {
      invited: invited,
      invited_by: invitedBy,
      invited_as: invitedAs,
    };

    const jsonObj = JSON.stringify(obj);
    await this.setWithExpiration(token, jsonObj, ttl);
    this.logger.log(
      `[InviteUser] Redis invitation token stored | invitedEmail=${invited} | ttl=${ttl} | tokenLength=${token.length}`,
    );
    return token;
  }
}
