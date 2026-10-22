# Build context: repository root (see docker-compose.yml)

# Stage 1: build the backend with Nx
FROM node:24-alpine AS build
WORKDIR /workspace
ENV NX_DAEMON=false NX_NO_CLOUD=true CYPRESS_INSTALL_BINARY=0

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Builds dist/apps/backend incl. a generated package.json + package-lock.json (runtime deps only)
RUN npx nx build backend --configuration=production

# Stage 2: production runtime
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /workspace/dist/apps/backend ./
RUN npm ci --omit=dev && npm cache clean --force

USER node
EXPOSE 3000
CMD ["node", "main.js"]
