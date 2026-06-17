import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { PayloadDto } from './dto/payload.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { VerificationResponseDto } from '../user/dto/response.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly userService: UserService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  // Signup Function
  async create(createUserDto: CreateUserDto): Promise<VerificationResponseDto> {
    this.logger.log(`Starting to create user: ${createUserDto.email}`);

    this.logger.log(`Hashing password for user: ${createUserDto.email}`);
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const payload = { email: createUserDto.email };
    this.logger.log(`Generating token for user: ${createUserDto.email}`);
    const token = this.jwtService.sign(payload);
    this.logger.log(`Token generated for user: ${createUserDto.email}`);

    const user = this.userRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      password_hash: hashedPassword,
      token_digest: token,
    });

    try {
      this.logger.log(`Inserting user into database: ${createUserDto.email}`);
      await this.userRepository.insert(user);
      this.logger.log(`User created successfully: ${createUserDto.email}`);
      return {
        access_token: token,
        email: user.email,
        user_id: user.user_id,
        name: user.name,
        isVerified: user.is_Verified,
      };
    } catch (error) {
      this.logger.warn(`Failed to create user: ${createUserDto.email}`);
      this.logger.error(error.message);
      return { message: 'Unable to create user', error: error.message };
    }
  }

  // Login Function
  async validateSession({ email, password }: PayloadDto) {
    this.logger.log(`Starting to login user: ${email}`);

    const user = await this.userService.getUserWithBusiness(email);
    const validate = await bcrypt.compare(password, user.password_hash);

    if (user.is_Verified) {
      this.logger.log(`User is verified: ${email}`);
    } else {
      this.logger.warn(`User is not verified: ${email}`);
    }

    this.logger.log(`Validating user credentials: ${email}`);
    if (validate) {
      try {
        this.logger.log(`User credentials are validated: ${email}`);
        const payload = { email: email };
        const token = this.jwtService.sign(payload);
        this.logger.log(`Generating and updating token for user: ${email}`);
        const updateToken = await this.userRepository.update(
          { email: email },
          { token_digest: token },
        );

        if (!updateToken) {
          this.logger.warn(`Token was not updated for user: ${email}`);
          return {
            message: 'Some error occured',
            status: HttpStatus.NOT_ACCEPTABLE,
          };
        }

        this.logger.log(`User logged in successfully: ${email}`);
        if (user.business) {
          return {
            message: 'Logged in successfully',
            access_token: token,
            user_id: user.user_id,
            email: user.email,
            name: user.name,
            verified: user.is_Verified,
            business_name: user.business.name,
            business_id: user.business.business_id,
            role: user.role,
            business: true,
          };
        } else {
          return {
            message: 'Logged in successfully',
            access_token: token,
            user_id: user.user_id,
            email: user.email,
            name: user.name,
            verified: user.is_Verified,
            business: false,
          };
        }
      } catch (error) {
        this.logger.error(`User login failed: ${email}`);
        this.logger.error(error.message);
        throw new ForbiddenException(error.message);
      }
    } else {
      this.logger.error(`User login failed: ${email}`);
      this.logger.error('Invalid Credentails');
      throw new HttpException('Invalid Credentails', 401);
    }
  }

  // Verify Update Email Code Function
  async verifyUpdateEmailCode(code: string, userObject: any) {
    this.logger.log(
      `Starting to verify code for update email request: ${userObject.email}`,
    );
    const data = await this.getCodeFromRedis(userObject.email);
    if (!data) {
      this.logger.error(`No data found for this email: ${userObject.email}`);
      return { error: 'No data found for this email. Request for a new code.' };
    }
    this.logger.log(`Data found related to the email: ${userObject.email}`);
    console.log(code.toString());

    if (data.otp !== code.toString()) {
      this.logger.error(`Invalid code for the email: ${userObject.email}`);
      throw new UnauthorizedException('Invalid Code');
    }
    this.logger.log(`Code is valid for the email: ${userObject.email}`);

    this.logger.log(`Updating email for the user: ${userObject.email}`);
    const payload = { email: data.newEmail };
    const token = this.jwtService.sign(payload);
    this.logger.log(
      `Generating and updating token for user: ${userObject.email}`,
    );

    try {
      await this.userRepository.update(
        { email: userObject.email },
        { email: data.newEmail, is_Verified: true, token_digest: token },
      );
      await this.redisService.del(userObject.email);
      this.logger.log(`Email updated for the user: ${userObject.email}`);
      return {
        message: 'Email has been updated!',
        status: HttpStatus.OK,
        new_email: data.newEmail,
        access_token: token,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update email for the user: ${userObject.email}`,
      );
      this.logger.error(error.message);
      throw new HttpException(
        { error: error.message, message: 'Unable to update email' },
        400,
      );
    }
  }

  // Verify Email Function
  async verifyEmailCode(data: any, otp: string) {
    this.logger.log(`Starting to verify code for email request: ${data.email}`);

    this.logger.log(`Verifying data in Redis: ${data.email}`);
    const redisData = await this.getCodeFromRedis(data.email);
    if (!redisData) {
      this.logger.error(`No data found for this email: ${data.email}`);
      return { error: 'No data found for this email. Request for a new code.' };
    }
    this.logger.log(`Data found related to the email: ${data.email}`);

    this.logger.log(`Verifying code for the email: ${data.email}`);
    if (redisData.otp !== otp) {
      this.logger.error(`Invalid code for the email: ${data.email}`);
      throw new UnauthorizedException('Invalid Code');
    }
    this.logger.log(`Code is valid for the email: ${data.email}`);

    try {
      await this.userRepository.update(
        { email: data.email },
        { is_Verified: true },
      );
      await this.redisService.del(data.email);
      this.logger.log(`Email verified for the user: ${data.email}`);
      return {
        message: 'User successfully verified',
        isVerified: true,
      };
    } catch (error) {
      this.logger.error(`Failed to verify email for the user: ${data.email}`);
      this.logger.error(error.message);
      throw new HttpException(
        { error: error.message, message: 'Unable to verify email' },
        400,
      );
    }
  }

  // Forgot Password Function
  async forgotPassword(data: ForgotPasswordDto) {
    this.logger.log(`Starting to forgot password for user: ${data.email}`);
    const redisData = await this.getCodeFromRedis(data.email);
    if (!redisData) {
      this.logger.error(`No data found for this email: ${data.email}`);
      throw new HttpException(
        'Could not find any data on this email. Please try again later',
        400,
      );
    }
    this.logger.log(`Data found related to the email: ${data.email}`);
    this.logger.log(`Verifying code for the email: ${data.email}`);
    if (redisData.otp !== data.userCode.toString()) {
      this.logger.error(`Invalid code for the email: ${data.email}`);
      throw new HttpException('Invalid Code', 401);
    }
    this.logger.log(`Code is valid for the email: ${data.email}`);

    const user = await this.userService.findByEmail(data.email);
    const validate = await bcrypt.compare(
      data.updatedPassword,
      user.password_hash,
    );
    if (validate) {
      this.logger.error(
        `New password cannot be same as old password for the email: ${data.email}`,
      );
      throw new HttpException(
        'New password cannot be same as old password.',
        HttpStatus.BAD_REQUEST,
      );
    }
    this.logger.log(`New password is valid for the email: ${data.email}`);
    try {
      this.logger.log(`Updating password for the user: ${data.email}`);
      const hashedPassword = await bcrypt.hash(data.updatedPassword, 10);
      await this.userRepository.update(
        { email: data.email },
        { password_hash: hashedPassword },
      );
      await this.redisService.del(data.email);
      this.logger.log(`Password updated for the user: ${data.email}`);
      return {
        message: 'Password has been updated. Log in now.',
        status: HttpStatus.OK,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update password for the user: ${data.email}`,
      );
      this.logger.error(error.message);
      throw new HttpException(error.emssage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  // Refresh token
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

  // Logout Function
  async logout(data: any) {
    this.logger.log(`Starting to logout user: ${data.email}`);
    try {
      this.logger.log(`Updating token for user: ${data.email}`);
      await this.userRepository.update(
        { email: data.email },
        { token_digest: null },
      );
      this.logger.log(`Token updated for user: ${data.email}`);
      this.logger.log(`User logged out successfully: ${data.email}`);
      return {
        message: 'Logged out Successfully!',
        status: HttpStatus.OK,
      };
    } catch (error) {
      this.logger.error(`Failed to logout user: ${data.email}`);
      this.logger.error(error.message);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Helper Functions Below
  async validate(payload: any) {
    return { email: payload.email, iat: payload.iat, exp: payload.exp };
  }

  async getCodeFromRedis(email: string) {
    const data = await this.redisService.get(email);
    return JSON.parse(data);
  }
}
