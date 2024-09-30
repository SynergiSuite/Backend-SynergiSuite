import { CanActivate, Injectable, ExecutionContext, ConflictException, NotFoundException } from "@nestjs/common";
import { UserService } from "./user.service";

@Injectable()
export class userAlreadyExistGuard implements CanActivate {
    constructor(private readonly userService: UserService){}

    async canActivate(context: ExecutionContext): Promise<boolean>  {

        const request = context.switchToHttp().getRequest()
        const createUserDto = request.body

        const existingUser = await this.userService.findByEmail(createUserDto.email)

        if (existingUser) {
            throw new ConflictException("User Already Exist")
        } else {
            return true
        }
    }
}

@Injectable()
export class userExistGuard implements CanActivate {
    constructor(private readonly userService: UserService){}

    async canActivate(context: ExecutionContext): Promise<boolean>  {

        const request = context.switchToHttp().getRequest()
        const createUserDto = request.body

        const existingUser = await this.userService.findByEmail(createUserDto.email)

        if (!existingUser) {
            throw new NotFoundException("Could not find email!")
        } else {
            return true
        }
    }
}

@Injectable()
export class isUserVerfied implements CanActivate {
    constructor(private readonly userService: UserService){}

    async canActivate(context: ExecutionContext): Promise<boolean>  {

        const request = context.switchToHttp().getRequest()
        const createUserDto = request.body

        const existingUser = await this.userService.findByEmail(createUserDto.email)

        if (existingUser.is_Verified) {
            throw new ConflictException("Could not find email!")
        } else {
            return true
            
        }
    }
}