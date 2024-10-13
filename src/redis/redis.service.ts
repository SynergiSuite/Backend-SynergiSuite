import { Injectable } from "@nestjs/common";
import { createClient, RedisClientType } from "redis";

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

    async get(key: string): Promise<void> {
        await this.redisClient.get(key);
    }

    async del(key: string): Promise<void> {
        await this.redisClient.del(key);
    }

    async setWithExpiration(key: string, value: string, ttl: number): Promise<void> {
        await this.redisClient.set(key, value, { EX: ttl });
    }

    async generateCode(email: string): Promise<string> {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const ttl = 3600;

        await this.setWithExpiration(email, otp, ttl);
        
        return otp;
    }
}