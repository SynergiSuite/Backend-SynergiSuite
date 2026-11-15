import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';
import { VerificationResponseDto } from './dto/response.dto';
import { User } from './entities/user.entity';
import { EmailService } from '../mailer/email.service';
import { RedisService } from '../redis/redis.service';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { Logger } from '@nestjs/common';
import { UserHelper } from './user.helper';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    private readonly userHelper: UserHelper,
    private readonly mailerService: EmailService,
    private readonly redisService: RedisService,
  ) {}

  // Find all users
  async findAll(): Promise<User[]> | undefined {
    return this.userHelper.findAll();
  }

  // This function change the name of the user
  async updateName(
    data: any,
    updateUserDto: UpdateUserDto,
  ): Promise<VerificationResponseDto> {
    try {
      await this.userHelper.updateUserOnDemand(data.email, {
        name: updateUserDto.updatedName,
      });
      return {
        name: updateUserDto.name,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // Email verification
  async requestEmailVerification(data: any) {
    this.logger.log(
      `Initializing email verification request for user: ${data.email}`,
    );
    const user = await this.userHelper.findByEmail(data.email);
    try {
      const otp = await this.redisService.generateVerificationCode(data.email);
      const obj = {
        to: data.email,
        subject: 'Please verify Your Email!',
        text: 'Your email verification code is ' + otp,
        name: user.name,
        heading: 'Lets verify your email',
      };

      await this.mailerService.sendVerificationEmail(obj);
      return {
        message: 'Email sent for verification.',
      };
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to user: ${data.email} ${error.message}`,
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  // Change Password
  async updatePassword(data: any, dataObj: UpdatePasswordDto) {
    const user = await this.userHelper.findByEmail(data.email);
    const validate = await bcrypt.compare(
      dataObj.oldPassword,
      user.password_hash,
    );
    if (!validate) {
      throw new UnauthorizedException('Previous Password is invalid');
    }

    try {
      const hashedPassword = await bcrypt.hash(dataObj.updatedPassword, 10);
      await this.userHelper.updateUserOnDemand(data.email, {
        password_hash: hashedPassword,
      });

      return {
        message: 'Password has been updated successfully!',
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // Request to change password(Forgot Password)
  async requestForgotPasswordCode(email: string) {
    const user = await this.userHelper.findByEmail(email);
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
      };
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to user: ${email} ${error.message}`,
      );
      throw new InternalServerErrorException(error.message);
    }
  }
}
