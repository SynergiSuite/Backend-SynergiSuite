import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { UserModule } from 'src/user/user.module';
import {
  checkClientBusiness,
  createClientGuard,
  editClientGuard,
  roleGuard,
} from './client.guard';
import { ActivityModule } from 'src/activity/activity.module';
import { EmailModule } from 'src/mailer/email.module';
import { RedisModule } from 'src/redis/redis.module';
import { ClientsHelper } from './clients.helper';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client]),
    UserModule,
    ActivityModule,
    EmailModule,
    RedisModule,
  ],
  controllers: [ClientsController],
  providers: [
    ClientsService,
    ClientsHelper,
    roleGuard,
    createClientGuard,
    checkClientBusiness,
    editClientGuard,
  ],
  exports: [ClientsService],
})
export class ClientsModule {}
