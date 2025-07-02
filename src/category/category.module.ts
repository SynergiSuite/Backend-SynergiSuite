import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { Category } from './entities/category.entity';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [TypeOrmModule.forFeature([Category]), DatabaseModule],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService]
})
export class CategoryModule {}
