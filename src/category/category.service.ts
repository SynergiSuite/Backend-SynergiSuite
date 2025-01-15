import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
// import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'Typeorm';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  create(createCategoryDto: CreateCategoryDto) {
    const category = this.categoryRepository.create(createCategoryDto);
    try {
      this.categoryRepository.insert(category);
      return {
        category: category,
        message: 'Category added successfully',
      };
    } catch (error) {
      return {
        error: error.message,
      };
    }
  }

  findAll() {
    return this.categoryRepository.find();
  }

  remove(id: number) {
    return `This action removes a #${id} category`;
  }
}
