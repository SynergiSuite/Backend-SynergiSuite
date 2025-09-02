import { Injectable } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import * as crypto from 'crypto'

@Injectable()
export class RedisService {
  private redisClient: RedisClientType;
  constructor() {
    this.redisClient = createClient({
      url: 'redis://redis:6379',
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
    await this.redisClient.set(key, value, { EX: ttl });
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

  async generateTokenForInvitation(invited: string, invitedBy: string, invitedAs: number ){
    const token = await crypto.randomBytes(16).toString('hex');
    const ttl = 3600;
    const obj = {
      invited: invited,
      invited_by: invitedBy,
      invited_as: invitedAs
    };

    const jsonObj = JSON.stringify(obj);
    await this.setWithExpiration(token, jsonObj,ttl);
    return token;
  }
}
