import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException, RequestTimeoutException } from '@nestjs/common';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { RolesService } from 'src/roles/roles.service';
import { RedisService } from 'src/redis/redis.service';
import { Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { UserService } from 'src/user/user.service';
import { CategoryService } from 'src/category/category.service';
import { InviteDto } from './dto/send-invitation.dto';
import { EmailService } from '../mailer/email.service';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private userService: UserService,
    private categoryService: CategoryService,
    private roleService: RolesService,
    private redisService: RedisService,
    private mailerService: EmailService,
  ) {}

  async create(email: any, createBusinessDto: CreateBusinessDto) {
    const user = await this.userService.userBusiness(email)
    const category = await this.categoryService.findOne(createBusinessDto.category_id)
    const record = await this.businessRepository.create({
      name: createBusinessDto.name,
      number_of_employees: createBusinessDto.number_of_employees,
      category,
    })

    try {
      const savedBusiness = await this.businessRepository.save(record)
      const updated_user = await this.userService.updateRole(1, user, savedBusiness)
      return {
        business_name: createBusinessDto.name,
        updated_user,
        message: 'Business registered successfully!'
      };
    } catch (error) {
      throw new BadRequestException(error.message)
    }
  };

  async sendInvitation(reqObj: any, inviteDto: InviteDto) {
    const invitedUser = await this.userService.findByEmail(inviteDto.email)
    const user = await this.userService.findUserAndBusinessByEmail(reqObj.email);
    const role = await this.roleService.findOne(inviteDto.role_id)
    if (!invitedUser || !role){
      throw new BadRequestException('No account found linked with this mail. Only verified users can be invited.')
    }

    const emailObj = {
      to: invitedUser.email,
      subject: "Invitation to join an organization",
      text: "Continue with this token ",
      invited_by: user.name,
      invited_bys_role: user.role.name,
      business: user.business.name,
      name: invitedUser.name,
      heading: "You were invited to join an organization"
    }

    try {
      const token = await this.redisService.generateTokenForInvitation(invitedUser.email, reqObj.email, role.id );
      await this.mailerService.sendInvitationEmail(emailObj, token);
      
      return {
        message: "Invitation token was sent out successfully.",
        invitation_token: token,
      };
    } catch (error) {
      throw new RequestTimeoutException("Something went wrong: " + error.message)
    }
  };

  async acceptInvitation(dataObj: any, token: string){
    try {
      const data = await this.getDataFromRedis(token);
      if (!data){
        throw new BadRequestException("Invalid token was provided.");
      };
  
      if (data.invited != dataObj.email){
        throw new HttpException("This token is not valid for this user.", HttpStatus.UNAUTHORIZED);
      };
      const invitedUser = await this.userService.setInvitedUser(dataObj.email, data.invited_by, data.invited_as);
      await this.removeDataFromRedis(token)

      return {message: "Organization joined successfully.", invitedUser};
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      throw new InternalServerErrorException("Something went wrong: " + error.message);
    };
  };

  async getDataFromRedis(key: string){
    const data = await this.redisService.get(key);
    return JSON.parse(data);
  };

  async removeDataFromRedis(key: string){
    return await this.redisService.del(key);
  };

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
}
