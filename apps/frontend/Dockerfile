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
# The image renders templates into conf.d at startup (see nginx.conf.template).
COPY apps/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
# Where /api goes. Docker Compose's default; override it on other platforms (e.g. Render).
ENV BACKEND_URL=http://backend:3000
# Exposes the container's DNS servers as NGINX_LOCAL_RESOLVERS for the template's `resolver`.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
