import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { Role } from './entities/role.entity';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [TypeOrmModule.forFeature([Role]), DatabaseModule],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
