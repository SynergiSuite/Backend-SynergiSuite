import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { Role } from './entities/role.entity';
import { PrimaryRole } from './entities/primary-role.entity';
import { DatabaseModule } from '../database/database.module';
import { User } from '../user/entities/user.entity';
import { CreateRoleGuard, VerifiedRolesUserGuard } from './roles.guard';
import { RolesHelper } from './roles.helper';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, PrimaryRole, User]),
    DatabaseModule,
  ],
  controllers: [RolesController],
  providers: [
    RolesService,
    RolesHelper,
    CreateRoleGuard,
    VerifiedRolesUserGuard,
  ],
  exports: [RolesService],
})
export class RolesModule {}
