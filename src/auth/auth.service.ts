import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PayloadDto } from './dto/payload.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { CreateUserDto } from '../user/dto/create-user.dto';
import {
  EmailVerificationResponse,
  LoginResponseDto,
  VerificationResponseDto,
} from '../user/dto/response.dto';
import { RedisService } from '../redis/redis.service';
import { toRoleParsedResponse } from '../roles/role-access';
import { UserHelper } from 'src/user/user.helper';
import { AuthHelper } from './auth.helper';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authHelper: AuthHelper,
    private readonly userHelper: UserHelper,
    private redisService: RedisService,
  ) {}

  // Signup Function
  async create(createUserDto: CreateUserDto): Promise<VerificationResponseDto> {
    this.logger.log(
      `Initializing sign up with payload: ${createUserDto.email}`,
    );

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const token = await this.authHelper.createToken(createUserDto.email);
    this.logger.log(`Token generated for user: ${createUserDto.email}`);

    try {
      const user = await this.userHelper.createNewUser(
        createUserDto.name,
        createUserDto.email,
        hashedPassword,
        token,
      );
      return {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        isVerified: user.is_Verified,
        access_token: token,
      };
    } catch (error) {
      this.logger.error(`Failed to create user: ${createUserDto.email}`);
      throw new InternalServerErrorException(error.message);
    }
  }

  // Login Function
  async validateSession({
    email,
    password,
  }: PayloadDto): Promise<LoginResponseDto> {
    this.logger.log(`Initializing login for user: ${email}`);
    const user = await this.userHelper.getUserWithBusinessDetail(email);

    const validate = await bcrypt.compare(password, user.password_hash);

    this.logger.log(`Validating credentials for user: ${email}`);
    if (validate) {
      try {
        const token = await this.authHelper.createToken(email);
        const updatedUser = await this.userHelper.updateUserOnDemand(email, {
          token_digest: token,
        });

        this.logger.log(
          `Login request completed successfully for user: ${email}`,
        );
        if (user.business) {
          return {
            access_token: token,
            user_id: updatedUser.user_id,
            email: updatedUser.email,
            name: updatedUser.name,
            verified: updatedUser.is_Verified,
            business_name: user.business.name,
            business_id: user.business.business_id,
            role: toRoleParsedResponse(updatedUser.role),
            business: true,
          };
        } else {
          return {
            access_token: token,
            user_id: updatedUser.user_id,
            email: updatedUser.email,
            name: updatedUser.name,
            verified: updatedUser.is_Verified,
            business: false,
          };
        }
      } catch (error) {
        this.logger.error(
          `Login request failed for user: ${email} ${error.message}`,
        );
        throw new InternalServerErrorException(error.message);
      }
    } else {
      this.logger.error(
        `Login request failed due to invalid credentials for user: ${email}`,
      );
      throw new UnauthorizedException('Invalid Credentials');
    }
  }

  // Verify Email Function
  async verifyEmailCode(
    data: any,
    otp: string,
  ): Promise<EmailVerificationResponse> {
    this.logger.log(`Initializing email verification for user: ${data.email}`);
    const redisData = await this.authHelper.getCodeFromRedis(data.email);

    if (!redisData) {
      this.logger.error(`No data found for this email: ${data.email}`);
      throw new NotFoundException(
        'No data found for this email. Request for a new code.',
      );
    }

    if (redisData.otp !== otp) {
      this.logger.error(`Invalid code for the email: ${data.email}`);
      throw new BadRequestException('Invalid Code');
    }

    try {
      await this.userHelper.updateUserOnDemand(data.email, {
        is_Verified: true,
      });
      await this.redisService.del(data.email);
      return {
        message: 'User successfully verified',
        isVerified: true,
      };
    } catch (error) {
      this.logger.error(
        `Email verification request failed for user: ${data.email} ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Email verification request failed for user',
      );
    }
  }

  // Forgot Password Function
  async forgotPassword(data: ForgotPasswordDto) {
    this.logger.log(
      `Initialzing password reset request for user: ${data.email}`,
    );
    const redisData = await this.authHelper.getCodeFromRedis(data.email);
    if (!redisData) {
      this.logger.error(`No data found for this email: ${data.email}`);
      throw new NotFoundException(
        'No data found for this email. Request for a new code.',
      );
    }

    if (redisData.otp !== data.userCode.toString()) {
      this.logger.error(`Invalid code for the email: ${data.email}`);
      throw new BadRequestException('Invalid Code');
    }

    const user = await this.userHelper.findByEmail(data.email);
    const validate = await bcrypt.compare(
      data.updatedPassword,
      user.password_hash,
    );

    if (validate) {
      this.logger.error(
        `New password cannot be same as old password for the email: ${data.email}`,
      );
      throw new BadRequestException(
        'New password cannot be same as old password.',
      );
    }

    try {
      const hashedPassword = await bcrypt.hash(data.updatedPassword, 10);
      await this.userHelper.updateUserOnDemand(data.email, {
        password_hash: hashedPassword,
      });
      await this.redisService.del(data.email);
      this.logger.log(
        `Password update request completed successfully for user: ${data.email}`,
      );
      return { message: 'Password has been updated. Log in now.' };
    } catch (error) {
      this.logger.error(
        `Password update request failed for user: ${data.email} ${error.message}`,
      );
      throw new InternalServerErrorException(error.message);
    }
  }
  // Refresh token
  async generateRefreshAccessToken(token: string, userObj: any) {
    try {
      const existingToken = await this.userHelper.findOneOnDemand(
        'token_digest',
        token,
      );
      const decode = await this.authHelper.validate(token);
      if (!existingToken && decode.exp) {
        console.error('Token not found from db...');
      }

      const user = await this.userHelper.findByEmail(userObj.email);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const refreshToken = await this.authHelper.createToken(userObj.email);

      await this.userHelper.updateUserOnDemand(userObj.email, {
        token_digest: refreshToken,
      });
      return refreshToken;
    } catch (error) {
      console.error(error.message);
    }
  }

  // Logout Function
  async logout(data: any) {
    this.logger.log(`Initializing log out request for user: ${data.email}`);
    try {
      await this.userHelper.updateUserOnDemand(data.email, {
        token_digest: null,
      });
      this.logger.log(
        `Log out request completed successfully for user: ${data.email}`,
      );
      return {
        message: 'Logged out Successfully!',
      };
    } catch (error) {
      this.logger.error(
        `Log out request failed for user: ${data.email} ${error.message}`,
      );
      throw new InternalServerErrorException(error.message);
    }
  }
}
