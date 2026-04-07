FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/

# Install dependencies
RUN npm install

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

COPY package.json package-lock.json* ./
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/

RUN npm install --omit=dev

# Copy built files
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/web/dist ./packages/web/dist

# Create data directory
RUN mkdir -p data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=./data/ai-agency.db

EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
