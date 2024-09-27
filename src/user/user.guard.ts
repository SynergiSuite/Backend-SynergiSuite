import { CanActivate, Injectable, ExecutionContext, ConflictException } from "@nestjs/common";
import { UserService } from "./user.service";

@Injectable()
export class userAlreadyExistGuard implements CanActivate {
    constructor(private readonly userService: UserService){}

    async canActivate(context: ExecutionContext): Promise<boolean>  {

        const request = context.switchToHttp().getRequest()
        const createUserDto = request.body

        const existingUser = await this.userService.findByEmail(createUserDto.email)
        console.log(existingUser)

        if (existingUser) {
            throw new ConflictException("Operation unsuccessfull on " + createUserDto.email)
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
            throw new ConflictException("Could not find email!")
        } else {
            return true
        }
    }
}