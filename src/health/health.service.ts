import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  // Trigger every 30 seconds
  @Cron('*/30 * * * * *')
  async handleCron() {
    this.logger.log('Executing 30-second health check trigger...');
    try {
      const port = process.env.PORT || 3002;
      // Ping the health endpoint to keep the server/process active
      const response = await axios.get(`http://localhost:${port}/health`);
      this.logger.log(`Health check completed. Status: ${response.data.status}`);
    } catch (error) {
      this.logger.error('Health check trigger failed', error.message);
    }
  }
}
