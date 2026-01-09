# SynergiSuite Backend - Docker Setup

This guide explains how to set up and run the SynergiSuite backend using Docker.

## Prerequisites

- Docker and Docker Compose installed on your machine
- Node.js and npm (for local development without Docker)

## Getting Started

1. **Copy the environment file**
   ```bash
   cp .env.example .env
   ```

2. **Update the environment variables** in the `.env` file with your configuration.

3. **Build and start the containers**
   ```bash
   docker-compose up --build
   ```

   For running in detached mode (in the background):
   ```bash
   docker-compose up -d --build
   ```

4. **Access the services**
   - API: http://localhost:3000
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379
   - pgAdmin: http://localhost:5050

## Development Workflow

### Rebuilding after code changes
When you make changes to your code, you'll need to rebuild the container:

```bash
docker-compose up --build
```

### Running database migrations
If you need to run database migrations:

```bash
docker-compose exec app npm run typeorm migration:run
```

### Viewing logs
View logs for all services:
```bash
docker-compose logs -f
```

View logs for a specific service:
```bash
docker-compose logs -f app
```

## Stopping the services

To stop all running containers:
```bash
docker-compose down
```

To stop and remove all containers, networks, and volumes:
```bash
docker-compose down -v
```

## Environment Variables

The following environment variables need to be set in the `.env` file:

- `POSTGRES_*`: Database connection settings
- `REDIS_*`: Redis connection settings
- `JWT_*`: JWT authentication settings
- `MAIL_*`: Email service configuration
- `FRONTEND_URL`: URL of your frontend application

## Troubleshooting

- **Port conflicts**: If you get port conflicts, update the ports in `docker-compose.yml`
- **Database connection issues**: Ensure the database is running and the credentials in `.env` match those in `docker-compose.yml`
- **Volume permissions**: If you encounter permission issues with volumes, you might need to adjust the permissions of the mounted directories

## Production Deployment

For production deployment, make sure to:
1. Set `NODE_ENV=production`
2. Configure proper SSL certificates
3. Use strong, unique passwords
4. Set appropriate resource limits in `docker-compose.yml`
5. Configure proper logging and monitoring
