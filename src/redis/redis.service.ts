import { Injectable } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService {
  private redisClient: RedisClientType;
  constructor() {
    this.redisClient = createClient({
      url: 'redis://localhost:6379',
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
    // console.log(key, value, ttl)
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
}
