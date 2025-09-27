import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';
import { EmailDto } from 'src/mailer/dto/email.dto';
import { VerificationResponseDto } from './dto/response.dto';
import { User } from './entities/user.entity';
import { EmailService } from 'src/mailer/email.service';
import { RedisService } from 'src/redis/redis.service';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { RolesService } from 'src/roles/roles.service';
import { Business } from 'src/business/entities/business.entity';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from 'src/roles/entities/role.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailerService: EmailService,
    private readonly redisService: RedisService,
    private roleService: RolesService,
    private readonly jwtService: JwtService,
  ) {}

  async findAll(): Promise<User[]> | undefined {
    return await this.userRepository.find();
  }

  async findOne(id: number): Promise<User> {
    return await this.userRepository.findOne({ where: { user_id: id }, relations: ['business', 'role'] });
  }

  async findByEmail(email: string): Promise<User> | undefined {
    return await this.userRepository.findOne({ where: { email } });
  }

  async findUserAndBusinessByEmail(email: string): Promise<User> | undefined {
    return await this.userRepository.findOne({where: {email}, relations: ['business', 'role']})
  }

  async updateName(
    data: any,
    updateUserDto: UpdateUserDto,
  ): Promise<VerificationResponseDto> {
    try {
      await this.userRepository.update(
        { email: data.email },
        { name: updateUserDto.updatedName },
      );
      return {
        message: 'Name updated successfully!',
        name: updateUserDto.name,
        email: updateUserDto.email,
      };
    } catch (error) {
      return {
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
      };
    }
  }

  async requestEmailChangeCode(
    data: UpdateUserDto,
    reqObject: any,
  ): Promise<VerificationResponseDto> {
    try {
      const resp = await this.requestVerfication(reqObject.email, {
        to: data.updatedEmail,
        subject: 'Change Email Request',
        text: '',
        name: '',
        heading: '',
      });
      if (resp.status == 200) {
        return {
          message: 'Please verify your new email',
        };
      } else {
        return { error: 'Update Email Failed' };
      }
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async requestVerfication(
    oldEmail: string,
    obj: EmailDto,
  ): Promise<VerificationResponseDto> {
    const user = await this.findByEmail(oldEmail);
    try {
      const otp = await this.redisService.generateUpdateEmailCode(
        obj.to,
        oldEmail,
      );
      obj.text = 'Your verification code is ' + otp;
      obj.name = user.name;
      obj.heading = 'Lets change your email';
      await this.mailerService.sendVerificationEmail(obj);
      return {
        message: 'email sent for verfication',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Email verification
  async requestEmailVerification(data: any) {
    this.logger.log(`Requesting email verification for user: ${data.email}`);
    const user = await this.findByEmail(data.email);
    this.logger.log(`User found: ${user.email}`);
    try {
      this.logger.log(`Generating verification code for user: ${data.email}`);
      const otp = await this.redisService.generateVerificationCode(data.email);
      this.logger.log(`Verification code generated for user: ${data.email}`);
      const obj = {
        to: data.email,
        subject: 'Please verify Your Email!',
        text: 'Your email verification code is ' + otp,
        name: user.name,
        heading: 'Lets verify your email',
      };

      this.logger.log(`Sending verification email to user: ${data.email}`);
      await this.mailerService.sendVerificationEmail(obj);
      this.logger.log(`Verification email sent to user: ${data.email}`);
      return {
        message: 'Email sent for verification.'
      };
    } catch (error) {
      this.logger.error(`Failed to send verification email to user: ${data.email}`);
      this.logger.error(error.message);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async updatePassword(data: any, dataObj: UpdatePasswordDto) {
    const user = await this.findByEmail(data.email);
    const validate = await bcrypt.compare(
      dataObj.oldPassword,
      user.password_hash,
    );
    if (!validate) {
      throw new UnauthorizedException('Previous Password is invalid');
    }

    try {
      const hashedPassword = await bcrypt.hash(dataObj.updatedPassword, 10);
      await this.userRepository.update(
        { email: data.email },
        { password_hash: hashedPassword },
      );

      return {
        message: 'Password has been updated successfully!',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HttpException({ message: error.message }, 400);
    }
  }

  async requestForgotPasswordCode(email: string) {
    const user = await this.findByEmail(email);
    const otp = await this.redisService.generateVerificationCode(email);
    const obj = {
      to: email,
      subject: 'Did you forgot your password?',
      text:
        'We got you covered. Enter this code to change your password ' + otp,
      name: user.name,
      heading: 'Lets retrieve your account.',
    };

    try {
      await this.mailerService.sendVerificationEmail(obj);
      return {
        message: 'Email has been sent. Check your inbox!',
        status: HttpStatus.CONTINUE,
      };
    } catch (error) {
      return {
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
      };
    }
  }

  async remove(id: number) {
    try {
      await this.userRepository.delete(id);
      return {
        message: 'Account removed successfully!',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HttpException(
        'Unable to perofrm this action!',
        HttpStatus.NOT_ACCEPTABLE,
      );
    }
  }

  // Helper Function
  async isUserverified(email: string) {
    const user = await this.findByEmail(email);
    if (!user.is_Verified) {
      return false;
    }
    return true;
  }

  // Helper Function
  async isUserBusinessRegistered(email: string){
    const user = await this.userRepository.findOne({where: {email: email}, relations: ['business']})
    if (user.business) {
      return false;
    }
    return true;
  }

  // Helper Function
  async findUserWithBusiness(obj: any){
    const user = await this.userRepository.findOne(
      {where: {email: obj.email},
      relations: ['business'],
    })
    return user;
  }

  // Helper Function
  async getUserWithBusiness(email: string){
    const user = await this.userRepository.findOne(
      {where: {email: email},
      relations: ['business', 'role'],
    })
    return user;
  }

  // Helper Function
  async updateRole(role_id: number, user: User, business: Business) {
    const role = await this.roleService.findOne(role_id) 
    user.role = role
    user.business = business
    return await this.userRepository.save(user)
  }

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

  // Helper Function (Guard)
  async userHasBusinessCheck(email: string){
    const user = await this.userRepository.findOne({where: {email: email}, relations: ['business', 'role']})
    if (user.business) {
      return true;
    }
    return false;
  };

  // Helper Function
  async getEmployeesByBusinessId(businessId: number) {
    const employees = await this.userRepository.find({
      where: { business: { business_id: businessId } },
      select: ['user_id', 'name', 'email', 'token_digest' ],  
      relations: ['role', 'business'],          
    });

    return employees.map(user => {
      let tokenExpiry: Date | null = null;
      let isExpired = null;

      if (user.token_digest) {
        try {
          // Decode without verifying (just extract payload)
          const decoded = this.jwtService.decode(user.token_digest) as { exp?: number };

          if (decoded?.exp) {
            tokenExpiry = new Date(decoded.exp * 1000); // exp is in seconds
            isExpired = Date.now() >= decoded.exp * 1000;
          }
        } catch (e) {
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
  }

  async setInvitedUser(invited: string, invitedBy: string, roleId: number){
    try {
      const invitedUser = await this.findUserAndBusinessByEmail(invited);
      const invitingUser = await this.findUserAndBusinessByEmail(invitedBy);
      const role = await this.roleService.findOne(roleId);
      invitedUser.business = invitingUser.business;
      invitedUser.role =  role;
      return await this.userRepository.save(invitedUser);

    } catch (error) {
      throw new HttpException("Something went wrong: " + error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  };
}
