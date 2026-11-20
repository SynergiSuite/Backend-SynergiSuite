import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const postgresHost = configService.get<string>('POSTGRES_HOST');
        const sslSetting = configService.get<string>('POSTGRES_SSL');
        const useSsl = sslSetting
          ? sslSetting.toLowerCase() === 'true'
          : (postgresHost?.endsWith('.neon.tech') ?? false);

        return {
          type: 'postgres',
          host: postgresHost,
          port: configService.get('POSTGRES_PORT'),
          username: configService.get('POSTGRES_USER'),
          password: configService.get('POSTGRES_PASSWORD'),
          database: configService.get('POSTGRES_DB'),
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          autoLoadEntities: true,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
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
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
