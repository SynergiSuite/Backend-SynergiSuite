import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm'
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { VerificationResponseDto } from './dto/response.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: 
    Repository<User> 
  ){}

  async create(createUserDto: CreateUserDto) {
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(createUserDto.password_hash, saltRounds)
    const user = this.userRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      password_hash: hashedPassword
    })
    try {
      await this.userRepository.insert(user)
      return {
        user: user
      }
    } 
    catch (error) {
      return { message: "Unable to create user"}
    }
  }

  async findAll(): Promise<User[]> | undefined {
    return await this.userRepository.find()
  }

  async checkVerification(email: string): Promise<VerificationResponseDto> | undefined {
    const isUserVerfied = await this.userRepository.findOne({ where: {email: email}})  
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

  async findOne(id: number) {
    const user = await this.userRepository.find({where: {user_id: id}})
    return user
  }

  async findByEmail(email: string): Promise<User> | undefined {
    const user = await this.userRepository.findOne({ where: {email} })
    return user
  }

  async updateName(id: number, updateUserDto: UpdateUserDto) {
    const updatedUser = await this.userRepository.update({user_id: id}, {name: updateUserDto.name})
    return {
      message: "Name updated successfully!",
      userName: updateUserDto.name,
      userEmail: updateUserDto.email,
      user: this.findOne(id)
    }
  }

  async updateEmail(id: number, updateUserDto: UpdateUserDto) {
    const updatedUser = await this.userRepository.update({user_id: id}, {email: updateUserDto.email})
    return {
      message: "Email updated successfully!",
      userName: updateUserDto.name,
      userEmail: updateUserDto.email,
      user: await this.userRepository.findOne({where: {user_id: id}})
    }
  }

  async updatePassword(updateUserDto: UpdateUserDto) {
    const user = await this.findByEmail(updateUserDto.email);
    if (!user) {
      return { message: "User not found", email: updateUserDto.email };
    }
  
    const isPasswordValid = await bcrypt.compare(updateUserDto.old_password, user.password_hash);
    if (!isPasswordValid) {
      return { message: "Previous password is incorrect", email: updateUserDto.email };
    }
  
    try {
      const hashedNewPassword = await bcrypt.hash(updateUserDto.new_password, 10);
      await this.userRepository.update({ user_id: user.user_id }, { password_hash: hashedNewPassword });
  
      return { message: "Password updated successfully!", email: updateUserDto.email };
    } catch (error) {
      return { message: "Unable to update password", email: updateUserDto.email };
    }
  }
  

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}

