import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Client } from './entities/client.entity';
import { ActivityService } from 'src/activity/activity.service';
import { ActivityAction } from 'src/activity/entities/activity-log.entity';
import { EmailService } from 'src/mailer/email.service';
import { RedisService } from 'src/redis/redis.service';
import { ClientsHelper } from './clients.helper';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    private readonly clientsHelper: ClientsHelper,
    private readonly activityService: ActivityService,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {}

  // This function registers a new client
  async create(createClientDto: CreateClientDto, obj: any): Promise<Client> {
    this.logger.log(`Initiating to register new client for business`);
    try {
      const user = await this.clientsHelper.getUserWithBusiness(obj.email);
      const business = user.business;
      this.logger.log(`Registering new client for business`);
      const savedClient = await this.clientsHelper.createClient(
        createClientDto,
        user,
      );
      this.logger.log(`New client registered for business`);
      if (savedClient.email) {
        this.sendClientInvitationEmail(savedClient, user).catch((error) => {
          this.logger.error(
            `[ClientInvite] Failed to send client invitation | clientId=${savedClient.id} | email=${savedClient.email} | error=${error.message}`,
            error.stack,
          );
        });
      }

      await this.activityService.log({
        action: ActivityAction.CREATED,
        module: 'clients',
        entityType: 'Client',
        entityId: savedClient.id,
        entityName: savedClient.name,
        actor: user,
        businessId: business.business_id,
        after: {
          id: savedClient.id,
          name: savedClient.name,
          email: savedClient.email,
          phone: savedClient.phone,
          address: savedClient.address,
          company: savedClient.company,
          priority: savedClient.priority,
          paymentType: savedClient.paymentType,
          amount: savedClient.amount,
        },
      });
      return savedClient;
    } catch (error) {
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
    }
  }

  // Find all clients for this business
  async findAll(obj: any) {
    try {
      this.logger.log(`Finding all clients for user: ${obj.email}`);
      const user = await this.clientsHelper.getUserWithBusiness(obj.email);
      const business = user.business;
      this.logger.log(
        `Found business: ${business.business_id} for user: ${obj.email}`,
      );
      this.logger.log(`Querying clients for business: ${business.business_id}`);
      const clients = await this.clientsHelper.findAllByBusinessId(
        business.business_id,
      );
      this.logger.log(
        `Found ${clients.length} clients for business: ${business.business_id}`,
      );
      return clients;
    } catch (error) {
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
    }
  }

  async findOne(id: string): Promise<Client> {
    return await this.clientsHelper.findOne(id);
  }

  async getClientDetails(id: string, obj: any) {
    this.logger.log(
      `Initiating request to fetch client details for ID: ${id} by user: ${obj?.email}`,
    );
    try {
      const user = await this.clientsHelper.getUserWithBusiness(obj.email);
      const businessId = user.business.business_id;

      return await this.clientsHelper.getClientDetailsWithRelations(
        id,
        businessId,
      );
    } catch (error) {
      this.logger.error(
        `Error fetching client details for ID: ${id}: ${error.message}`,
        error.stack,
      );
      throw error instanceof NotFoundException
        ? error
        : new BadRequestException(error.message);
    }
  }

  async update(
    id: string,
    updateClientDto: UpdateClientDto,
    obj: any,
  ): Promise<Client> {
    this.logger.log(
      `Initiating to update client: ${id} for user: ${obj.email}`,
    );
    try {
      const user = await this.clientsHelper.getUserWithBusiness(obj.email);
      const business = user.business;
      this.logger.log(
        `Found business: ${business.business_id} for user: ${obj.email}`,
      );

      const client = await this.clientsHelper.findOneByBusiness(
        id,
        business.business_id,
      );

      const before = {
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
        company: client.company,
        priority: client.priority,
        paymentType: client.paymentType,
        amount: client.amount,
      };

      this.logger.log(`Saving updated client: ${id}`);
      const updatedClient = await this.clientsHelper.updateClient(
        client,
        updateClientDto,
      );
      this.logger.log(`Client updated successfully: ${id}`);
      const after = {
        name: updatedClient.name,
        email: updatedClient.email,
        phone: updatedClient.phone,
        address: updatedClient.address,
        company: updatedClient.company,
        priority: updatedClient.priority,
        paymentType: updatedClient.paymentType,
        amount: updatedClient.amount,
      };

      await this.activityService.logFieldChanges(
        {
          action: ActivityAction.UPDATED,
          module: 'clients',
          entityType: 'Client',
          entityId: updatedClient.id,
          entityName: updatedClient.name,
          actor: user,
          businessId: business.business_id,
        },
        before,
        after,
        [
          'name',
          'email',
          'phone',
          'address',
          'company',
          'priority',
          'paymentType',
          'amount',
        ],
      );

      return updatedClient;
    } catch (error) {
      this.logger.error(error.message);
      throw error instanceof NotFoundException
        ? error
        : new BadRequestException(error.message);
    }
  }

  async remove(id: string, obj: any) {
    this.logger.log(
      `Initiating to delete client: ${id} for user: ${obj.email}`,
    );
    try {
      const user = await this.clientsHelper.getUserWithBusiness(obj.email);
      const business = user.business;
      this.logger.log(
        `Found business: ${business.business_id} for user: ${obj.email}`,
      );

      const client = await this.clientsHelper.findOneForDelete(
        id,
        business.business_id,
      );

      const before = {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
        company: client.company,
        priority: client.priority,
        paymentType: client.paymentType,
        amount: client.amount,
        projectCount: client.projects?.length ?? 0,
      };

      if (client.projects?.length) {
        this.logger.log(
          `Deleting ${client.projects.length} projects linked to client: ${id}`,
        );
      }

      await this.clientsHelper.removeClientWithProjects(client);

      this.logger.log(
        `Client and related projects deleted successfully: ${id}`,
      );
      await this.activityService.log({
        action: ActivityAction.DELETED,
        module: 'clients',
        entityType: 'Client',
        entityId: client.id,
        entityName: client.name,
        actor: user,
        businessId: business.business_id,
        before,
      });
      return {
        message: 'Client and related projects/tasks deleted successfully.',
      };
    } catch (error) {
      this.logger.error(error.message);
      throw error instanceof NotFoundException
        ? error
        : new BadRequestException(error.message);
    }
  }

  // Helper Functions
  async findOneClientThroughId(id: string): Promise<Client> | null {
    return await this.clientsHelper.findOneClientThroughId(id);
  }

  private async sendClientInvitationEmail(client: Client, user: any) {
    this.logger.log(
      `[ClientInvite] Preparing invitation email | clientId=${client.id} | email=${client.email}`,
    );

    const token = await this.redisService.generateTokenForClientInvitation(
      client.email,
      user.email,
      client.id,
      user.business.business_id,
    );

    const emailSent = await this.emailService.sendInvitationEmail(
      {
        to: client.email,
        subject: 'Invitation to access your client workspace',
        text: 'Continue with this token ',
        registered: false,
        invited_by: user.name,
        invited_bys_role: 'Client',
        business: user.business.name,
        name: client.name,
        heading: 'You were invited to access your client workspace',
      },
      token,
    );

    if (!emailSent) {
      throw new Error('Mailer failed to send client invitation email.');
    }

    this.logger.log(
      `[ClientInvite] Invitation email sent | clientId=${client.id} | email=${client.email}`,
    );
  }
}
