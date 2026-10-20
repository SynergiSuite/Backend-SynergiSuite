import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../business/entities/business.entity';
import { User } from '../user/entities/user.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { PrimaryRole } from './entities/primary-role.entity';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesHelper {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(PrimaryRole)
    private readonly primaryRoleRepository: Repository<PrimaryRole>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  createRole(createRoleDto: CreateRoleDto): Role {
    const { business_id, primary_role_id, ...roleData } = createRoleDto;
    return this.roleRepository.create({
      ...roleData,
      business: business_id ? { business_id } : undefined,
      primary_role: primary_role_id ? { id: primary_role_id } : undefined,
    });
  }

  saveRole(role: Role): Promise<Role> {
    return this.roleRepository.save(role);
  }

  findPrimaryRole(id: number) {
    return this.primaryRoleRepository.findOne({ where: { id } });
  }

  findPrimaryRoleByName(name: string) {
    return this.primaryRoleRepository
      .createQueryBuilder('primaryRole')
      .where('LOWER(primaryRole.name) = :name', { name: name.toLowerCase() })
      .getOne();
  }

  savePrimaryRole(role: PrimaryRole) {
    return this.primaryRoleRepository.save(role);
  }

  createPrimaryRole(name: string) {
    return this.primaryRoleRepository.create({ name });
  }

  findRoleByNameForBusiness(name: string, businessId: number) {
    return this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.business', 'business')
      .leftJoinAndSelect('role.primary_role', 'primaryRole')
      .where('business.business_id = :businessId', { businessId })
      .andWhere('LOWER(role.name) = :roleName', {
        roleName: name.toLowerCase(),
      })
      .getOne();
  }

  async findClientRoleForBusiness(businessId: number): Promise<Role | null> {
    let role = await this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.business', 'business')
      .leftJoinAndSelect('role.primary_role', 'primaryRole')
      .where('business.business_id = :businessId', { businessId })
      .andWhere(
        '(LOWER(role.name) = :roleName OR LOWER(primaryRole.name) = :primaryRoleName)',
        {
          roleName: 'client',
          primaryRoleName: 'client',
        },
      )
      .getOne();

    if (!role) {
      let clientPrimaryRole = await this.findPrimaryRoleByName('client');
      if (!clientPrimaryRole) {
        clientPrimaryRole = await this.savePrimaryRole(
          this.createPrimaryRole('client'),
        );
      }
      const business = await this.roleRepository.manager.findOne(Business, {
        where: { business_id: businessId },
      });
      if (business) {
        const newRole = this.createBusinessRole(
          'Client',
          business,
          clientPrimaryRole,
        );
        role = await this.saveRoles([newRole]).then((r) => r[0]);
      }
    }

    return role;
  }

  createBusinessRole(
    name: string,
    business: Business,
    primaryRole: PrimaryRole,
  ) {
    return this.roleRepository.create({
      name,
      business,
      primary_role: primaryRole,
    });
  }

  createBusinessRoles(
    business: Business,
    roles: Array<{ name: string; primaryRole: PrimaryRole }>,
  ) {
    return this.roleRepository.create(
      roles.map(({ name, primaryRole }) => ({
        name,
        business,
        primary_role: primaryRole,
      })),
    );
  }

  saveRoles(roles: Role[]) {
    return this.roleRepository.save(roles);
  }

  findAll() {
    return this.roleRepository.find({
      relations: ['business', 'primary_role'],
    });
  }

  findUserByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email },
      relations: ['business'],
    });
  }

  findForBusiness(businessId: number) {
    return this.roleRepository.find({
      where: { business: { business_id: businessId } },
      relations: ['business', 'primary_role'],
      order: { created_at: 'DESC' },
    });
  }

  findOneByBusiness(name: string, businessId: number) {
    return this.roleRepository.findOne({
      where: { name, business: { business_id: businessId } },
      relations: ['business', 'primary_role'],
    });
  }

  findOne(id: number) {
    return this.roleRepository.findOne({
      where: { id },
      relations: ['business', 'primary_role'],
    });
  }

  remove(role: Role) {
    return this.roleRepository.remove(role);
  }

  findPrimaryRoles() {
    return this.primaryRoleRepository.find({ order: { id: 'ASC' } });
  }
}
