import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PayloadDto } from './dto/payload.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from 'src/user/user.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { VerificationResponseDto } from 'src/user/dto/response.dto';
import { RedisService } from 'src/redis/redis.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly userService: UserService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<VerificationResponseDto> {
    const hashedPassword = await bcrypt.hash(createUserDto.password_hash, 10);
    const payload = { email: createUserDto.email };
    const token = this.jwtService.sign(payload);
    const user = this.userRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      password_hash: hashedPassword,
      token_digest: token,
    });
    try {
      await this.userRepository.insert(user);
      return {
        access_token: token,
        user: user,
      };
    } catch (error) {
      return { message: 'Unable to create user', error: error.message };
    }
  }

  async validateSession({ email, password_hash }: PayloadDto) {
    const user = await this.userService.getUserBusiness(email);
    const validate = await bcrypt.compare(password_hash, user.password_hash);
    const isVerified = user.is_Verified;
    let flag = false;
    if (isVerified) {
      flag = true;
    }
    if (validate) {
      try {
        const payload = { email: email };
        const token = this.jwtService.sign(payload);
        const updateToken = await this.userRepository.update(
          { email: email },
          { token_digest: token },
        );
        if (!updateToken)
          return {
            message: 'Some error occured',
            status: HttpStatus.NOT_ACCEPTABLE,
          };
        return {
          verified: flag,
          message: 'Logged in successfully',
          user,
          access_token: token,
        };
      } catch (error) {
        throw new ForbiddenException(error.message);
      }
    } else {
      throw new HttpException('Invalid Credentails', 401);
    }
  }

  async validate(payload: any) {
    return { email: payload.email, iat: payload.iat, exp: payload.exp };
  }

  async getCodeFromRedis(email: string) {
    const data = await this.redisService.get(email);
    return JSON.parse(data);
  }

  async verifyUpdateEmailCode(code: number, userObject: any) {
    const data = await this.getCodeFromRedis(userObject.email);
    if (!data)
      return { error: 'No data found for this email. Request for a new code.' };

    if (data.otp !== code.toString()) {
      throw new UnauthorizedException('Invalid Code');
    }

    const payload = { email: data.newEmail };
    const token = this.jwtService.sign(payload);

    try {
      await this.userRepository.update(
        { email: userObject.email },
        { email: data.newEmail, is_Verified: true, token_digest: token },
      );
      await this.redisService.del(userObject.email);
      return {
        message: 'Email has been updated!',
        status: HttpStatus.OK,
        new_email: data.newEmail,
        access_token: token,
      };
    } catch (error) {
      throw new HttpException(
        { error: error.message, message: 'Unable to update email' },
        400,
      );
    }
  }

  async verifyEmailCode(data: any, userCode: number) {
    const redisData = await this.getCodeFromRedis(data.email);
    if (!redisData)
      return { error: 'No data found for this email. Request for a new code.' };
    if (redisData.otp !== userCode.toString()) {
      throw new UnauthorizedException('Invalid Code');
    }
    try {
      await this.userRepository.update(
        { email: data.email },
        { is_Verified: true },
      );
      await this.redisService.del(data.email);
      return {
        message: 'User successfully verified',
        status: HttpStatus.ACCEPTED,
        email: data.email,
      };
    } catch (error) {
      throw new HttpException(
        { error: error.message, message: 'Unable to verify email' },
        400,
      );
    }
  }

  async forgotPassword(data: ForgotPasswordDto) {
    const redisData = await this.getCodeFromRedis(data.email);
    if (!redisData)
      throw new HttpException(
        'Could not find any data on this email. Please try again later',
        400,
      );

    if (redisData.otp !== data.userCode.toString())
      throw new HttpException('Invalid Code', 401);

    const user = await this.userService.findByEmail(data.email);
    const validate = await bcrypt.compare(
      data.updatedPassword,
      user.password_hash,
    );
    if (validate)
      throw new HttpException(
        'New password cannot be same as old password.',
        HttpStatus.BAD_REQUEST,
      );

    try {
      const hashedPassword = await bcrypt.hash(data.updatedPassword, 10);
      await this.userRepository.update(
        { email: data.email },
        { password_hash: hashedPassword },
      );
      await this.redisService.del(data.email);
      return {
        message: 'Password has been updated. Log in now.',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HttpException(error.emssage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async generateRefreshAccessToken(token: string, userObj: any) {
    try {
      const existingToken = await this.userRepository.findOne({
        where: { token_digest: token },
      });
      const decode = await this.validate(token);
      if (!existingToken && decode.exp) {
        console.error('Token not found from db...');
      }

      const user = await this.userRepository.findOne({
        where: { email: userObj.email },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const refreshToken = this.jwtService.sign({ email: userObj.email });
      await this.userRepository.update(
        { email: userObj.email },
        { is_Verified: true, token_digest: refreshToken },
      );
      return refreshToken;
    } catch (error) {
      console.error(error.message);
    }
  }

  async logout(data: any) {
    try {
      await this.userRepository.update(
        { email: data.email },
        { token_digest: null },
      );
      return {
        message: 'Logged out Successfully!',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
