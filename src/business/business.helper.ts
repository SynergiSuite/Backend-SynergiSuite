import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateBusinessDto } from './dto/create-business.dto';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoryService } from 'src/category/category.service';
import { RolesService } from 'src/roles/roles.service';
import { UserHelper } from 'src/user/user.helper';
import { InviteDto } from './dto/send-invitation.dto';
import { RedisService } from 'src/redis/redis.service';
import { EmailService } from 'src/mailer/email.service';
import { Project } from 'src/projects/entities/project.entity';
import { TeamsService } from 'src/teams/teams.service';
import {
  ActivityAction,
  ActivityLog,
} from 'src/activity/entities/activity-log.entity';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class BusinessHelper {
  private readonly logger = new Logger(BusinessHelper.name);
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ActivityLog)
    private readonly activityRepository: Repository<ActivityLog>,
    private readonly categoryService: CategoryService,
    private readonly roleService: RolesService,
    private readonly userHelper: UserHelper,
    private readonly redisService: RedisService,
    private readonly mailerService: EmailService,
    private readonly teamService: TeamsService,
  ) {}

  // Helper Function to register a new function
  async create(email: string, createBusinessDto: CreateBusinessDto) {
    try {
      // Change Category later on
      const category = await this.categoryService.findOne(
        createBusinessDto.category_id,
      );
      const obj = await this.businessRepository.create({
        name: createBusinessDto.name,
        number_of_employees: createBusinessDto.number_of_employees,
        category: category,
      });
      const business = await this.businessRepository.save(obj);
      // Change this later on
      const roles =
        await this.roleService.createNewRolesForNewBusiness(business);
      const updateUserEntity = await this.userHelper.updateUserOnDemand(email, {
        role: roles.founder_role,
        business: business,
      });
      return { business, updateUserEntity };
    } catch (error) {
      this.logger.log(`Business creation failed for user: ${email}`);
      throw new InternalServerErrorException(error.message);
    }
  }

  // Helper Function to invite an employee.
  async inviteEmail(email: string, inviteDto: InviteDto) {
    let registered = true;
    try {
      const inviter = await this.userHelper.getUserWithBusinessDetail(email);
      const employee =
        await this.userHelper.getUserWithBusinessDetailWithoutException(
          inviteDto.email,
        );
      const role = await this.roleService.findOne(inviteDto.role_id);
      const token = await this.redisService.generateTokenForInvitation(
        inviteDto.email,
        inviter.name,
        role.id,
        inviter.business.business_id,
      );
      if (!employee) {
        registered = false;
        this.logger.warn(`The invited employee is not registered.`);
      }

      const obj = {
        to: inviteDto.email,
        subject: 'Invitation to join an organization',
        text: 'Continue with this token ',
        registered: registered,
        invited_by: inviter.name,
        invited_bys_role: inviter.role.name,
        business: inviter.business.name,
        name: employee?.name ?? 'Guest',
        heading: 'You were invited to join an organization',
      };
      const mailer = await this.mailerService.sendInvitationEmail(obj, token);
      if (!mailer)
        throw new InternalServerErrorException(
          `Invitation mail not sent to user: ${email}`,
        );
      return { token, registered, user: inviter, role };
    } catch (error) {
      this.logger.error(`Invitation mail not sent to user: ${email}`);
      throw new InternalServerErrorException(error.message);
    }
  }

  // Helper Function to accept invitation
  async acceptInvitation(email: string, token: string) {
    try {
      const data = JSON.parse(await this.redisService.get(token));
      if (!data) throw new NotFoundException('No data found.');
      if (
        data.invited?.toString().trim().toLowerCase() !==
        email.toString().trim().toLowerCase()
      )
        throw new BadRequestException('Invalid Request for user');
      const business = await this.findOneBusiness(data.business_id);
      let role: any;
      if (
        typeof data.invited_as === 'number' ||
        (!isNaN(Number(data.invited_as)) && typeof data.invited_as !== 'boolean')
      ) {
        role = await this.roleService.findOneForBusiness(
          Number(data.invited_as),
          business.business_id,
        );
      } else {
        const parsed = await this.roleService.findOneByBusiness(
          String(data.invited_as).toLowerCase(),
          business.business_id,
        );
        role = parsed?.role
          ? await this.roleService.findOne(parsed.role.id)
          : null;
      }
      if (!role) throw new NotFoundException(`Role not found for business.`);
      const updatedUser = await this.userHelper.setInvitedUser(
        email,
        business,
        role,
      );
      await this.redisService.del(token);
      return {
        user: updatedUser,
        business: business,
        role: updatedUser.role,
        client_id: data.client_id ?? null,
      };
    } catch (error) {
      this.logger.error(`Failed to accept invitation for user: ${email}`);
      throw new InternalServerErrorException(error.message);
    }
  }

  // Helper Function to get business employees
  async getEmployeesPaginayedAndFiltered(
    business_id: number,
    page: number,
    limit: number,
    search?: string,
  ) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    try {
      const [
        { employees, totalEmployees },
        registrationCount,
        projectCount,
        newProjectsThisMonth,
      ] = await Promise.all([
        this.userHelper.getPaginatedEmployees(business_id, search, page, limit),

        this.userHelper.registrationCounts(business_id),
        this.projectRepository.count({
          where: { business: { business_id: business_id } },
        }),
        this.projectRepository.count({
          where: {
            business: { business_id: business_id },
            created_at: MoreThanOrEqual(startOfMonth),
          },
        }),
      ]);

      return {
        employees,
        totalEmployees,
        registrationCount,
        projectCount,
        newProjectsThisMonth,
      };
    } catch (error) {
      this.logger.error(`Failed to get employees for business: ${business_id}`);
      throw new InternalServerErrorException(error.message);
    }
  }

  // Helper Function to find one business via id
  async findOneBusiness(id: number) {
    try {
      const business = await this.businessRepository.findOne({
        where: { business_id: id },
        relations: { category: true },
      });
      return business;
    } catch (error) {
      this.logger.error(`Business not found for id: ${id}`);
      throw new InternalServerErrorException(error.message);
    }
  }

  // Helper function to get all employees using business id
  async findAllEmployeesUsingBusinessId(business_id: number) {
    return await this.userHelper.getEmployeesByBusinessId(business_id);
  }

  // Helper function to get specific employee details
  async getSpecificEmployeeDetails(emp: any) {
    try {
      const [teamMemberships, completedTaskActivities, recentActivities] =
        await Promise.all([
          // A. Optimized Team Fetch (No Cartesian Task Explosion)
          await this.teamService.getTeamDetailsForUser(emp.user_id),

          // B. Bounded & Selected Task Activities
          // Change
          this.activityRepository.find({
            where: {
              businessId: emp.business_id,
              userId: emp.user_id,
              module: 'tasks',
              action: ActivityAction.UPDATED,
              fieldChanged: 'status',
              newValue: 'completed',
            },
            // Prevent fetching heavy description/log fields
            select: [
              'id',
              'entityId',
              'entityName',
              'oldValue',
              'newValue',
              'createdAt',
            ],
            order: { createdAt: 'DESC' },
            // Highly recommended: Add a limit so this doesn't infinitely grow over years
            take: 100,
          }),

          // C. Recent Activties (Already bounded by take: 50, but let's select specific fields)
          // Change
          this.activityRepository.find({
            where: { businessId: emp.business_id, userId: emp.user_id },
            select: [
              'id',
              'action',
              'module',
              'entityType',
              'entityId',
              'entityName',
              'fieldChanged',
              'oldValue',
              'newValue',
              'description',
              'createdAt',
            ],
            order: { createdAt: 'DESC' },
            take: 50,
          }),
        ]);

      const teams = teamMemberships.map((membership) => {
        const team = membership.team;
        const tasks = team.tasks ?? [];

        // Calculate without allocating new arrays via .filter()
        let completedTasksCount = 0;
        for (const task of tasks) {
          if (task.status === 'completed') completedTasksCount++;
        }

        return {
          teamId: team.id,
          name: team.name,
          description: team.description,
          leader: team.leader
            ? {
                userId: team.leader.user_id, // Ensure this maps to your actual column
                name: team.leader.name,
                email: team.leader.email,
              }
            : null,
          projects: (team.projects ?? []).map((project) => ({
            projectId: project.id,
            name: project.name,
            status: project.status,
            duration: project.duration,
          })),
          totalProjects: team.projects?.length ?? 0,
          totalTasks: tasks.length,
          completedTasks: completedTasksCount,
        };
      });

      return { teams, completedTaskActivities, recentActivities };
    } catch (error) {
      this.logger.error(
        `Failed to get specific employee details for user: ${emp.email}, Error: ${error.message}`,
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  // Helper function to update employee
  async updateEmployee(employee: any, updatedData: UpdateEmployeeDto) {
    try {
      const role = await this.roleService.findOne(updatedData.roleId);
      if (!role) {
        throw new NotFoundException(
          `Role not found for id: ${updatedData.roleId}`,
        );
      }
      const updateUser = await this.userHelper.updateUserOnDemand(
        employee.email,
        { role: role, salary: updatedData.salary },
      );
      return {
        emp_id: updateUser.user_id,
        emp_name: updateUser.name,
        emp_email: updateUser.email,
        emp_salary: updateUser.salary,
        role: updateUser.role,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update employee for user: ${employee.email}, Error: ${error.message}`,
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  // Helper function to remove employee
  async removeEmployeeFromBusiness(emp_email: string) {
    try {
      const updateUser = await this.userHelper.updateUserOnDemand(emp_email, {
        business: null,
        role: null,
      });
      return {
        emp_id: updateUser.user_id,
        emp_name: updateUser.name,
        emp_email: updateUser.email,
      };
    } catch (error) {
      this.logger.error(
        `Failed to remove employee for user: ${emp_email}, Error: ${error.message}`,
      );
      throw new InternalServerErrorException(error.message);
    }
  }
}
