import { BadRequestException, HttpException, HttpStatus, Injectable, RequestTimeoutException } from '@nestjs/common';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { RolesService } from 'src/roles/roles.service';
import { RedisService } from 'src/redis/redis.service';
import * as crypto from 'crypto';
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
    const role = await this.roleService.findOne(inviteDto.role_id)
    if (!invitedUser || !role){
      throw new BadRequestException('No account found linked with this mail. Only verified users can be invited.')
    }
    const token = await crypto.randomBytes(32).toString('hex')
    const obj = {
      invited: invitedUser.email,
      invited_by: reqObj.email,
      invited_as: role.id 
    }
    const emailObj = {
      to: invitedUser.email,
      subject: "Invitation to join an organization",
      text: "Continue with this token" + token,
      name: invitedUser.name,
      heading: "You were invited to join an organization"
    }
    try {
      await this.redisService.setWithExpiration(token, obj, 3600)
      console.log("reached")
      await this.mailerService.sendInvitationEmail(emailObj) 
    } catch (error) {
      throw new RequestTimeoutException("something went wrong" + error.message)
    }
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
}
