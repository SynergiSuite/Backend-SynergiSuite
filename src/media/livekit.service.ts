import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AccessToken, VideoGrant } from 'livekit-server-sdk';

@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);

  validateConfiguration(featureName: string): void {
    const missing = [
      'LIVEKIT_URL',
      'LIVEKIT_API_KEY',
      'LIVEKIT_API_SECRET',
    ].filter((key) => !process.env[key]);

    if (missing.length) {
      this.logger.warn(
        `Missing LiveKit configuration: ${missing.join(', ')}. ${featureName} will not work.`,
      );
      return;
    }

    this.logger.log(`LiveKit configuration validated for ${featureName}`);
  }

  async createRoomToken(input: {
    roomName: string;
    userId: number;
    userName?: string;
    ttl?: string;
    canPublish?: boolean;
    canSubscribe?: boolean;
  }): Promise<{ token: string; url: string }> {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      throw new HttpException(
        'LiveKit is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: String(input.userId),
      name: input.userName,
      ttl: input.ttl || '10m',
    });

    const grant: VideoGrant = {
      roomJoin: true,
      room: input.roomName,
      canPublish: input.canPublish ?? true,
      canSubscribe: input.canSubscribe ?? true,
    };
    accessToken.addGrant(grant);

    return {
      token: await accessToken.toJwt(),
      url: livekitUrl,
    };
  }
}
