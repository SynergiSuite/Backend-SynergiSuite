import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { PayloadDto } from './dto/payload.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm'
import { UserService } from 'src/user/user.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { VerificationResponseDto } from 'src/user/dto/response.dto';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly userService: UserService,
        private jwtService: JwtService
    ){}

    async create(createUserDto: CreateUserDto): Promise<VerificationResponseDto> {
        const hashedPassword = await bcrypt.hash(createUserDto.password_hash, 10)
        const payload = {email: createUserDto.email,}
        const token = this.jwtService.sign(payload)
        const user = this.userRepository.create({
          name: createUserDto.name,
          email: createUserDto.email,
          password_hash: hashedPassword,
          token_digest: token
        })
        try {
          await this.userRepository.insert(user)
          return {
            access_token: token,
            user: user
          }
        } 
        catch (error) {
          return { message: "Unable to create user", error: error.message}
        }
      }

    async validateSession({email, password_hash}: PayloadDto){
        const user = await this.userService.findByEmail(email)
        const validate = await bcrypt.compare(password_hash, user.password_hash)
        if (validate) {
            try {
                const payload = {email: email}
                const token = await this.jwtService.sign(payload)
                const updateToken = await this.userRepository.update({email: email}, {token_digest: token})
                if (!updateToken) return {message: "Some error occured", status: HttpStatus.NOT_ACCEPTABLE}
                return {
                    message: "Logged in successfully",
                    status: HttpStatus.ACCEPTED,
                    access_token: token
                }
            } catch (error) {
                throw new ForbiddenException(error.message)
            }   
        } else {
            throw new HttpException("Invalid Credentails", 401 )
        }
        
    }

    async validate(payload: any) {
        return { email: payload.email, iat: payload.iat, exp: payload.exp };
    }
}
