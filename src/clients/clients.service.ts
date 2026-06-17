import { BadRequestException, forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Client } from './entities/client.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectsService } from 'src/projects/projects.service';
import { UserService } from 'src/user/user.service';
import { BusinessService } from 'src/business/business.service';
import { Project } from 'src/projects/entities/project.entity';
import { Task } from 'src/projects/entities/task.entity';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);
  
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @Inject(forwardRef(() => ProjectsService)) 
    private readonly projectService: ProjectsService,
    private readonly userService: UserService,
    private readonly businessService: BusinessService,
  ) {}

  // This function registers a new client
  async create(createClientDto: CreateClientDto, obj: any): Promise<Client> {
    this.logger.log(`Initiating to register new client for business`)
    try {
      const user = await this.userService.getUserWithBusiness(obj.email);
      const business = user.business;
      const record = this.clientRepository.create({
        name: createClientDto.name,
        email: createClientDto.email,
        phone: createClientDto.phone,
        address: createClientDto.address,
        company: createClientDto.company,
        priority: createClientDto.priority,
        business
      });
      this.logger.log(`Registering new client for business`)
      const savedClient = await this.clientRepository.save(record);
      this.logger.log(`New client registered for business`)
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
      const user = await this.userService.getUserWithBusiness(obj.email);
      const business = user.business;
      this.logger.log(`Found business: ${business.business_id} for user: ${obj.email}`);
      this.logger.log(`Querying clients for business: ${business.business_id}`);
      const clients = await this.clientRepository.find({ where: { business: { business_id: business.business_id } } });
      this.logger.log(`Found ${clients.length} clients for business: ${business.business_id}`);
      return clients;
    } catch (error) {
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
    }
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: { id },
      relations: ['business', 'projects'],
    });

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    return client;
  }

  async update(id: string, updateClientDto: UpdateClientDto, obj: any): Promise<Client> {
    this.logger.log(`Initiating to update client: ${id} for user: ${obj.email}`);
    try {
      const user = await this.userService.getUserWithBusiness(obj.email);
      const business = user.business;
      this.logger.log(`Found business: ${business.business_id} for user: ${obj.email}`);

      const client = await this.clientRepository.findOne({
        where: {
          id,
          business: { business_id: business.business_id },
        },
        relations: ['business'],
      });

      if (!client) {
        this.logger.error(`Client not found for update: ${id}`);
        throw new NotFoundException('Client not found.');
      }

      Object.assign(client, updateClientDto);

      this.logger.log(`Saving updated client: ${id}`);
      const updatedClient = await this.clientRepository.save(client);
      this.logger.log(`Client updated successfully: ${id}`);

      return updatedClient;
    } catch (error) {
      this.logger.error(error.message);
      throw error instanceof NotFoundException
        ? error
        : new BadRequestException(error.message);
    }
  }

  async remove(id: string, obj: any) {
    this.logger.log(`Initiating to delete client: ${id} for user: ${obj.email}`);
    try {
      const user = await this.userService.getUserWithBusiness(obj.email);
      const business = user.business;
      this.logger.log(`Found business: ${business.business_id} for user: ${obj.email}`);

      const client = await this.clientRepository.findOne({
        where: {
          id,
          business: { business_id: business.business_id },
        },
        relations: ['business', 'projects', 'projects.tasks', 'projects.tasks.teams', 'projects.teams'],
      });

      if (!client) {
        this.logger.error(`Client not found for deletion: ${id}`);
        throw new NotFoundException('Client not found.');
      }

      await this.clientRepository.manager.transaction(async (manager) => {
        if (client.projects?.length) {
          this.logger.log(`Deleting ${client.projects.length} projects linked to client: ${id}`);

          for (const project of client.projects) {
            if (project.tasks?.length) {
              for (const task of project.tasks) {
                if (task.teams?.length) {
                  await manager
                    .createQueryBuilder()
                    .relation(Task, 'teams')
                    .of(task)
                    .remove(task.teams);
                }
              }
            }

            if (project.teams?.length) {
              await manager
                .createQueryBuilder()
                .relation(Project, 'teams')
                .of(project)
                .remove(project.teams);
            }
          }

          await manager.remove(Project, client.projects);
        }

        await manager.remove(Client, client);
      });

      this.logger.log(`Client and related projects deleted successfully: ${id}`);
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
  async findOneClientThroughId(id: string): Promise<Client> | null{
    return await this.clientRepository.findOne({where: {id}});
  }
}
