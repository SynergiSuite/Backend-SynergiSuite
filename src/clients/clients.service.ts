import { BadRequestException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Client } from './entities/client.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { UserService } from '../user/user.service';
import { BusinessService } from '../business/business.service';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);
  
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
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

  findOne(id: number) {
    return `This action returns a #${id} client`;
  }

  update(id: number, updateClientDto: UpdateClientDto) {
    return `This action updates a #${id} client`;
  }

  remove(id: number) {
    return `This action removes a #${id} client`;
  }

  // Helper Functions
  async findOneClientThroughId(id: string): Promise<Client> | null{
    return await this.clientRepository.findOne({where: {id}});
  }
}
