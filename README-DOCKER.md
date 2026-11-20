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
   docker compose up --build
   ```

   For running in detached mode (in the background):
   ```bash
   docker compose up -d --build --wait
   ```

4. **Access the services**
   - API: http://localhost:3002
   - PostgreSQL: localhost:5433 (configurable with `POSTGRES_HOST_PORT`)
   - Redis: localhost:6379

## Development Workflow

### Rebuilding after code changes
When you make changes to your code, you'll need to rebuild the container:

```bash
docker compose up --build
```

### Running database migrations
If you need to run database migrations:

```bash
docker compose exec app npm run typeorm migration:run
```

### Viewing logs
View logs for all services:
```bash
docker compose logs -f
```

View logs for a specific service:
```bash
docker compose logs -f app
```

## Stopping the services

To stop all running containers:
```bash
docker compose down
```

To stop and remove all containers, networks, and volumes:
```bash
docker compose down -v
```

`docker compose down -v` permanently deletes the local PostgreSQL, Redis, and
MinIO data volumes. Use it only when you intentionally want a clean reset.

## Importing a Neon database

The commands below use the PostgreSQL client tools already included in the
`postgres` container. Before importing, make sure the local database is empty
or that you are comfortable replacing its contents.

1. Start PostgreSQL:

   ```bash
   docker compose up -d postgres --wait
   ```

2. Copy the direct (non-pooled) connection string from the Neon dashboard and
   export it in your current terminal. Keep `sslmode=require` in the URL:

   ```bash
   export NEON_DATABASE_URL='postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require'
   ```

3. Create a custom-format dump. The URL is passed through the environment and
   is not written to the repository:

   ```bash
   docker compose exec -T -e NEON_DATABASE_URL postgres sh -c \
     'pg_dump --dbname="$NEON_DATABASE_URL" --format=custom --no-owner --no-acl' \
     > neon.dump
   ```

4. Restore the dump into the local database:

   ```bash
   docker compose exec -T postgres sh -c \
     'pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
       --clean --if-exists --no-owner --no-acl --single-transaction' \
     < neon.dump
   ```

5. Start the complete stack and verify the imported tables:

   ```bash
   docker compose up -d --build --wait
   docker compose exec postgres sh -c \
     'psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -c "\\dt"'
   docker compose exec postgres sh -c \
     'psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -c "ANALYZE"'
   ```

The dump file contains your production data, so do not commit `neon.dump`.
Delete it securely after confirming the migration. If Neon uses extensions,
install and enable equivalent extensions locally before restoring. The local
PostgreSQL major version should be the same as or newer than the Neon source.

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
