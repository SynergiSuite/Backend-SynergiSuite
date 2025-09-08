# --- Base image ---
    FROM node:18-bullseye AS base

    WORKDIR /app
    
    # Copy package files first for better caching
    COPY package*.json ./
    COPY tsconfig*.json ./
    
    # Install dependencies (include dev for build)
    RUN npm install
    
    # Copy the full source code
    COPY . .
    
    # --- Development ---
    FROM base AS development
    
    ENV NODE_ENV=development
    EXPOSE 3002
    
    # Start in dev mode with hot reload
    CMD ["npm", "run", "start:dev"]
    
    # --- Production ---
    FROM base AS production
    
    # Build the app (dev deps still available here)
    RUN npm run build
    
    # Reinstall only prod dependencies AFTER build
    RUN npm ci --only=production --no-optional
    
    ENV NODE_ENV=production
    EXPOSE 3002
    
    CMD ["node", "dist/main"]
    