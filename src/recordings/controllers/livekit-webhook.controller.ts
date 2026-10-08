import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { RecordingService } from '../services/recording.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('api/livekit')
export class LiveKitWebhookController {
  private readonly logger = new Logger(LiveKitWebhookController.name);

  constructor(private readonly recordingService: RecordingService) {}

  @Post('webhook')
  @HttpCode(200)
  async receiveWebhook(
    @Req() req: RawBodyRequest,
    @Headers('authorization') authorization?: string,
  ) {
    const rawBody = req.rawBody?.toString('utf8');
    if (!rawBody) {
      this.logger.error('LiveKit webhook received without raw body');
      throw new UnauthorizedException('Missing webhook body');
    }

    let event;
    try {
      event = await this.recordingService.receiveLiveKitWebhook(
        rawBody,
        authorization,
      );
    } catch (error) {
      this.logger.error(
        `LiveKit webhook verification failed: ${error.message}`,
        error.stack,
      );
      throw new UnauthorizedException('Invalid LiveKit webhook signature');
    }

    try {
      await this.recordingService.handleWebhookEvent(event);
    } catch (error) {
      this.logger.error(
        `LiveKit webhook handling failed. event=${event.event}, error=${error.message}`,
        error.stack,
      );
    }

    return { received: true };
  }
}
