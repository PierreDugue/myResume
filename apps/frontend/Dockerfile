# Build context: repository root (see docker-compose.yml)

# Stage 1: build the Angular app with Nx
FROM node:24-alpine AS build
WORKDIR /workspace
ENV NX_DAEMON=false NX_NO_CLOUD=true CYPRESS_INSTALL_BINARY=0

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx build frontend --configuration=production

# Stage 2: serve with nginx
FROM nginx:alpine
COPY --from=build /workspace/dist/apps/frontend/browser /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
