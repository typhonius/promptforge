# Build stage
FROM node:24-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Install curl for health check
RUN apk add --no-cache curl

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user (nginx group already exists)
RUN adduser -S promptforge -u 1001 -G nginx

# Change ownership of nginx directories
RUN chown -R promptforge:nginx /var/cache/nginx && \
    chown -R promptforge:nginx /var/log/nginx && \
    chown -R promptforge:nginx /etc/nginx/conf.d
RUN touch /var/run/nginx.pid && \
    chown -R promptforge:nginx /var/run/nginx.pid

# Switch to non-root user
USER promptforge

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]