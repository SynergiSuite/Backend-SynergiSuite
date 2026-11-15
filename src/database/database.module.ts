import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST'),
        port: configService.get('POSTGRES_PORT'),
        username: configService.get('POSTGRES_USER'),
        password: configService.get('POSTGRES_PASSWORD'),
        database: configService.get('POSTGRES_DB'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        autoLoadEntities: true,
        ssl: { rejectUnauthorized: false },
        connectTimeoutMS: Number(
          configService.get('POSTGRES_CONNECT_TIMEOUT_MS') || 10000,
        ),
        extra: {
          connectionTimeoutMillis: Number(
            configService.get('POSTGRES_CONNECTION_TIMEOUT_MS') || 10000,
          ),
          idleTimeoutMillis: Number(
            configService.get('POSTGRES_IDLE_TIMEOUT_MS') || 30000,
          ),
          max: Number(configService.get('POSTGRES_POOL_MAX') || 10),
        },
        synchronize: false,
        dropSchema: false,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
