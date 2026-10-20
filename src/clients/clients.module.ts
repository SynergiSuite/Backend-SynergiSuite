import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { ClientFeedback } from '../client_feedback/entities/client-feedback.entity';
import { UserModule } from 'src/user/user.module';
import {
  checkClientBusiness,
  clientDetailGuard,
  createClientGuard,
  editClientGuard,
  roleGuard,
} from './client.guard';
import { ActivityModule } from 'src/activity/activity.module';
import { EmailModule } from 'src/mailer/email.module';
import { RedisModule } from 'src/redis/redis.module';
import { RolesModule } from '../roles/roles.module';
import { ClientsHelper } from './clients.helper';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, ClientFeedback]),
    UserModule,
    ActivityModule,
    EmailModule,
    RedisModule,
    RolesModule,
  ],
  controllers: [ClientsController],
  providers: [
    ClientsService,
    ClientsHelper,
    roleGuard,
    createClientGuard,
    checkClientBusiness,
    editClientGuard,
    clientDetailGuard,
  ],
  exports: [ClientsService, ClientsHelper, clientDetailGuard],
})
export class ClientsModule {}

