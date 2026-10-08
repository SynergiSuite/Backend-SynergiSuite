import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { DomainEventsService } from './domain-events.service';
import { PresenceService } from './presence.service';
import { RealtimeDeliveryService } from './realtime-delivery.service';
import { SocketAuthService } from './socket-auth.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: 'synergi_user',
      signOptions: { expiresIn: '4h' },
    }),
    UserModule,
  ],
  providers: [
    DomainEventsService,
    PresenceService,
    RealtimeDeliveryService,
    SocketAuthService,
  ],
  exports: [
    DomainEventsService,
    PresenceService,
    RealtimeDeliveryService,
    SocketAuthService,
  ],
})
export class RealtimeModule {}
