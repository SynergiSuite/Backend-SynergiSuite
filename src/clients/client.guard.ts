import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { hasAccessRoleIds } from '../roles/role-access';
import { ClientsHelper } from './clients.helper';

@Injectable()
export class roleGuard implements CanActivate {
  private readonly logger = new Logger(roleGuard.name);

  constructor(private readonly clientsHelper: ClientsHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.log(`Checking if user has right role: ${user.email}`);
    const userDetails = await this.clientsHelper.getUserWithBusiness(
      user.email,
    );

    if (!hasAccessRoleIds(userDetails.role, [1, 2])) {
      this.logger.error(`User does not have right role: ${user.email}`);
      throw new UnauthorizedException(
        'User is not authorized to add new client.',
      );
    }

    this.logger.log(`User has right role: ${user.email}`);
    return true;
  }
}

@Injectable()
export class createClientGuard implements CanActivate {
  private readonly logger = new Logger(createClientGuard.name);

  constructor(private readonly clientsHelper: ClientsHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const body = request.body;
    const user = request.user;

    this.logger.log(`Checking if client exists or not: ${body.name}`);
    const userDetails = await this.clientsHelper.getUserWithBusiness(
      user.email,
    );

    const exists = await this.clientsHelper.clientExistsByName(
      userDetails.business.business_id,
      body.name,
    );

    if (exists) {
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

  constructor(private readonly clientsHelper: ClientsHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.log(`Checking if client exists or not for user: ${user.email}`);
    const userDetails = await this.clientsHelper.getUserWithBusiness(
      user.email,
    );
    const clients = await this.clientsHelper.findAllByBusinessId(
      userDetails.business.business_id,
    );

    if (!clients.length) {
      this.logger.error(
        `Client does not exist or business has no clients: ${user.email}`,
      );
      throw new BadRequestException('Client does not exist for this business.');
    }

    this.logger.log(
      `Client exists in business ${userDetails.business.business_id}`,
    );
    return true;
  }
}

@Injectable()
export class editClientGuard implements CanActivate {
  private readonly logger = new Logger(editClientGuard.name);

  constructor(private readonly clientsHelper: ClientsHelper) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const { id } = request.params;

    this.logger.log(`Checking if client exists for update: ${id}`);
    const userDetails = await this.clientsHelper.getUserWithBusiness(
      user.email,
    );

    try {
      await this.clientsHelper.findOneByBusiness(
        id,
        userDetails.business.business_id,
      );
    } catch {
      this.logger.error(`Client does not exist for this business: ${id}`);
      throw new BadRequestException('Client does not exist for this business.');
    }

    this.logger.log(`Client exists for update: ${id}`);
    return true;
  }
}
