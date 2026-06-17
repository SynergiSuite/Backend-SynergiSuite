import { BadRequestException, CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { BusinessService } from "../business/business.service";
import { UserService } from "../user/user.service";

@Injectable()
export class roleGuard implements CanActivate {
  private readonly logger = new Logger(roleGuard.name);

  constructor(private readonly userService: UserService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        this.logger.log(`Checking if user has right role: ${user.email}`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        if(userDetails.role.id !== 1 && userDetails.role.id !== 2){
          this.logger.error(`User does not have right role: ${user.email}`);
          throw new UnauthorizedException('User is not authorized to add new client.');
        }
        this.logger.log(`User has right role: ${user.email}`);
        return true;
    }
}

@Injectable()
export class createClientGuard implements CanActivate {
  private readonly logger = new Logger(createClientGuard.name);

  constructor(
    private readonly userService: UserService,
    private readonly businessService: BusinessService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const body = request.body;
        const user = request.user;

        this.logger.log(`Checking if client exists or not: ${body.name}`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        const businessDetails = await this.businessService.getClientWithBusiness(userDetails.business.business_id)
        if(businessDetails.clients.find(client => client.name === body.name)){
          this.logger.error(`Client already exists: ${body.name}`);
          throw new BadRequestException('Client already exists for this business.');
        }
        this.logger.log(`Client does not exist: ${body.name}`);
        return true;
    }
}

@Injectable()
export class checkClientBusiness implements CanActivate {
  private readonly logger = new Logger(checkClientBusiness.name);

  constructor(
    private readonly userService: UserService,
    private readonly businessService: BusinessService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const body = request.body;
        const user = request.user;

        this.logger.log(`Checking if client exists or not: ${body.name}`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        const businessDetails = await this.businessService.getClientWithBusiness(userDetails.business.business_id)
        if(!businessDetails || !businessDetails.clients){
          this.logger.error(`Client does not exist or business has no clients: ${body.name}`);
          throw new BadRequestException('Client does not exist for this business.');
        }
        this.logger.log(`Client exists: ${body.name} in business ${businessDetails.name}`);
        return true;
    }
}

@Injectable()
export class editClientGuard implements CanActivate {
  private readonly logger = new Logger(editClientGuard.name);

  constructor(
    private readonly userService: UserService,
    private readonly businessService: BusinessService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const { id } = request.params;

        this.logger.log(`Checking if client exists for update: ${id}`);
        const userDetails = await this.userService.getUserWithBusiness(user.email);
        const businessDetails = await this.businessService.getClientWithBusiness(userDetails.business.business_id);

        if(!businessDetails || !businessDetails.clients || !businessDetails.clients.find(client => client.id === id)){
          this.logger.error(`Client does not exist for this business: ${id}`);
          throw new BadRequestException('Client does not exist for this business.');
        }

        this.logger.log(`Client exists for update: ${id}`);
        return true;
    }
}
