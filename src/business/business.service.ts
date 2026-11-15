import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/entities/activity-log.entity';
import { PaginationParams } from '../shared/pagination-params';
import { toRoleResponse } from '../roles/role-access';
import { BusinessHelper } from './business.helper';
import {
  AllEmployeeResponse,
  BusinessCreationResponse,
  BusinessInvitationAcceptanceResponse,
  EmployeeDetailResponse,
  EmployeesResponse,
} from './dto/response.dto';
import { InviteDto } from './dto/send-invitation.dto';

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(
    private activityService: ActivityService,
    private readonly businessHelper: BusinessHelper,
  ) {}

  // Register New Business
  async create(
    email: string,
    createBusinessDto: CreateBusinessDto,
  ): Promise<BusinessCreationResponse> {
    this.logger.log(
      `Initializing request to register new business for user: ${email}`,
    );
    try {
      const { business, updateUserEntity } = await this.businessHelper.create(
        email,
        createBusinessDto,
      );
      // change
      await this.activityService.log({
        action: ActivityAction.CREATED,
        module: 'business',
        entityType: 'Business',
        entityId: business.business_id,
        entityName: business.name,
        actor: {
          ...updateUserEntity,
          business: business,
        },
        businessId: business.business_id,
        after: {
          business_id: business.business_id,
          name: business.name,
          number_of_employees: business.number_of_employees,
          categoryId: business.category.id,
        },
      });
      this.logger.log(
        `Registering business request completed successfully for user: ${email}`,
      );
      return {
        business_name: business.name,
        business_id: business.business_id,
        role: toRoleResponse(updateUserEntity.role),
      };
    } catch (error) {
      this.logger.error(
        `Registering business request failed for user: ${email} ${error.message}`,
      );
      throw new InternalServerErrorException('Failed to register new business');
    }
  }

  // Send invitations
  async sendInvitation(reqObj: any, inviteDto: InviteDto) {
    const email = reqObj.email;
    this.logger.log(
      `Initializing employee invitation request by user: ${email} for: ${inviteDto.email} `,
    );
    try {
      const { token, registered, user, role } =
        await this.businessHelper.inviteEmail(email, inviteDto);
      // change
      await this.activityService.log({
        action: ActivityAction.CREATED,
        module: 'business',
        entityType: 'Invitation',
        entityId: inviteDto.email,
        entityName: inviteDto.email,
        actor: user,
        businessId: user.business.business_id,
        after: {
          invitedEmail: inviteDto.email,
          roleId: role.id,
          registered,
        },
        description: `${user.name} invited ${inviteDto.email} to ${user.business.name}`,
      });
      return {
        invitation_token: token,
      };
    } catch (error) {
      this.logger.error(
        `Employee invitation request failed for user: ${email} for: ${inviteDto.email} | error: ${error.message}`,
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  // Accept invitations
  async acceptInvitation(
    dataObj: any,
    token: string,
  ): Promise<BusinessInvitationAcceptanceResponse> {
    this.logger.log(
      `Initializing request to accept invitation for user: ${dataObj.email}`,
    );
    try {
      const { business, role, client_id } =
        await this.businessHelper.acceptInvitation(dataObj.email, token);
      return {
        business_id: business.business_id,
        business_name: business.name,
        role_id: role.id,
        role_name: role.name,
        role: toRoleResponse(role),
        client_id: client_id ?? null,
      };
    } catch (error) {
      this.logger.error(
        `Failed to accept invitation for user: ${dataObj.email} | error: ${error.message}`,
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  // Get employees for business with pagination and search and statistics
  async getEmployees(
    data: {
      email: string;
      search?: string;
      business_id: number;
    } & PaginationParams,
  ): Promise<EmployeesResponse> {
    const {
      employees,
      totalEmployees,
      registrationCount,
      projectCount,
      newProjectsThisMonth,
    } = await this.businessHelper.getEmployeesPaginayedAndFiltered(
      data.business_id,
      Number(data.page) || 1,
      Number(data.limit) || 5,
      data.search,
    );

    return {
      data: employees,
      meta: {
        totalItems: totalEmployees,
        itemCount: employees.length,
        itemsPerPage: Number(data.limit) || 5,
        currentPage: Number(data.page) || 1,
        totalPages: Math.ceil(totalEmployees / Number(data.limit) || 5),
      },
      statistics: {
        registrationCount,
        projectCount,
        newProjectsThisMonth,
      },
    };
  }

  // Get all employees for business without pagination and search and statistics
  async getEmployeesAll(business_id: number): Promise<AllEmployeeResponse> {
    const employees =
      await this.businessHelper.findAllEmployeesUsingBusinessId(business_id);
    return {
      data: employees,
    };
  }

  // Calculate new projects this month
  newProjects(business: any) {
    const now = new Date();
    const firstDayOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );
    const newProjectsThisMonth = business.projects.filter(
      (project) =>
        project.created_at >= firstDayOfMonth && project.created_at <= now,
    ).length;

    return newProjectsThisMonth;
  }

  // Get employee details
  async getEmployeeDetail(empObj: any): Promise<EmployeeDetailResponse> {
    const { teams, completedTaskActivities, recentActivities } =
      await this.businessHelper.getSpecificEmployeeDetails(empObj);
    return {
      employee: {
        userId: empObj.userId,
        name: empObj.name,
        email: empObj.email,
        salary: empObj.salary,
        registrationDate: empObj.registrationDate,
        role: toRoleResponse(empObj.role),
        business: {
          businessId: empObj.business.businessId,
          name: empObj.business.name,
        },
      },
      teams,
      taskActivity: {
        completedTasksFromActivity: completedTaskActivities.length,
        completedTaskActivities: completedTaskActivities.map((activity) => ({
          activityId: activity.id,
          taskId: activity.entityId,
          taskName: activity.entityName,
          oldValue: activity.oldValue,
          newValue: activity.newValue,
          createdAt: activity.createdAt,
        })),
      },
      recentActivities,
    };
  }

  // Update employee details
  async updateEmployee(
    employee: any,
    updateEmployeeDto: UpdateEmployeeDto,
    actor: any,
  ) {
    if (
      updateEmployeeDto.salary === undefined &&
      updateEmployeeDto.roleId === undefined
    ) {
      throw new BadRequestException('Salary or roleId is required.');
    }

    const before = {
      salary: employee.salary,
      roleId: employee.role?.id,
      roleName: employee.role?.name,
    };

    const { emp_id, emp_name, emp_email, emp_salary, role } =
      await this.businessHelper.updateEmployee(employee, updateEmployeeDto);

    const after = {
      salary: emp_salary,
      roleId: role.id,
      roleName: role.name,
    };

    await this.activityService.logFieldChanges(
      {
        action: ActivityAction.UPDATED,
        module: 'business',
        entityType: 'Employee',
        entityId: emp_id,
        entityName: emp_name,
        actor,
        businessId: actor.business.business_id,
        metadata: {
          employeeEmail: emp_email,
        },
      },
      before,
      after,
      ['salary', 'roleId', 'roleName'],
    );

    return {
      message: 'Employee updated successfully.',
      employee: {
        userId: emp_id,
        name: emp_name,
        email: emp_email,
        salary: emp_salary,
        role: toRoleResponse(role),
      },
    };
  }

  // Remove employee from business
  async removeEmployeeFromBusiness(employee: any, actor: any) {
    const before = {
      userId: employee.user_id,
      name: employee.name,
      email: employee.email,
      businessId: employee.business?.business_id,
      roleId: employee.role?.id,
      roleName: employee.role?.name,
    };

    const { emp_id, emp_name, emp_email } =
      await this.businessHelper.removeEmployeeFromBusiness(employee.email);

    await this.activityService.log({
      action: ActivityAction.DELETED,
      module: 'business',
      entityType: 'Employee',
      entityId: employee.user_id,
      entityName: before.name,
      actor,
      businessId: actor.business.business_id,
      before,
      after: {
        userId: emp_id,
        name: emp_name,
        email: emp_email,
        businessId: null,
        roleId: null,
      },
      description: `${actor.name} removed ${before.name} from ${actor.business.name}`,
    });

    return {
      message: 'Employee removed from business successfully.',
      removedEmployee: {
        userId: emp_id,
        name: emp_name,
        email: emp_email,
      },
    };
  }
}
