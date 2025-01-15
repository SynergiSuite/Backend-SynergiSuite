import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './business/business.module';
import { CategoryModule } from './category/category.module';
import { RolesModule } from './roles/roles.module';

@Module({
  imports: [UserModule, AuthModule, BusinessModule, CategoryModule, RolesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
