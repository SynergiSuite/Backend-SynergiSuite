import { Between, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { User } from './entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { RolesService } from 'src/roles/roles.service';
import { Business } from 'src/business/entities/business.entity';

@Injectable()
export class UserHelper {
  private readonly logger = new Logger(UserHelper.name);
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly roleService: RolesService,
  ) {}

  findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  // This helper function creates new user.
  async createNewUser(
    name: string,
    email: string,
    password: string,
    token: string,
  ): Promise<User> {
    try {
      const user = await this.userRepository.create({
        name,
        email,
        token_digest: token,
        password_hash: password,
      });
      await this.userRepository.insert(user);
      return user;
    } catch (error) {
      this.logger.error(`Failed to create new user: ${email} ${error.message}`);
      throw new InternalServerErrorException('Failed to create user.');
    }
  }

  // Helper function to find user by email
  async findByEmail(email: string): Promise<User> | undefined {
    this.logger.log(`Finding user by email: ${email}`);
    try {
      const user = await this.userRepository.findOne({
        where: { email },
        relations: ['business', 'role', 'role.primary_role'],
      });
      this.logger.log(`User found: ${user.email}`);
      return user;
    } catch (error) {
      this.logger.error(
        `Failed to find user by email: ${email} ${error.message}`,
      );
      throw new NotFoundException('User with this email not found.');
    }
  }

  // Helper Function to find a user by id
  async findOne(id: number): Promise<User> {
    return await this.userRepository.findOne({
      where: { user_id: id },
      relations: ['business', 'role', 'role.primary_role'],
    });
  }

  // Helper function to get user with business detail
  async getUserWithBusinessDetail(email: string) {
    try {
      return await this.userRepository.findOne({
        where: { email: email },
        relations: ['business', 'role', 'role.primary_role'],
      });
    } catch (error) {
      this.logger.error(
        `Failed to find user with business detail: ${email} ${error.message}`,
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  // Helper function to get user with business detail without exception
  async getUserWithBusinessDetailWithoutException(email: string) {
    return await this.userRepository.findOne({
      where: { email: email },
      relations: ['business', 'role', 'role.primary_role'],
    });
  }

  // Helper function to update user on demand.
  async updateUserOnDemand(
    email: string,
    updateData: Partial<User>,
  ): Promise<User> {
    try {
      const user = await this.findByEmail(email);
      Object.assign(user, updateData);
      await this.userRepository.save(user);
      return user;
    } catch (error) {
      this.logger.error(
        `Failed to update user on demand: ${email} ${error.message}`,
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  // Helper function to find one user on demand.
  async findOneOnDemand(field: string, value: string) {
    try {
      const user = await this.userRepository.findOne({
        where: { [field]: value },
      });
      return user;
    } catch (error) {
      this.logger.error(
        `Failed to find user on demand: ${field} ${value} ${error.message}`,
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  // Helper function to find one user by ID.
  async findOneById(id: number) {
    try {
      const user = await this.userRepository.findOne({
        where: { user_id: id },
        relations: ['business', 'role', 'role.primary_role'],
      });
      return user;
    } catch (error) {
      this.logger.error(`Failed to find user by ID: ${id} ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
  }

  // Helper function to find if user is verified.
  async isUserVerified?(email: string): Promise<boolean> {
    try {
      const user = await this.findByEmail(email);
      return user.is_Verified;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // Helper function to check if user is active
  async isUserActive(email: string) {
    const user = await this.findByEmail(email);
    if (!user.business) {
      return false;
    }
    if (!user.role) {
      return false;
    }
    if (!user.is_Verified) {
      return false;
    }
    return true;
  }

  // Helper function to check if user has business; Check to remove
  async userHasBusinessCheck(email: string) {
    try {
      const user = await this.userRepository.findOne({
        where: { email: email },
        relations: ['business'],
      });
      if (user && user.business) return user.business;
      return false;
    } catch (error) {
      this.logger.error(
        `No user found linked with this email: ${email} ${error.message}`,
      );
      throw new NotFoundException(error.message);
    }
  }

  // Helper function to get all business employees by business ID
  async getEmployeesByBusinessId(businessId: number) {
    const employees = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.primary_role', 'primaryRole')
      .leftJoinAndSelect('user.business', 'business')
      .where('business.business_id = :businessId', { businessId })
      .andWhere(
        '(primaryRole.name IS NULL OR LOWER(primaryRole.name) != :clientRole)',
        {
          clientRole: 'client',
        },
      )
      .orderBy('user.name', 'ASC')
      .getMany();

    return employees.map((user) => {
      let tokenExpiry: Date | null = null;
      let isExpired = null;

      if (user.token_digest) {
        try {
          // Decode without verifying (just extract payload)
          const decoded = this.jwtService.decode(user.token_digest) as {
            exp?: number;
          };

          if (decoded?.exp) {
            tokenExpiry = new Date(decoded.exp * 1000); // exp is in seconds
            isExpired = Date.now() >= decoded.exp * 1000;
          }
        } catch {
          tokenExpiry = null;
          isExpired = true;
        }
      }

      return {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        tokenExpiry,
        isExpired,
      };
    });
  }

  // Helper function to get all business employees by business ID (Paginated)
  async getPaginatedEmployees(
    businessId: number,
    search?: string,
    page = 1,
    limit = 10,
  ) {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.primary_role', 'primaryRole')
      .leftJoinAndSelect('user.business', 'business')
      .where('business.business_id = :businessId', { businessId })
      .andWhere(
        '(primaryRole.name IS NULL OR LOWER(primaryRole.name) != :clientRole)',
        {
          clientRole: 'client',
        },
      );

    if (search?.trim()) {
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    const [users, totalEmployees] = await queryBuilder
      .orderBy('user.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const employees = users.map((user) => {
      let tokenExpiry: Date | null = null;
      let isExpired = null;

      if (user.token_digest) {
        try {
          const decoded = this.jwtService.decode(user.token_digest) as {
            exp?: number;
          };

          if (decoded?.exp) {
            tokenExpiry = new Date(decoded.exp * 1000);
            isExpired = Date.now() >= decoded.exp * 1000;
          }
        } catch {
          tokenExpiry = null;
          isExpired = true;
        }
      }

      return {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        business: user.business,
        tokenExpiry,
        isExpired,
      };
    });

    return { employees, totalEmployees };
  }

  // Helper Function to get count of fresh joined users in a buisness
  async registrationCounts(businessID: number) {
    const today = new Date();
    const firstDayOfWeek = new Date(today);
    firstDayOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
    firstDayOfWeek.setHours(0, 0, 0, 0);

    const newRegistrationsThisWeek = await this.userRepository.count({
      where: {
        business: { business_id: businessID },
        registration_date: Between(firstDayOfWeek, today),
      },
    });

    return newRegistrationsThisWeek;
  }

  // Helper function to set user as Invited to Business with specified Role
  async setInvitedUser(invited: string, business: Business, role: any) {
    try {
      return await this.updateUserOnDemand(invited, {
        business: business,
        role: role,
      });
    } catch (error) {
      this.logger.error(`Failed to set invited user: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
  }
}
