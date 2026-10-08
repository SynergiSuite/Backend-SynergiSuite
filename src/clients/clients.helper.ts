import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { Task } from '../projects/entities/task.entity';
import { UserHelper } from '../user/user.helper';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Client } from './entities/client.entity';

@Injectable()
export class ClientsHelper {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    private readonly userHelper: UserHelper,
  ) {}

  async getUserWithBusiness(email: string) {
    const user = await this.userHelper.getUserWithBusinessDetail(email);

    if (!user?.business?.business_id) {
      throw new BadRequestException(
        'User does not have a registered Business.',
      );
    }

    return user;
  }

  async createClient(createClientDto: CreateClientDto, user: any) {
    const record = this.clientRepository.create({
      name: createClientDto.name,
      email: createClientDto.email,
      phone: createClientDto.phone,
      address: createClientDto.address,
      company: createClientDto.company,
      priority: createClientDto.priority,
      paymentType: createClientDto.paymentType,
      amount: createClientDto.amount,
      business: user.business,
    });

    return await this.clientRepository.save(record);
  }

  async findAllByBusinessId(businessId: number) {
    return await this.clientRepository.find({
      where: { business: { business_id: businessId } },
    });
  }

  async findOne(id: string) {
    const client = await this.clientRepository.findOne({
      where: { id },
      relations: ['business', 'projects'],
    });

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    return client;
  }

  async findOneClientThroughId(id: string) {
    return await this.clientRepository.findOne({
      where: { id },
      relations: ['business'],
    });
  }

  async findOneByBusiness(id: string, businessId: number) {
    const client = await this.clientRepository.findOne({
      where: {
        id,
        business: { business_id: businessId },
      },
      relations: ['business'],
    });

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    return client;
  }

  async findOneForDelete(id: string, businessId: number) {
    const client = await this.clientRepository.findOne({
      where: {
        id,
        business: { business_id: businessId },
      },
      relations: [
        'business',
        'projects',
        'projects.tasks',
        'projects.tasks.teams',
        'projects.teams',
      ],
    });

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    return client;
  }

  async clientExistsByName(businessId: number, name: string) {
    const client = await this.clientRepository.findOne({
      where: {
        name,
        business: { business_id: businessId },
      },
      relations: ['business'],
    });

    return Boolean(client);
  }

  async updateClient(client: Client, updateClientDto: UpdateClientDto) {
    Object.assign(client, updateClientDto);
    return await this.clientRepository.save(client);
  }

  async removeClientWithProjects(client: Client) {
    await this.clientRepository.manager.transaction(async (manager) => {
      if (client.projects?.length) {
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
  }
}
