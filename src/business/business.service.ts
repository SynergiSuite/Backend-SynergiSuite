import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  RequestTimeoutException,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { Repository } from 'typeorm';
import { RolesService } from 'src/roles/roles.service';
import { RedisService } from 'src/redis/redis.service';
import { UserService } from 'src/user/user.service';
import { CategoryService } from 'src/category/category.service';
import { Business } from './entities/business.entity';
import { InviteDto } from './dto/send-invitation.dto';
import { EmailService } from '../mailer/email.service';

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private userService: UserService,
    private categoryService: CategoryService,
    private roleService: RolesService,
    private redisService: RedisService,
    private mailerService: EmailService,
  ) {}

  // Register New Business
  async create(email: any, createBusinessDto: CreateBusinessDto) {
    this.logger.log(`Initiating to register new business for user: ${email}`);
    const user = await this.userService.findUserWithBusiness(email);
    const category = await this.categoryService.findOne(
      createBusinessDto.category_id,
    );
    const record = await this.businessRepository.create({
      name: createBusinessDto.name,
      number_of_employees: createBusinessDto.number_of_employees,
      category,
    });

    try {
      this.logger.log(`Saving new business for user: ${email}`);
      const savedBusiness = await this.businessRepository.save(record);
      this.logger.log(`New business saved for user: ${email}`);
      await this.userService.updateRole(1, user, savedBusiness);
      return {
        message: 'Business registered successfully!',
        business_name: savedBusiness.name,
        business_id: savedBusiness.business_id
      };
    } catch (error) {
      this.logger.error(`Failed to register new business for user: ${email}`);
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
    }
  }

  // Send invitations
  async sendInvitation(reqObj: any, inviteDto: InviteDto) {
    this.logger.log(
      `Initiating to send invitation to: ${inviteDto.email} from ${reqObj.email}`,
    );
    const invitedUser = await this.userService.findByEmail(inviteDto.email);
    this.logger.log(`Invited user found: ${invitedUser.email}`);
    const user = await this.userService.findUserAndBusinessByEmail(
      reqObj.email,
    );
    const role = await this.roleService.findOne(inviteDto.role_id);
    if (!invitedUser || !role) {
      this.logger.warn(
        'No account found linked with this mail. Only verified users can be invited.',
      );
      throw new BadRequestException(
        'No account found linked with this mail. Only verified users can be invited.',
      );
    }

    const emailObj = {
      to: invitedUser.email,
      subject: 'Invitation to join an organization',
      text: 'Continue with this token ',
      invited_by: user.name,
      invited_bys_role: user.role.name,
      business: user.business.name,
      name: invitedUser.name,
      heading: 'You were invited to join an organization',
    };

    try {
      this.logger.log('Generating invitation token');
      const token = await this.redisService.generateTokenForInvitation(
        invitedUser.email,
        reqObj.email,
        role.id,
      );
      this.logger.log('Invitation token generated');
      this.logger.log('Sending invitation email');
      await this.mailerService.sendInvitationEmail(emailObj, token);
      this.logger.log('Invitation email sent');

      return {
        message: 'Invitation token was sent out successfully.',
        invitation_token: token,
      };
    } catch (error) {
      this.logger.error('Failed to send invitation email');
      this.logger.error(error.message);
      throw new RequestTimeoutException(
        'Something went wrong: ' + error.message,
      );
    }
  }

  // Accept invitations
  async acceptInvitation(dataObj: any, token: string) {
    this.logger.log(
      `Initiating to accept invitation for user: ${dataObj.email}`,
    );
    try {
      this.logger.log(`Fetching data from redis for token: ${token}`);
      const data = await this.getDataFromRedis(token);

      if (!data) {
        this.logger.error('No data found for this token');
        throw new BadRequestException('Invalid token was provided.');
      }
      this.logger.log(`Data fetched from redis for token: ${token}`);

      this.logger.log(
        `Checking if the token is valid for this user: ${dataObj.email}`,
      );
      if (data.invited != dataObj.email) {
        this.logger.error('This token is not valid for this user.');
        throw new HttpException(
          'This token is not valid for this user.',
          HttpStatus.UNAUTHORIZED,
        );
      }
      this.logger.log(`Token is valid for this user: ${dataObj.email}`);

      this.logger.log(`Setting invited user for user: ${dataObj.email}`);
      const invitedUser = await this.userService.setInvitedUser(
        dataObj.email,
        data.invited_by,
        data.invited_as,
      );

      this.logger.log(`Removing token from redis: ${token}`);
      await this.removeDataFromRedis(token);
      this.logger.log(`Token removed from redis: ${token}`);

      this.logger.log(
        `User joined organization successfully: ${dataObj.email}`,
      );
      return {
        message: 'Organization joined successfully.',
        business_id: invitedUser.business.business_id,
        business_name: invitedUser.business.name,
        role_id: invitedUser.role.id,
        role_name: invitedUser.role.name,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof HttpException
      ) {
        this.logger.error(error.message);
        throw error;
      }
      this.logger.error('Something went wrong: ' + error.message);
      throw new InternalServerErrorException(
        'Something went wrong: ' + error.message,
      );
    }
  }

  async getEmployees(data: any) {
    const user = await this.userService.getUserWithBusiness(data.email);
    const businessId = user.business.business_id;
    const employees = await this.userService.getEmployeesByBusinessId(
      businessId,
    );
    const registrationCount = await this.userService.registrationCounts(businessId);
    const business = await this.businessRepository.findOne({where: {business_id: businessId}, relations: ['projects']});
    const newProjectsThisMonth = this.newProjects(business); 
    const projectCount = business.projects.length;
    return {employees, projectCount, registrationCount, newProjectsThisMonth};
  }

  newProjects(business: any) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const newProjectsThisMonth = business.projects.filter(
      project => project.created_at >= firstDayOfMonth && project.created_at <= now
    ).length;

    return newProjectsThisMonth;
  }

  findAll() {
    return `This action returns all business`;
  }

  findOne(id: number) {
    return `This action returns a #${id} business`;
  }

  update(id: number, updateBusinessDto: UpdateBusinessDto) {
    return `This action updates a #${id} business`;
  }

  remove(id: number) {
    return `This action removes a #${id} business`;
  }

  // Helper Functions below

  async getDataFromRedis(key: string) {
    const data = await this.redisService.get(key);
    return JSON.parse(data);
  }

  async removeDataFromRedis(key: string) {
    return await this.redisService.del(key);
  }

  async getClientWithBusiness(id: number){
    return await this.businessRepository.findOne({where: {business_id: id}, relations: ['clients']});
  }

  async getBusiness(email: string){
    const user = await this.userService.findUserWithBusiness(email);
    const business = user.business;
    return business;
  }
}
