import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm'
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { EmailDto } from 'src/mailer/dto/email.dto';
import { VerificationResponseDto } from './dto/response.dto';
import { User } from './entities/user.entity';
import { EmailService } from 'src/mailer/email.service';


@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailerService: EmailService
  ) { }

  async findAll(): Promise<User[]> | undefined {
    return await this.userRepository.find()
  }

  async checkVerification(email: string): Promise<VerificationResponseDto> | undefined {
    const isUserVerfied = await this.userRepository.findOne({ where: { email: email } })
    if (isUserVerfied.is_Verified) {
      return {
        message: "Account is Verified",
        isVerified: isUserVerfied.is_Verified,
        user: isUserVerfied
      }
    } else {
      return {
        message: "Account is not Verified",
        isVerified: isUserVerfied.is_Verified,
        user: isUserVerfied
      }
    }
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { user_id: id } })
    return user
  }

  async findByEmail(email: string): Promise<User> | undefined {
    const user = await this.userRepository.findOne({ where: { email } })
    return user
  }

  async updateName(data: any, updateUserDto: UpdateUserDto): Promise<VerificationResponseDto> {
    const updatedUser = await this.userRepository.update({ email: data.email }, { name: updateUserDto.name })
    return {
      message: "Name updated successfully!",
      name: updateUserDto.name,
      email: updateUserDto.email
    }
  }

  async updateEmail(data: UpdateUserDto, reqObject: any): Promise<VerificationResponseDto> {
    try {
      const resp = await this.requestVerfication({ to: reqObject.email, subject: "Change Email Request", text: "" });
      console.log(resp);
      if (resp.status == 200) {
        await this.userRepository.update({ email: reqObject.email }, { email: data.updatedEmail });
        return { isVerified: true };
      } else {
        return { error: "Update Email Failed" };
      }
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  //   const passwordVerification = await this.verifyPassword(data, updateUserDto)
  //   if (!passwordVerification) {
  //     return {
  //       message: "Invalid credentials. Please enter valid password."
  //     }
  //   }
  //   try {
  //     const updatedUser = await this.userRepository.update({email: updateUserDto.email}, {email: updateUserDto.new_email, is_Verified: false})
  //     return {
  //       message: "Email updated successfully!"
  //     }
  //   } catch (error) {
  //     return {
  //       message: "An error occured: " + error.message
  //     }
  //   } 
  // }

  // async updatePassword(data: any, updateUserDto: UpdateUserDto): Promise<VerificationResponseDto> {
  //   const user = await this.findByEmail(data.email);
  //   if (!user) {
  //     return { message: "User not found", email: data.email };
  //   }

  //   const isPasswordValid = await bcrypt.compare(updateUserDto.old_password, user.password_hash);
  //   if (!isPasswordValid) {
  //     return { message: "Previous password is incorrect", email: data.email};
  //   }

  //   try {
  //     const hashedNewPassword = await bcrypt.hash(updateUserDto.new_password, 10);
  //     await this.userRepository.update({ user_id: user.user_id }, { password_hash: hashedNewPassword });

  //     return { message: "Password updated successfully!", email: updateUserDto.email, status: HttpStatus.OK };
  //   } catch (error) {
  //     throw new HttpException("Unable to update password", HttpStatus.BAD_REQUEST)
  //       }
  // }

  async requestVerfication(obj: EmailDto): Promise<VerificationResponseDto> {
    try {
      console.log(obj)
      const code = Math.floor(1000 + Math.random() * 9000);
      obj.text = "Your verification code is " + code;
      await this.mailerService.sendVerificationEmail(obj);
      return {
        message: "email sent",
        status: HttpStatus.OK
      }
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // async setVerification(updateUserDto: UpdateUserDto): Promise<VerificationResponseDto> {
  //   try {
  //     const user = await this.findByEmail(updateUserDto.email)
  //     const userCode = user.verification_code
  //     if (userCode === updateUserDto.code) {
  //       await this.userRepository.update({email: updateUserDto.email}, {is_Verified: true})
  //       return {
  //         message: "Account verified successfully",
  //         user,
  //         status: HttpStatus.ACCEPTED
  //       }
  //     }
  //   } catch (error) {
  //     return {
  //       message: "Invalid request",
  //       error: error.message,
  //       status: HttpStatus.BAD_REQUEST
  //     }
  //   }
  // }

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

  // async verifyPassword(data: any, updateUserDto: UpdateUserDto): Promise<Boolean | VerificationResponseDto>  {
  //   const user = await this.findByEmail(data.email)
  //   try {
  //     const verifyPassword = await bcrypt.compare(updateUserDto.old_password, user.password_hash)
  //     if (!verifyPassword) {
  //       return false
  //     }
  //     return {
  //       user: user
  //     }
  //   } catch (error) {
  //     throw new HttpException("Invalid Credentials", HttpStatus.BAD_REQUEST);

  //   }
  // }
}

