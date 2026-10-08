import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { toRoleParsedResponse, toRoleResponse } from './role-access';
import { Business } from '../business/entities/business.entity';
import { RolesHelper } from './roles.helper';

@Injectable()
export class RolesService {
  logger: any;
  constructor(private readonly rolesHelper: RolesHelper) {}

  async create(createRoleDto: CreateRoleDto) {
    const role = this.rolesHelper.createRole(createRoleDto);
    try {
      const savedRole = await this.rolesHelper.saveRole(role);
      return {
        role: toRoleResponse(savedRole),
        message: 'Role added successfully.',
      };
    } catch (error) {
      throw new HttpException(
        'Error: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async createForBusiness(createRoleDto: CreateRoleDto, userDetails: any) {
    const businessId = userDetails?.business?.business_id;

    if (!businessId) {
      throw new BadRequestException(
        'User does not have a registered Business.',
      );
    }

    if (!createRoleDto.primary_role_id) {
      throw new BadRequestException('Primary role is required.');
    }

    const primaryRole = await this.rolesHelper.findPrimaryRole(
      createRoleDto.primary_role_id,
    );

    if (!primaryRole) {
      throw new BadRequestException('Primary role does not exist.');
    }

    const existingRole = await this.rolesHelper.findRoleByNameForBusiness(
      createRoleDto.name,
      businessId,
    );

    if (existingRole) {
      throw new BadRequestException('Role already exists for this business.');
    }

    const role = this.rolesHelper.createBusinessRole(
      createRoleDto.name,
      userDetails.business,
      primaryRole,
    );
    const savedRole = await this.rolesHelper.saveRole(role);

    return {
      message: 'Role added successfully.',
      role: toRoleResponse(savedRole),
    };
  }

  async getOrCreateFounderRoleForBusiness(business: Business) {
    let founderPrimaryRole =
      await this.rolesHelper.findPrimaryRoleByName('founder');

    if (!founderPrimaryRole) {
      founderPrimaryRole = await this.rolesHelper.savePrimaryRole(
        this.rolesHelper.createPrimaryRole('founder'),
      );
    }

    const existingFounderRole =
      await this.rolesHelper.findRoleByNameForBusiness(
        'founder',
        business.business_id,
      );

    if (existingFounderRole) {
      return existingFounderRole;
    }

    return this.rolesHelper.saveRole(
      this.rolesHelper.createBusinessRole(
        'Founder',
        business,
        founderPrimaryRole,
      ),
    );
  }

  async createNewRolesForNewBusiness(business: Business) {
    try {
      const founderPrimaryRole =
        await this.rolesHelper.findPrimaryRoleByName('founder');
      const clientPrimaryRole =
        await this.rolesHelper.findPrimaryRoleByName('client');
      if (!founderPrimaryRole || !clientPrimaryRole) {
        throw new InternalServerErrorException(
          'Default primary roles are not configured.',
        );
      }
      const newRolesObj = this.rolesHelper.createBusinessRoles(business, [
        { name: 'Founder', primaryRole: founderPrimaryRole },
        { name: 'Client', primaryRole: clientPrimaryRole },
      ]);
      const newRoles = await this.rolesHelper.saveRoles(newRolesObj);

      return {
        founder_role: newRoles.find((r) => r.name === 'Founder'),
        client_role: newRoles.find((r) => r.name === 'Client'),
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  findAll() {
    return this.rolesHelper.findAll();
  }

  async findAllForUserBusiness(reqUser: any) {
    const user = reqUser?.business?.business_id
      ? reqUser
      : await this.rolesHelper.findUserByEmail(reqUser.email);
    const businessId = user?.business?.business_id;

    if (!businessId) {
      throw new BadRequestException(
        'User does not have a registered Business.',
      );
    }

    return this.rolesHelper.findForBusiness(businessId);
  }

  async findOneByBusiness(name: string, business_id: number) {
    const data = await this.rolesHelper.findOneByBusiness(name, business_id);

    return toRoleParsedResponse(data);
  }

  findOne(id: number) {
    return this.rolesHelper.findOne(id);
  }

  async findOneForBusiness(id: number, businessId: number) {
    const role = await this.rolesHelper.findOne(id);
    if (!role || role.business?.business_id !== businessId) {
      throw new BadRequestException('Role does not exist for this business.');
    }
    return role;
  }

  findPrimaryRoles() {
    return this.rolesHelper.findPrimaryRoles();
  }

  async update(id: number, updateRoleDto: UpdateRoleDto, userDetails: any) {
    const businessId = userDetails.business.business_id;
    const role = await this.findOneForBusiness(id, businessId);

    if (updateRoleDto.name !== undefined) {
      role.name = updateRoleDto.name;
    }
    if (updateRoleDto.primary_role_id !== undefined) {
      const primaryRole = await this.rolesHelper.findPrimaryRole(
        updateRoleDto.primary_role_id,
      );
      if (!primaryRole) {
        throw new BadRequestException('Primary role does not exist.');
      }
      role.primary_role = primaryRole;
    }

    const savedRole = await this.rolesHelper.saveRole(role);
    return {
      message: 'Role updated successfully.',
      role: toRoleResponse(savedRole),
    };
  }

  async remove(id: number, userDetails: any) {
    const role = await this.findOneForBusiness(
      id,
      userDetails.business.business_id,
    );
    await this.rolesHelper.remove(role);
    return { message: 'Role removed successfully.' };
  }
}
