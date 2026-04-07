FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy root package files
COPY package.json package-lock.json* ./
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/server/ ./packages/server/
COPY packages/web/ ./packages/web/
COPY tsconfig.json ./

# Build frontend
RUN npm run build -w packages/web

# Build backend
RUN npm run build -w packages/server

# ── Production stage ──
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache sqlite

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S -u 1001 -G appgroup appuser

# Copy package files
COPY package.json package-lock.json* ./
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built files
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/web/dist ./packages/web/dist

# Create necessary directories
RUN mkdir -p data logs && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=./data/ai-agency.db

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "packages/server/dist/index.js"]
