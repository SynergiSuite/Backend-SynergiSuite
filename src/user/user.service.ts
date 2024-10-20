import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';
import { EmailDto } from 'src/mailer/dto/email.dto';
import { VerificationResponseDto } from './dto/response.dto';
import { User } from './entities/user.entity';
import { EmailService } from 'src/mailer/email.service';
import { RedisService } from 'src/redis/redis.service';
import { UpdatePasswordDto } from './dto/update-password.dto';


@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailerService: EmailService,
    private readonly redisService: RedisService
  ) { }

  async findAll(): Promise<User[]> | undefined {
    return await this.userRepository.find()
  }

  async findOne(id: number): Promise<User> {
    return await this.userRepository.findOne({ where: { user_id: id } });
  }

  async findByEmail(email: string): Promise<User> | undefined {
    return await this.userRepository.findOne({ where: { email } });
  }

  async updateName(data: any, updateUserDto: UpdateUserDto): Promise<VerificationResponseDto> {
    try {
      await this.userRepository.update({ email: data.email }, { name: updateUserDto.updatedName });
      return {
        message: "Name updated successfully!",
        name: updateUserDto.name,
        email: updateUserDto.email
      };
    } catch (error) {
      return {
        message: error.message,
        status: HttpStatus.BAD_REQUEST
      };
    }
  }

  async requestEmailChangeCode(data: UpdateUserDto, reqObject: any): Promise<VerificationResponseDto> {
    try {
      const resp = await this.requestVerfication(reqObject.email, { to: data.updatedEmail, subject: "Change Email Request", text: "" });
      if (resp.status == 200) {
        {
          message: "Please verify your new email"
        };
      } else {
        return { error: "Update Email Failed" };
      }
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async requestVerfication(oldEmail: string, obj: EmailDto): Promise<VerificationResponseDto> {
    try {
      const otp = await this.redisService.generateUpdateEmailCode(obj.to, oldEmail);
      obj.text = "Your verification code is " + otp;
      await this.mailerService.sendVerificationEmail(obj);
      return {
        message: "email sent for verfication",
        status: HttpStatus.OK
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async requestEmailVerification(data: any) {
    try {
      const otp = await this.redisService.generateVerificationCode(data.email)
      const obj = { to: data.email, subject: "Please verify Your Email!", text: "Your email verification code is " + otp + " This code is only valid for 3 hours." }
      await this.mailerService.sendVerificationEmail(obj)
      return {
        message: "Email sent for verification.",
        status: HttpStatus.OK
      }
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
    }
  }

  async updatePassword(data: any, dataObj: UpdatePasswordDto) {
    const user = await this.findByEmail(data.email)
    const validate = await bcrypt.compare(dataObj.oldPassword, user.password_hash)
    if(!validate) {
      throw new UnauthorizedException('Previous Password is invalid')
    }

    try {
      const hashedPassword = await bcrypt.hash(dataObj.updatedPassword, 10)
      await this.userRepository.update({email: data.email}, {password_hash: hashedPassword})

      return {
        message: "Password has been updated successfully!",
        status: HttpStatus.OK
      }
    } catch (error) {
      throw new HttpException({message: error.message}, 400)
    }
  }

  async requestForgotPasswordCode(email: string) {
    const otp = await this.redisService.generateVerificationCode(email);
    const obj = {to: email, subject: "Did you forgot your password?", text: "We got you covered. Enter this coed to change your password " + otp };

    try {
      await this.mailerService.sendVerificationEmail(obj);
      return {
        message: "Email has been sent. Check your inbox!",
        status: HttpStatus.CONTINUE
      }
    } catch (error) {
      return {
        message: error.message,
        status: HttpStatus.BAD_REQUEST
      }
    }
  }

  remove(id: number) {
    try {
      const deletedUser = this.userRepository.delete(id)
      return {
        message: "Account removed successfully!",
        status: HttpStatus.OK
      }
    } catch (error) {
      throw new HttpException("Unable to perofrm this action!", HttpStatus.NOT_ACCEPTABLE);
    }
  }

  async isUserverified(email: string) {
    const user = await this.findByEmail(email);

    if (!user.is_Verified) {
      return false;
    };

    return true;
  }
}

