import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}
  create(createRoleDto: CreateRoleDto) {
    const role = this.rolesRepository.create(createRoleDto);
    try {
      this.rolesRepository.insert(role);
      return {
        role: role,
        message: 'Role added successfully.',
      };
    } catch (error) {
      throw new HttpException(
        'Error: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  findAll() {
    return this.rolesRepository.find();
  }

  findOne(id: number) {
    return this.rolesRepository.findOne({ where: {id: id}});
  }

  update(id: number, updateRoleDto: UpdateRoleDto) {
    return `This action updates a #${id} role`;
  }

  remove(id: number) {
    return `This action removes a #${id} role`;
  }
}
